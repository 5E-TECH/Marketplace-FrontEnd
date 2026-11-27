import { http } from 'msw';
import { db } from '../db';
import {
  freshTwoFactorAccount,
  MOCK_NEW_RECOVERY_CODES,
  MOCK_SETUP_SECRET,
  TWO_FACTOR_BLOCK_SECONDS,
  TWO_FACTOR_CHALLENGE_SECONDS,
  TWO_FACTOR_MAX_FAILED,
  TWO_FACTOR_ROLES,
  type MockTwoFactorAccount,
} from '../fixtures/twoFactor';
import { allMockAccounts, digitsOf, findMockUser, findMockUserById, MOCK_WRONG_PASSWORD, mockTokenFor, recordMockLogin, userFromMockToken, type MockAccount } from '../fixtures/users';
import { verifyTotp } from '../totp';
import { API, bearerToken, fail, ok } from '../utils';

/**
 * Auth (identity): login, profil, refresh, chiqish, sessiyalar. Haqiqiy backenddagi
 * refresh cookie o'rnida oddiy mock cookie — yangi tab undan jim sessiya tiklaydi (TC2).
 */
const SESSION_COOKIE = 'elchi_mock_session';

/** Refresh cookie: telefonning 9 raqami va sessiyalar avlodi (backend sessiyalarni bekor qilsa — eski cookie yaroqsiz). */
export function sessionCookie(user: Pick<MockAccount, 'phone'>): string {
  const epoch = findMockUser(user.phone)?.sessionEpoch ?? 0;
  return `${SESSION_COOKIE}=${user.phone.slice(-9)}${epoch ? `.${epoch.toString()}` : ''}; Path=/; SameSite=Lax`;
}
const clearedCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;

/** Cookie egasi va sessiyasi hali amaldami (bekor qilinmagan, hisob o'chirilmagan). */
function sessionFromCookie(value: string | undefined): { account: MockAccount; revoked: boolean } | null {
  const match = /^(\d{9})(?:\.(\d+))?$/.exec(value ?? '');
  const account = match ? findMockUser(match[1]) : null;
  if (!match || !account || account.isDeleted) return null;
  return { account, revoked: Number(match[2] ?? 0) !== account.sessionEpoch };
}

/**
 * Bearer token (body rejimi) yoki mock cookie — qaysi foydalanuvchi so'rayapti. Token kelgan bo'lsa faqat u
 * tekshiriladi: bloklangan yoki roli o'zgargan xodimning eski tokeni darhol rad etiladi (backend `CurrentRoleGuard`).
 */
export function currentMockUser(request: Request, cookies: Record<string, string>): MockAccount | null {
  const token = bearerToken(request);
  if (token) return userFromMockToken(token);
  const session = sessionFromCookie(cookies[SESSION_COOKIE]);
  return session && !session.revoked && !session.account.isBlocked ? session.account : null;
}

/** Operator jamoasining nazoratchisi (taklif fe-15 §15: `/auth/me` `team`, blok sahifasidagi «Nazoratchi»). */
function supervisorNameOf(account: MockAccount): string | null {
  const teamId = account.staff?.teamId;
  const team = teamId ? db.teams.find((item) => item.id === teamId) : null;
  return team ? findMockUserById(team.supervisorId)?.name ?? null : null;
}

/**
 * Hisob yopiq — taklif (fe-15 §15): 401 `ACCOUNT_BLOCKED` | `ACCOUNT_INACTIVE` va `account` tafsiloti (kim, qachon,
 * kim qaror qildi, sabab; sotuvchida dalil, asos, sahifalar va pul). Backend hozir: login «Hisobingiz bloklangan»,
 * refresh «Hisob faol emas», SMS kod — «hisob topilmadi». Faqat parol yoki kod to'g'ri bo'lgach beriladi.
 */
