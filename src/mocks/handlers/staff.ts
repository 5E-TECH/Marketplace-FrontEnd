import { http } from 'msw';
import { db } from '../db';
import { mockOperatorStats, type MockAuditEntry } from '../fixtures/staff';
import { freshTwoFactorAccount } from '../fixtures/twoFactor';
import { allMockAccounts, createMockStaff, digitsOf, findMockUser, findMockUserById, mockTokenFor, revokeMockSessions, type MockAccount } from '../fixtures/users';
import { MOCK_OPERATORS } from '../orderStore';
import { API, fail, ok, pageOf } from '../utils';
import { currentMockUser } from './auth';
import { mockQueueOperator } from './operator';

/**
 * Foydalanuvchilar va xodimlar (FE-15): backend `/admin/users`, `/admin/team` (BE-05, BE-26, BE-27) va taklif
 * endpointlari — docs/api-taklif/fe-15-admin-foydalanuvchilar.md. Mock taklif bo'yicha ishlaydi (masalan, admin ham
 * xodim qo'shadi va rol beradi); backenddagi hozirgi farq hujjatda.
 */
const KNOWN_ROLES = ['AFFILIATE', 'WHOLESALER', 'OPERATOR_LEAD', 'SUPERVISOR', 'WAREHOUSE', 'FINANCE', 'ADMIN', 'SUPERADMIN'];
const STAFF_ROLES = ['OPERATOR_LEAD', 'SUPERVISOR', 'WAREHOUSE', 'FINANCE', 'ADMIN', 'SUPERADMIN'];
const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];
/** Bu rollar hisobini faqat superadmin boshqaradi (blok, rol); parolini ham — 13-qaror [taklif]. */
const PRIVILEGED = ['ADMIN', 'SUPERADMIN'];
export const PHONE = /^\+998\d{9}$/;
const SANCTIONS = ['NONE', 'WARNING', 'HOLD'];
/** Oxirgi kirish bo'yicha kamayish; hali kirmaganlar oxirida. */
const byLastLogin = (a: { lastLoginAt?: string | null; createdAt: string }, b: { lastLoginAt?: string | null; createdAt: string }) => (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '') || b.createdAt.localeCompare(a.createdAt);
const MOCK_IP = '127.0.0.1';
const IMPERSONATABLE = ['AFFILIATE', 'WHOLESALER'];
const IMPERSONATION_TTL = 900;

type Actor = { actor: MockAccount; denied?: undefined } | { actor?: undefined; denied: Response };