export function accountLockResponse(account: MockAccount) {
  if (!account.isBlocked && account.isActive) return null;
  const base = { id: account.id, name: account.name, role: account.role, supervisorName: account.role === 'OPERATOR_LEAD' ? supervisorNameOf(account) : null };
  if (!account.isBlocked) {
    const inactive = account.staff?.inactive;
    return fail(401, 'ACCOUNT_INACTIVE', 'Hisob faol emas', undefined, {
      account: { ...base, at: inactive?.at ?? null, by: inactive ? { name: inactive.by, role: 'SUPERVISOR' } : null, reason: inactive?.reason ?? null },
    });
  }
  const block = account.staff?.block ?? account.seller?.block ?? null;
  const actor = block ? allMockAccounts().find((item) => item.name === block.by) : null;
  const seller = account.role === 'AFFILIATE' || account.role === 'WHOLESALER';
  return fail(401, 'ACCOUNT_BLOCKED', 'Hisobingiz bloklangan', undefined, {
    account: {
      ...base,
      at: block?.at ?? null,
      by: block ? { name: block.by, role: actor?.role ?? 'ADMIN' } : null,
      reason: block?.reason ?? null,
      evidence: account.seller?.block?.evidence ?? null,
      basis: seller ? 'oferta' : null,
      // Taklif §11: blok sotuvchi sahifalarini to'xtatadi; ushlab turilgan haq bekor, balans — mock 0.
      seller: seller ? { pagesStopped: true, heldBonus: { amount: 0, cancelled: true }, balance: 0 } : null,
    },
  });
}

/**
 * BE-26: parol to'g'ri bo'lgach 2FA bosqichi. Taklif (fe-27 §2): kim kirayotgani (`user`) va superadmin tiklagani
 * (`reset`) — kod oynasidagi karta va «2FA tiklandi» xabari uchun.
 */
function challengeFor(user: MockAccount) {
  const digits = digitsOf(user.phone);
  const account = (db.twoFactor.accounts[digits] ??= freshTwoFactorAccount());
  const token = `mock2fa.${digits}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  db.twoFactor.challenges.set(token, { digits, expiresAt: Date.now() + TWO_FACTOR_CHALLENGE_SECONDS * 1000 });
  return {
    twoFactorRequired: Boolean(account.enabledAt),
    twoFactorSetupRequired: !account.enabledAt,
    challengeToken: token,
    user: { name: user.name, role: user.role },
    reset: account.enabledAt ? null : account.reset,
  };
}

const expiredChallenge = () => fail(401, 'UNAUTHENTICATED', '2FA bosqichi muddati o‘tdi — qayta kiring');

async function challengeSubject(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { challengeToken?: unknown; code?: unknown; recoveryCode?: unknown };
  const token = typeof body.challengeToken === 'string' ? body.challengeToken : '';
  const challenge = db.twoFactor.challenges.get(token);
  const user = challenge ? findMockUser(challenge.digits) : null;
  if (!challenge || challenge.expiresAt < Date.now() || !user) return { error: expiredChallenge() };
  return { token, body, user, account: (db.twoFactor.accounts[challenge.digits] ??= freshTwoFactorAccount()) };
}

/** Urinish band qilinadi: blokda — 423 (taklif: `retryAfterSeconds`); 3-urinishda blok shu yerda qo'yiladi. */
function reserveAttempt(account: MockTwoFactorAccount) {
  const now = Date.now();
  if (account.blockedUntil && account.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((account.blockedUntil - now) / 1000);
    return fail(423, 'RATE_LIMITED', '3 marta noto‘g‘ri 2FA kodi — 15 daqiqadan keyin qayta urining', { 'Retry-After': String(retryAfterSeconds) }, { retryAfterSeconds });
  }
  if (account.blockedUntil) Object.assign(account, { blockedUntil: null, failed: 0 });
  account.failed += 1;
  if (account.failed >= TWO_FACTOR_MAX_FAILED) account.blockedUntil = now + TWO_FACTOR_BLOCK_SECONDS * 1000;
  return null;
}

/** Taklif (fe-27 §3): xato kodda qolgan urinishlar soni. */
const wrongCode = (account: MockTwoFactorAccount, message: string) =>
  fail(401, 'UNAUTHENTICATED', message, undefined, { attemptsLeft: Math.max(0, TWO_FACTOR_MAX_FAILED - account.failed) });

function checkCode(account: MockTwoFactorAccount, code: string) {
  const blocked = reserveAttempt(account);
  if (blocked) return blocked;
  const step = verifyTotp(account.secret ?? '', code);
  // Backend: shu yoki eski oraliq kodi qayta ishlatilsa ham «noto'g'ri».
  if (step === null || (account.lastStep !== null && step <= account.lastStep)) return wrongCode(account, '2FA kodi noto‘g‘ri');
  return step;
}

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { phone?: unknown; password?: unknown };
    const user = typeof body.phone === 'string' ? findMockUser(body.phone) : null;
    if (!user || user.isDeleted || typeof body.password !== 'string' || !body.password || body.password === MOCK_WRONG_PASSWORD) {
      if (user) recordMockLogin(user, request, 'WRONG_PASSWORD', 'PASSWORD');
      return fail(401, 'UNAUTHENTICATED', 'Telefon yoki parol xato');
    }
    // Backend: parol to'g'ri bo'lgach — bloklangan hisob kirmaydi. Taklif (fe-15 §14–15): nofaol ham; `errorCode` va tafsilot.
    const locked = accountLockResponse(user);
    if (locked) {
      recordMockLogin(user, request, 'BLOCKED', 'PASSWORD');
      return locked;
    }
    // BE-26: `ADMIN_2FA=on` — admin, superadmin va moliya sessiya o'rniga 2FA bosqichini oladi (cookie yozilmaydi).
    if (db.twoFactor.enabled && TWO_FACTOR_ROLES.includes(user.role)) return ok(challengeFor(user));
    recordMockLogin(user, request, 'SUCCESS', 'PASSWORD');
    return ok({ accessToken: mockTokenFor(user) }, 200, { 'Set-Cookie': sessionCookie(user) });
  }),

  // BE-26: QR uchun sir — faqat 2FA hali ulanmagan bo'lsa.
  http.post(`${API}/auth/2fa/setup`, async ({ request }) => {
    const subject = await challengeSubject(request);
    if ('error' in subject) return subject.error;
    if (subject.account.enabledAt) return fail(409, 'CONFLICT', '2FA allaqachon ulangan');
    subject.account.secret = MOCK_SETUP_SECRET;
    const label = encodeURIComponent(`Elchi Marketplace:${subject.user.phone}`);
    return ok({ secret: MOCK_SETUP_SECRET, otpauthUrl: `otpauth://totp/${label}?secret=${MOCK_SETUP_SECRET}&issuer=Elchi%20Marketplace&algorithm=SHA1&digits=6&period=30` });
  }),

  // BE-26: birinchi kod bilan yoqish → bir martalik zaxira kodlar (faqat shu javobda) va sessiya.
  http.post(`${API}/auth/2fa/enable`, async ({ request }) => {
    const subject = await challengeSubject(request);
    if ('error' in subject) return subject.error;
    const { account, user, body } = subject;
    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) return fail(400, 'VALIDATION_ERROR', 'Kod 6 raqam', undefined, { details: [{ field: 'code', error: 'Kod 6 raqam' }] });
    if (account.enabledAt) return fail(409, 'CONFLICT', '2FA allaqachon ulangan');
    if (!account.secret) return fail(400, 'VALIDATION_ERROR', 'Avval 2FA ni ulang (QR)');
    const step = checkCode(account, body.code);
    if (typeof step !== 'number') return step;
    Object.assign(account, { enabledAt: new Date().toISOString(), lastStep: step, recovery: [...MOCK_NEW_RECOVERY_CODES], failed: 0, blockedUntil: null, reset: null });
    db.twoFactor.challenges.delete(subject.token);
    recordMockLogin(user, request, 'SUCCESS', 'PASSWORD_CODE');
    return ok({ recoveryCodes: [...MOCK_NEW_RECOVERY_CODES], accessToken: mockTokenFor(user) }, 200, { 'Set-Cookie': sessionCookie(user) });
  }),

  // BE-26: kirish — ilovadagi kod yoki bir martalik zaxira kod (3 xato → 15 daqiqa blok, 423).
  http.post(`${API}/auth/2fa/verify`, async ({ request }) => {
    const subject = await challengeSubject(request);
    if ('error' in subject) return subject.error;
    const { account, user, body } = subject;
    if (body.code !== undefined && (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))) return fail(400, 'VALIDATION_ERROR', 'Kod 6 raqam', undefined, { details: [{ field: 'code', error: 'Kod 6 raqam' }] });
    if (!account.enabledAt || !account.secret) return fail(400, 'VALIDATION_ERROR', '2FA ulanmagan — avval ulang');
    if (typeof body.recoveryCode === 'string' && body.recoveryCode) {
      const blocked = reserveAttempt(account);
      if (blocked) return blocked;
      // Backend kodni aynan kelganidek HMAC qiladi — tire, bo'shliq yoki kichik harf mos kelmaydi.
      const index = account.recovery.indexOf(body.recoveryCode);
      if (index < 0) {
        recordMockLogin(user, request, 'WRONG_CODE', 'RECOVERY_CODE');
        return wrongCode(account, 'Tiklash kodi noto‘g‘ri');
      }
      account.recovery.splice(index, 1);
      Object.assign(account, { failed: 0, blockedUntil: null });
    } else {
      const step = checkCode(account, typeof body.code === 'string' ? body.code : '');
      if (typeof step !== 'number') {
        recordMockLogin(user, request, 'WRONG_CODE', 'PASSWORD_CODE');
        return step;
      }
      Object.assign(account, { lastStep: step, failed: 0, blockedUntil: null });
    }
    db.twoFactor.challenges.delete(subject.token);
    recordMockLogin(user, request, 'SUCCESS', typeof body.recoveryCode === 'string' && body.recoveryCode ? 'RECOVERY_CODE' : 'PASSWORD_CODE');
    return ok({ accessToken: mockTokenFor(user) }, 200, { 'Set-Cookie': sessionCookie(user) });
  }),

  http.get(`${API}/auth/me`, ({ request, cookies }) => {
    const user = currentMockUser(request, cookies);
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Token bekor qilingan, qayta tizimga kiring');
    // Backend `CurrentUserDto`: hisob maydonlari va `totpEnabledAt` (karta ma'lumoti va sessiya avlodi — mock ichki holati).
    const { id, role, name, phone, email, avatarUrl, isActive, isDeleted, isBlocked, authVersion, staff } = user;
    const supervisorName = role === 'OPERATOR_LEAD' ? supervisorNameOf(user) : null;
    return ok({
      id, role, name, phone, email, avatarUrl, isActive, isDeleted, isBlocked, authVersion,
      firstName: staff?.firstName ?? null, lastName: staff?.lastName ?? null, totpEnabledAt: db.twoFactor.accounts[digitsOf(phone)]?.enabledAt ?? null,
      // Taklif (fe-15 §15): oxirgi rol o'zgarishi va operator jamoasi — «Rolingiz o‘zgardi» sahifasi.
      roleChange: user.lastRoleChange ?? null,
      team: supervisorName ? { id: staff?.teamId, supervisorName } : null,
    });
  }),

  // Backend: bloklangan — «Hisob faol emas»; sessiyalar bekor qilingan (rol, 2FA tiklash) — «Sessiya bekor qilingan».
  // Taklif (fe-15 §15): bloklangan yoki nofaol — sessiya bekor qilingan bo'lsa ham `ACCOUNT_*` va tafsilot.
  http.post(`${API}/auth/refresh`, ({ cookies }) => {
    const session = sessionFromCookie(cookies[SESSION_COOKIE]);
    if (!session) return fail(401, 'UNAUTHENTICATED', 'Refresh token topilmadi');
    const locked = accountLockResponse(session.account);
    if (locked) return locked;
    if (session.revoked) return fail(401, 'UNAUTHENTICATED', 'Sessiya bekor qilingan');
    return ok({ accessToken: mockTokenFor(session.account) }, 200, { 'Set-Cookie': sessionCookie(session.account) });
  }),

  // Backend chiqishda foydalanuvchining hamma refresh sessiyasini bekor qiladi; mock — shu brauzer sessiyasi.
  http.post(`${API}/auth/logout`, ({ request, cookies }) => {
    const user = currentMockUser(request, cookies) ?? sessionFromCookie(cookies[SESSION_COOKIE])?.account;
    if (user?.staff) user.staff.sessions = user.staff.sessions.filter((item) => !item.live);
    return ok(null, 200, { 'Set-Cookie': clearedCookie });
  }),

  http.get(`${API}/auth/sessions`, ({ request, cookies }) => {
    if (!currentMockUser(request, cookies)) return fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
    return ok([{ id: 's-1', userAgent: request.headers.get('user-agent') ?? 'Brauzer', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(), current: true }]);
  }),
];