export function guard(request: Request, cookies: Record<string, string>, roles: readonly string[] = ADMIN_ROLES): Actor {
  const actor = currentMockUser(request, cookies);
  if (!actor) return { denied: fail(401, 'UNAUTHENTICATED', 'Token bekor qilingan, qayta tizimga kiring') };
  if (!roles.includes(actor.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu amal uchun ruxsat yetarli emas') };
  return { actor };
}

export const invalid = (field: string, message: string) => fail(400, 'VALIDATION_ERROR', message, undefined, { details: [{ field, error: message }] });

export function audit(actor: MockAccount, action: string, target: MockAccount, meta: Record<string, unknown> = {}) {
  const entry: MockAuditEntry = {
    id: `UA-${Date.now().toString(36)}-${db.userAudit.length.toString()}`, createdAt: new Date().toISOString(),
    actorId: actor.id, actorName: actor.name, action, entityType: 'User', entityId: target.id, meta: { ip: MOCK_IP, ...meta },
  };
  db.userAudit.unshift(entry);
}

function teamView(teamId: string | null) {
  const team = teamId ? db.teams.find((item) => item.id === teamId) : undefined;
  if (!team) return null;
  return { id: team.id, supervisorId: team.supervisorId, supervisorName: findMockUserById(team.supervisorId)?.name ?? '' };
}

/** Sotuvchi: taklif maydonlari (fe-15 §11) — oxirgi kirish, sahifalar (blokda hammasi to'xtaydi), jazo, blok. */
function sellerView(account: MockAccount) {
  const { seller } = account;
  if (!seller) return {};
  const streams = seller.codes.length;
  return {
    lastLoginAt: seller.lastLoginAt, affiliate: { streams, stoppedStreams: account.isBlocked ? streams : 0 },
    sanction: account.isBlocked ? null : seller.sanction, block: account.isBlocked ? seller.block : null,
  };
}

/** `AdminUserDto` (backend) + taklif maydonlari (oxirgi kirish, kim qo'shgan, blok, 2FA tiklash, jamoa). */
export function view(account: MockAccount) {
  const tfa = db.twoFactor.accounts[digitsOf(account.phone)];
  const { staff } = account;
  const [first = '', ...rest] = account.name.split(' ');
  const createdAt = staff?.createdAt ?? '2026-11-01T08:00:00.000Z';
  return {
    id: account.id, role: account.role, name: account.name, firstName: staff?.firstName ?? first, lastName: staff?.lastName ?? rest.join(' '),
    phone: account.phone, email: null, avatarUrl: null, isActive: account.isActive, isBlocked: account.isBlocked, isDeleted: account.isDeleted,
    authVersion: account.authVersion, totpEnabledAt: tfa?.enabledAt ?? null, createdAt, updatedAt: createdAt,
    ...(staff ? {
      lastLoginAt: staff.lastLoginAt, createdBy: staff.createdBy, passwordSetAt: staff.passwordSetAt, temporaryPassword: staff.temporaryPassword,
      block: staff.block, twoFactorReset: tfa && !tfa.enabledAt ? tfa.reset : null, team: teamView(staff.teamId),
    } : {}),
    ...sellerView(account),
  };
}

/** `PATCH …/role` va `POST /admin/team` qisqa javobi (backend). */
const shortView = (account: MockAccount) => ({
  id: account.id, name: account.name, phone: account.phone, email: null, role: account.role, isActive: account.isActive, isBlocked: account.isBlocked,
  createdAt: account.staff?.createdAt ?? '2026-11-01T08:00:00.000Z', updatedAt: new Date().toISOString(),
});

export const randomPassword = () => Array.from({ length: 16 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[Math.floor(Math.random() * 56)]).join('');

export function targetOf(id: unknown): MockAccount | null {
  const account = typeof id === 'string' ? findMockUserById(id) : null;
  return account && !account.isDeleted ? account : null;
}

const superadminsLeft = () => allMockAccounts().filter((item) => item.role === 'SUPERADMIN' && !item.isDeleted && !item.isBlocked).length;

/** Backend `authVersion`+1: eski access token keyingi so'rovda 401 (blok, rol, tiklash). */
export const bumpAuth = (account: MockAccount) => { account.authVersion += 1; };


/** Operator jonli holati (queue-summary bilan bir xil); ro'yxatda yo'q — oflayn. */
export const liveOf = (id: string) => {
  const item = MOCK_OPERATORS.find((operator) => operator.id === id);
  return item ? mockQueueOperator(item) : null;
};
export const IN_CALL = ['CONNECTING', 'RINGING', 'IN_CALL', 'WRAP_UP'];
const softphoneAccount = (id: string) => id.replace(/^U-/, '');

/** Taklif §13: softfon hisobi — raqam operator ID sidan; holat — server ro'yxati (blokda o'chiriladi). */
export function softphoneView(account: MockAccount) {
  const live = liveOf(account.id);
  const registered = !account.isBlocked && account.isActive && live !== null && live.state !== 'OFFLINE';
  return {
    operatorId: account.id, account: softphoneAccount(account.id),
    status: account.isBlocked || !account.isActive ? 'DISABLED' : registered ? 'REGISTERED' : 'UNREGISTERED',
    since: registered ? live.since : null,
    workspace: account.staff?.workspace ?? 'BROWSER',
    neverConnected: !(account.staff?.softphoneConnected ?? false),
    pendingWorkspace: account.staff?.pendingWorkspace ?? null,
  };
}

const operatorsOf = () => allMockAccounts().filter((account) => account.role === 'OPERATOR_LEAD' && !account.isDeleted);
const teamDto = (team: { id: string; supervisorId: string; createdAt: string }) => ({
  id: team.id, supervisor: { id: team.supervisorId, name: findMockUserById(team.supervisorId)?.name ?? '' }, createdAt: team.createdAt,
  operatorCount: operatorsOf().filter((account) => account.staff?.teamId === team.id).length,
});

export const staffHandlers = [
  // Backend: `role` (bitta), `blocked`, `search` (ism yoki telefon), sahifa ≤ 100; SUPERADMIN ro'yxatda yashirin.
  // Taklif: `role=SUPERADMIN` so'ralsa — ko'rsatiladi; `unknownRole=true` — roli noma'lum hisoblar; qidiruv ID va sotuvchi
  // sahifa kodi bo'yicha ham; `sanction` (NONE | WARNING | HOLD) — sotuvchi jazosi; sotuvchilar oxirgi kirish bo'yicha.
  http.get(`${API}/admin/users`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const blocked = url.searchParams.get('blocked');
    const search = url.searchParams.get('search')?.trim().toLowerCase().replace(/^\+/, '') ?? '';
    const unknownRole = url.searchParams.get('unknownRole') === 'true';
    const sanction = url.searchParams.get('sanction');
    if (role && !KNOWN_ROLES.includes(role)) return invalid('role', `role must be one of the following values: ${KNOWN_ROLES.join(', ')}`);
    if (sanction !== null && !SANCTIONS.includes(sanction)) return invalid('sanction', `sanction must be one of the following values: ${SANCTIONS.join(', ')}`);
    const accounts = allMockAccounts().filter((account) => !account.isDeleted)
      .filter((account) => (unknownRole ? !KNOWN_ROLES.includes(account.role) : KNOWN_ROLES.includes(account.role)))
      .filter((account) => (role ? account.role === role : unknownRole || account.role !== 'SUPERADMIN'))
      .filter((account) => blocked === null || account.isBlocked === (blocked === 'true'))
      .filter((account) => !search || [account.name, account.phone.replace(/\D/g, ''), account.id, ...(account.seller?.codes ?? [])].some((value) => value.toLowerCase().includes(search)));
    const rows = accounts.map(view)
      .filter((row) => sanction === null || (('sanction' in row && row.sanction?.kind) || 'NONE') === sanction)
      .sort(role === 'AFFILIATE' ? byLastLogin : (a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(pageOf(rows, url));
  }),

  // Backend: topilmasa — 409 CONFLICT (404 emas).
  http.get(`${API}/admin/users/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const account = targetOf(params.id);
    return account ? ok(view(account)) : fail(409, 'CONFLICT', 'Foydalanuvchi topilmadi');
  }),

  // Backend: faqat SUPERADMIN; `{name, phone, role, password?}` → 201 + `temporaryPassword` (SMS yo'q).
  // Taklif: ADMIN ham (superadmin rolidan boshqa), `firstName`/`lastName`, operatorga `teamId`, SMS yuboriladi (`smsSent`),
  // band raqamda — kimniki (`existingUser`).
  http.post(`${API}/admin/team`, async ({ request, cookies }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 255) return invalid('name', 'name 1–255 belgi bo‘lishi kerak');
    if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return invalid('phone', 'phone +998XXXXXXXXX formatida bo\'lishi kerak');
    if (typeof body.role !== 'string' || !STAFF_ROLES.includes(body.role)) return invalid('role', 'Jamoa roli OPERATOR_LEAD, SUPERVISOR, WAREHOUSE, FINANCE, ADMIN, SUPERADMIN dan biri bo‘lishi kerak');
    if (body.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') return fail(403, 'FORBIDDEN', 'Superadmin rolini faqat superadmin beradi');
    const teamId = body.role === 'OPERATOR_LEAD' && typeof body.teamId === 'string' ? body.teamId : null;
    if (teamId && !db.teams.some((team) => team.id === teamId)) return invalid('teamId', 'Jamoa topilmadi');
    const existing = findMockUser(body.phone);
    if (existing) return fail(409, 'CONFLICT', 'Bu telefon allaqachon ro‘yxatdan o‘tgan', undefined, { existingUser: { id: existing.id, name: existing.name } });
    const [first = name, ...rest] = name.split(' ');
    const workspace = body.workspace === 'SIP' ? 'SIP' : 'BROWSER';
    const account = createMockStaff({
      phone: body.phone, role: body.role, firstName: firstName || first, lastName: lastName || rest.join(' '),
      createdBy: { id: actor.id, name: actor.name }, teamId, smsSent: true, workspace,
    });
    audit(actor, 'admin.team.create', account, { before: null, after: { id: account.id, name: account.name, phone: account.phone, role: account.role } });
    return ok({ ...shortView(account), temporaryPassword: randomPassword(), smsSent: true }, 201);
  }),

  // Backend: faqat SUPERADMIN, istalgan rol; o'zgarsa authVersion+1, sessiyalar bekor, audit {before, after}.
  // Taklif: ADMIN ham — admin va superadmin bo'lmagan xodimga, superadmin rolisiz; o'z roli emas; operatorga `teamId`.
  http.patch(`${API}/admin/users/:id/role`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    const body = (await request.json().catch(() => ({}))) as { role?: unknown; teamId?: unknown };
    if (typeof body.role !== 'string' || !KNOWN_ROLES.includes(body.role)) return invalid('role', 'role must be a valid enum value');
    if (actor.role !== 'SUPERADMIN') {
      if (target.id === actor.id) return fail(403, 'FORBIDDEN', 'O‘z rolingizni o‘zgartira olmaysiz');
      if (PRIVILEGED.includes(target.role) || body.role === 'SUPERADMIN') return fail(403, 'FORBIDDEN', 'Superadmin va admin rolini faqat superadmin o‘zgartiradi');
    }
    if (target.role === 'SUPERADMIN' && body.role !== 'SUPERADMIN' && superadminsLeft() <= 1) return fail(409, 'CONFLICT', 'Oxirgi SUPERADMINni pasaytirib bo‘lmaydi');
    if (target.staff) target.staff.teamId = body.role === 'OPERATOR_LEAD' ? (typeof body.teamId === 'string' ? body.teamId : target.staff.teamId) : null;
    if (body.role !== target.role) {
      const before = target.role;
      target.role = body.role;
      // Taklif (fe-15 §15): `/auth/me` `roleChange` — qayta kirgan xodim «Rolingiz o‘zgardi» da kim, qachon ko'radi.
      target.lastRoleChange = { before, after: body.role, at: new Date().toISOString(), by: { name: actor.name, role: actor.role } };
      bumpAuth(target);
      revokeMockSessions(target);
      audit(actor, 'user.role.update', target, { before: { role: before }, after: { role: body.role } });
    }
    return ok(shortView(target));
  }),

  // Backend: tanasiz (sabab yo'q), 201; o'zini — 409; admin/superadminni faqat superadmin. Taklif: `reason`, blok
  // paytida sessiyalar ham bekor (backendda yo'q — blokdan chiqqach eski refresh qayta ishlaydi).
  ...(['block', 'unblock'] as const).map((action) => http.post(`${API}/admin/users/:id/${action}`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(409, 'CONFLICT', 'Foydalanuvchi topilmadi');
    const blocking = action === 'block';
    if (blocking && target.id === actor.id) return fail(409, 'CONFLICT', 'O‘zingizni bloklay olmaysiz');
    if (PRIVILEGED.includes(target.role) && actor.role !== 'SUPERADMIN') return fail(403, 'FORBIDDEN', 'Admin yoki superadmin hisobini faqat superadmin bloklaydi');
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
    target.isBlocked = blocking;
    bumpAuth(target);
    if (blocking) revokeMockSessions(target);
    const block = blocking ? { at: new Date().toISOString(), by: actor.name, reason } : null;
    if (target.staff) target.staff.block = block;
    if (target.seller) target.seller.block = block;
    // Nazoratchining bloklash / blokdan chiqarish so'rovi admin amali bilan yopiladi (taklif §14).
    if (target.staff) target.staff.request = null;
    audit(actor, blocking ? 'user.block' : 'user.unblock', target, reason ? { reason } : {});
    return ok(view(target), 201);
  })),

  // Backend (BE-05): faqat SUPERADMIN, faqat sotuvchi va optovik; o'zi — 409, faol bo'lmagan yoki bloklangan — 409;
  // 15 daqiqalik, refresh qilinmaydigan token; audit `user.impersonate`.
  http.post(`${API}/admin/users/:id/impersonate`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, ['SUPERADMIN']);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    if (target.id === actor.id) return fail(409, 'CONFLICT', 'O‘zingizning nomingizdan kirib bo‘lmaydi');
    if (!IMPERSONATABLE.includes(target.role)) return fail(403, 'FORBIDDEN', 'Faqat sotuvchi yoki optovik nomidan kirish mumkin');
    if (!target.isActive || target.isBlocked) return fail(409, 'CONFLICT', 'Faol bo‘lmagan hisob nomidan kirib bo‘lmaydi');
    const expiresAt = new Date(Date.now() + IMPERSONATION_TTL * 1000).toISOString();
    audit(actor, 'user.impersonate', target, { targetRole: target.role, durationSeconds: IMPERSONATION_TTL, expiresAt });
    return ok({ impersonationToken: mockTokenFor(target), expiresIn: IMPERSONATION_TTL, expiresAt, user: { id: target.id, name: target.name, role: target.role } });
  }),

  // BE-26: faqat superadmin; sir va zaxira kodlar o'chadi, hamma sessiya tugaydi. Taklif: `reason` auditga.
  http.post(`${API}/admin/users/:id/2fa/reset`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    if (actor.role !== 'SUPERADMIN') return fail(403, 'FORBIDDEN', '2FA ni faqat superadmin nolga tushiradi');
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    db.twoFactor.accounts[digitsOf(target.phone)] = { ...freshTwoFactorAccount(), reset: { by: actor.name, at: new Date().toISOString() } };
    bumpAuth(target);
    revokeMockSessions(target);
    audit(actor, 'user.2fa.reset', target, typeof body.reason === 'string' && body.reason.trim() ? { reason: body.reason.trim() } : {});
    return ok({ reset: true });
  }),

  // Taklif: admin xodim parolini tiklaydi — vaqtinchalik parol SMS bilan yoki adminga bir marta ko'rsatiladi.
  // Admin va superadmin parolini — superadmin (13-qaror [taklif]; dizaynda admin moliya parolini tiklaydi); o'z paroli —
  // «Mening profilim»da.
  http.post(`${API}/admin/users/:id/password/reset`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    if (target.id === actor.id) return fail(403, 'FORBIDDEN', 'O‘z parolingiz «Mening profilim»da almashtiriladi');
    if (PRIVILEGED.includes(target.role) && actor.role !== 'SUPERADMIN') return fail(403, 'FORBIDDEN', 'Bu xodim parolini faqat superadmin tiklaydi');
    const body = (await request.json().catch(() => ({}))) as { delivery?: unknown };
    if (body.delivery !== 'SMS' && body.delivery !== 'SHOW') return invalid('delivery', 'delivery SMS yoki SHOW bo‘lishi kerak');
    const now = new Date().toISOString();
    if (target.staff) target.staff.temporaryPassword = { issuedAt: now, smsSentAt: body.delivery === 'SMS' ? now : null };
    bumpAuth(target);
    revokeMockSessions(target);
    audit(actor, 'user.password.reset', target, { delivery: body.delivery });
    return ok({ temporaryPassword: body.delivery === 'SHOW' ? randomPassword() : null, smsSent: body.delivery === 'SMS' });
  }),

  // Taklif: hali kirmagan xodimga vaqtinchalik parol SMS ini qayta yuborish.
  http.post(`${API}/admin/users/:id/welcome-sms`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target?.staff) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    if (target.staff.lastLoginAt) return fail(409, 'CONFLICT', 'Xodim allaqachon kirgan — parolni tiklang');
    const sentAt = new Date().toISOString();
    target.staff.temporaryPassword = { issuedAt: target.staff.temporaryPassword?.issuedAt ?? sentAt, smsSentAt: sentAt };
    return ok({ sentAt });
  }),

  // Taklif: xodimning faol sessiyalari (qurilma, IP, kirgan va oxirgi faollik).
  http.get(`${API}/admin/users/:id/sessions`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    const items = (target.staff?.sessions ?? []).map(({ live, ...session }) => ({ ...session, current: live && target.id === actor.id }));
    return ok(items);
  }),

  // Taklif: bitta sessiyani yoki hammasini tugatish — keyingi so'rovda o'sha qurilma chiqadi.
  http.delete(`${API}/admin/users/:id/sessions/:sessionId`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    const session = target?.staff?.sessions.find((item) => item.id === params.sessionId);
    if (!target?.staff || !session) return fail(404, 'NOT_FOUND', 'Sessiya topilmadi');
    if (target.id === actor.id) return fail(403, 'FORBIDDEN', 'O‘z sessiyalaringiz «Mening profilim»da yopiladi');
    target.staff.sessions = target.staff.sessions.filter((item) => item.id !== session.id);
    if (session.live) {
      bumpAuth(target);
      target.sessionEpoch += 1;
    }
    audit(actor, 'user.session.revoke', target, { session: `${session.browser} · ${session.os}` });
    return ok({ id: session.id, revoked: true });
  }),
  http.delete(`${API}/admin/users/:id/sessions`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    if (target.id === actor.id) return fail(403, 'FORBIDDEN', 'O‘z sessiyalaringiz «Mening profilim»da yopiladi');
    bumpAuth(target);
    revokeMockSessions(target);
    audit(actor, 'user.session.revoke', target, { all: true });
    return ok({ revoked: true });
  }),

  // Taklif: kirishlar tarixi (oxirgi N ta: natija, usul, qurilma, IP).
  http.get(`${API}/admin/users/:id/logins`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 5));
    return ok((target.staff?.logins ?? []).slice(0, limit));
  }),

  // Taklif: operatorlar jamoalari — nazoratchi va operatorlar soni (admin-operatorlar-jamoasi).
  http.get(`${API}/admin/teams`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    return ok(db.teams.map(teamDto));
  }),

  // Taklif §13: jamoa — nazoratchi (SUPERVISOR, faol, hali jamoasi yo'q); nazoratchini almashtirish.
  ...(['create', 'update'] as const).map((mode) => (mode === 'create' ? http.post : http.patch)(`${API}/admin/teams${mode === 'create' ? '' : '/:id'}`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const team = mode === 'update' ? db.teams.find((item) => item.id === params.id) : null;
    if (mode === 'update' && !team) return fail(404, 'NOT_FOUND', 'Jamoa topilmadi');
    const body = (await request.json().catch(() => ({}))) as { supervisorId?: unknown };
    const supervisor = typeof body.supervisorId === 'string' ? targetOf(body.supervisorId) : null;
    if (!supervisor || supervisor.role !== 'SUPERVISOR' || supervisor.isBlocked) return invalid('supervisorId', 'Nazoratchi roli bor faol xodimni tanlang');
    if (db.teams.some((item) => item.supervisorId === supervisor.id && item.id !== team?.id)) return fail(409, 'CONFLICT', 'Bu nazoratchining jamoasi bor');
    const before = team ? { supervisorId: team.supervisorId } : null;
    const saved = team ?? { id: `T-${(db.teams.length + 1).toString()}`, supervisorId: supervisor.id, createdAt: new Date().toISOString() };
    saved.supervisorId = supervisor.id;
    if (!team) db.teams.push(saved);
    audit(actor, mode === 'create' ? 'team.create' : 'team.supervisor.update', supervisor, { teamId: saved.id, before, after: { supervisorId: supervisor.id } });
    return ok(teamDto(saved), mode === 'create' ? 201 : 200);
  })),

  // Taklif §13: operatorni jamoaga biriktirish (`teamId: null` — jamoadan chiqarish).
  http.patch(`${API}/admin/users/:id/team`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target) return fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    if (target.role !== 'OPERATOR_LEAD' || !target.staff) return invalid('teamId', 'Jamoaga faqat operator biriktiriladi');
    const body = (await request.json().catch(() => ({}))) as { teamId?: unknown };
    const teamId = typeof body.teamId === 'string' ? body.teamId : null;
    if (teamId && !db.teams.some((team) => team.id === teamId)) return invalid('teamId', 'Jamoa topilmadi');
    const before = target.staff.teamId;
    target.staff.teamId = teamId;
    audit(actor, 'user.team.update', target, { before: { teamId: before }, after: { teamId } });
    return ok(view(target));
  }),

  // Taklif §13: softfon hisoblari (ADMIN, SUPERADMIN).
  http.get(`${API}/admin/operators/softphones`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    return ok(operatorsOf().map(softphoneView));
  }),

  // Taklif §13: ish joyini almashtirish; suhbat paytida — suhbat tugagach kuchga kiradi.
  http.patch(`${API}/admin/operators/:id/softphone`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies);
    if (denied) return denied;
    const target = targetOf(params.id);
    if (!target?.staff || target.role !== 'OPERATOR_LEAD') return fail(404, 'NOT_FOUND', 'Operator topilmadi');
    const body = (await request.json().catch(() => ({}))) as { workspace?: unknown };
    if (body.workspace === 'APP') return invalid('workspace', 'Mobil ilova — 2-bosqich');
    if (body.workspace !== 'BROWSER' && body.workspace !== 'SIP') return invalid('workspace', 'workspace must be one of the following values: BROWSER, SIP');
    const before = target.staff.workspace;
    const busy = IN_CALL.includes(liveOf(target.id)?.activity?.kind ?? '');
    if (busy && body.workspace !== before) target.staff.pendingWorkspace = body.workspace;
    else {
      target.staff.workspace = body.workspace;
      target.staff.pendingWorkspace = null;
    }
    audit(actor, 'operator.softphone.update', target, { before: { workspace: before }, after: { workspace: body.workspace }, deferred: busy });
    return ok(softphoneView(target));
  }),

  // Taklif §13: operator ko'rsatkichlari davr bo'yicha (BE-13 `OperatorStatsDto` + `valid`).
  http.get(`${API}/admin/operators/stats`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return invalid('from', 'from va to — Toshkent sanasi');
    return ok(operatorsOf().map((account) => mockOperatorStats(account.id, from !== to)).filter(Boolean));
  }),
];
