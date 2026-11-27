/**
 * Mock foydalanuvchilar: 8 rol (BE-05) + tanilmagan eski rol. Dev rejimida login
 * telefon raqami bilan (+998 dan keyin), parol — istalgan; `xato` — noto'g'ri parol.
 * E2E ham shu ro'yxatdan foydalanadi (`tests/e2e/support/auth.ts` → `roleUsers`).
 */
import { MOCK_AFFILIATES } from '../orderStore';
import { EXTRA_SELLER_ACCOUNTS, sellerInfoFor, type MockSellerInfo } from './sellers';
import { deviceOf, EXTRA_STAFF_ACCOUNTS, staffInfoFor, type MockLoginMethod, type MockLoginOutcome, type MockStaffInfo } from './staff';

export const MOCK_WRONG_PASSWORD = 'xato';

const base = {
  email: null,
  avatarUrl: null,
  isActive: true,
  isDeleted: false,
  isBlocked: false,
} as const;

export const MOCK_USERS = {
  '900000001': { ...base, id: 'U-0001', role: 'AFFILIATE', name: 'Jasur Toshmatov', phone: '+998900000001' },
  '900000002': { ...base, id: 'U-0002', role: 'WHOLESALER', name: 'Namuna Savdo MChJ', phone: '+998900000002' },
  '900000003': { ...base, id: 'U-0003', role: 'OPERATOR_LEAD', name: 'Dilnoza Rahimova', phone: '+998900000003' },
  '900000004': { ...base, id: 'U-0004', role: 'SUPERVISOR', name: 'Rustam Qodirov', phone: '+998900000004' },
  '900000005': { ...base, id: 'U-0005', role: 'WAREHOUSE', name: 'Otabek Nurmatov', phone: '+998900000005' },
  '900000006': { ...base, id: 'U-0006', role: 'FINANCE', name: 'Gulnora Saidova', phone: '+998900000006' },
  '900000007': { ...base, id: 'U-0007', role: 'ADMIN', name: 'Nodira Karimova', phone: '+998900000007' },
  '900000008': { ...base, id: 'U-0008', role: 'SUPERADMIN', name: 'Akmal Sobirov', phone: '+998900000008' },
  // Ikkinchi sotuvchi (FE-04 namunasi): eski oferta 0.9 qabul qilingan, JShShIR rad etilgan — bannerlar.
  '900000010': { ...base, id: 'U-0010', role: 'AFFILIATE', name: 'Sevara Yusupova', phone: '+998900000010' },
  // Backend hali eski rolni qaytarsa (BE-05 gacha) — «Ish joyi topilmadi» holati.
  '900000009': { ...base, id: 'U-2087', role: 'SELLER', name: 'Laylo Nazarova', phone: '+998900000009' },
} as const;

export type MockPhone = keyof typeof MOCK_USERS;
export type MockUser = (typeof MOCK_USERS)[MockPhone];

/** Mock hisob: tayyor foydalanuvchilar, FE-15 qo'shimcha xodimlari va dev'da SMS bilan ro'yxatdan o'tgan sotuvchilar. */
export interface MockAccount {
  id: string;
  role: string;
  name: string;
  phone: string;
  email: null;
  avatarUrl: null;
  isActive: boolean;
  isDeleted: boolean;
  isBlocked: boolean;
  /** BE-05 `authVersion`: rol, blok, 2FA yoki parol tiklanganda +1 — eski access token keyingi so'rovda 401. */
  authVersion: number;
  /** Refresh sessiyalari avlodi: backend sessiyalarni bekor qilganda +1 — eski cookie bilan refresh 401. */
  sessionEpoch: number;
  /** Xodim kartasi (FE-15, taklif maydonlari); sotuvchi va optovikda yo'q. */
  staff?: MockStaffInfo;
  /** Sotuvchi hisobi (FE-15 «Sotuvchilar» yorlig'i, taklif maydonlari). */
  seller?: MockSellerInfo;
  /** Oxirgi rol o'zgarishi (taklif fe-15 §15: `/auth/me` `roleChange`). */
  lastRoleChange?: { before: string; after: string; at: string; by: { name: string; role: string } };
}

/** Ishlab turgan hisoblar (telefonning 9 raqami → hisob); `resetMockDb()` boshlang'ich holatga qaytaradi. */
const accounts = new Map<string, MockAccount>();
/** Sessiya davomida SMS bilan ro'yxatdan o'tgan sotuvchilar (FE-04, «Birinchi qadamlar»). */
const registered = new Set<string>();
let createdStaff = 0;

function seedAccounts(): void {
  accounts.clear();
  registered.clear();
  createdStaff = 0;
  for (const [digits, user] of Object.entries(MOCK_USERS)) {
    accounts.set(digits, { ...user, authVersion: 0, sessionEpoch: 0, staff: staffInfoFor(user.id), seller: sellerInfoFor(user.id) });
  }
  // FE-26 lid va buyurtma filtrlaridagi sotuvchilar (orderStore) — kirish hisobi ham bor.
  for (const { id, fullName } of MOCK_AFFILIATES) {
    const digits = `90${id.slice(-4)}000`;
    if (![...accounts.values()].some((account) => account.id === id)) {
      accounts.set(digits, { ...base, id, role: 'AFFILIATE', name: fullName, phone: `+998${digits}`, authVersion: 0, sessionEpoch: 0, seller: sellerInfoFor(id) });
    }
  }
  for (const { digits, id, firstName, lastName, blocked } of EXTRA_SELLER_ACCOUNTS) {
    accounts.set(digits, {
      ...base, id, role: 'AFFILIATE', name: `${firstName} ${lastName}`, phone: `+998${digits}`, isBlocked: blocked,
      authVersion: 0, sessionEpoch: 0, seller: sellerInfoFor(id),
    });
  }
  for (const { digits, id, role, firstName, lastName } of EXTRA_STAFF_ACCOUNTS) {
    const blocked = staffInfoFor(id)?.block != null;
    accounts.set(digits, {
      ...base, id, role, name: `${firstName} ${lastName}`, phone: `+998${digits}`, isBlocked: blocked,
      authVersion: 0, sessionEpoch: 0, staff: staffInfoFor(id),
    });
  }
}
seedAccounts();

export const digitsOf = (phoneOrDigits: string) => phoneOrDigits.replace(/\D/g, '').slice(-9);

export function findMockUser(phoneOrDigits: string): MockAccount | null {
  return accounts.get(digitsOf(phoneOrDigits)) ?? null;
}

export const findMockUserById = (id: string): MockAccount | null => [...accounts.values()].find((account) => account.id === id) ?? null;

/** Hamma hisob (o'chirilganlar ham) — admin ro'yxati filtrlaydi. */
export const allMockAccounts = (): MockAccount[] => [...accounts.values()];

export function registerMockAffiliate(phoneOrDigits: string): MockAccount {
  const digits = digitsOf(phoneOrDigits);
  const account: MockAccount = {
    ...base, id: `U-${(3000 + registered.size + 1).toString()}`, role: 'AFFILIATE', name: '', phone: `+998${digits}`, authVersion: 0, sessionEpoch: 0,
  };
  registered.add(digits);
  accounts.set(digits, account);
  return account;
}

/** Admin qo'shgan xodim (`POST /admin/team`): ID dizayndagidek U-2088 dan; vaqtinchalik parol bilan, hali kirmagan. */
export function createMockStaff(input: { phone: string; role: string; firstName: string; lastName: string; createdBy: { id: string; name: string }; teamId: string | null; smsSent: boolean; workspace?: 'BROWSER' | 'SIP' }): MockAccount {
  const digits = digitsOf(input.phone);
  const now = new Date().toISOString();
  createdStaff += 1;
  const account: MockAccount = {
    ...base, id: `U-${(2087 + createdStaff).toString()}`, role: input.role, name: `${input.firstName} ${input.lastName}`.trim(),
    phone: `+998${digits}`, authVersion: 0, sessionEpoch: 0,
    staff: {
      firstName: input.firstName, lastName: input.lastName, createdAt: now, createdBy: input.createdBy, lastLoginAt: null, passwordSetAt: null,
      temporaryPassword: { issuedAt: now, smsSentAt: input.smsSent ? now : null }, block: null, teamId: input.teamId, sessions: [], logins: [],
      workspace: input.workspace ?? 'BROWSER', pendingWorkspace: null, softphoneConnected: false, inactive: null, request: null,
    },
  };
  accounts.set(digits, account);
  return account;
}

/** Backend sessiyalarni bekor qiladi (rol, 2FA yoki parol tiklash, «Hammasini tugatish»): eski cookie ishlamaydi. */
export function revokeMockSessions(account: MockAccount): void {
  account.sessionEpoch += 1;
  if (account.staff) account.staff.sessions = [];
}

/** Kirish natijasi — kirishlar tarixi va oxirgi kirish (taklif maydonlari); muvaffaqiyatda sessiya qatori. */
export function recordMockLogin(account: MockAccount, request: Request, outcome: MockLoginOutcome, method: MockLoginMethod): void {
  const { staff, seller } = account;
  if (seller && outcome === 'SUCCESS') seller.lastLoginAt = new Date().toISOString();
  if (!staff) return;
  const at = new Date().toISOString();
  const device = deviceOf(request.headers.get('user-agent'));
  staff.logins.unshift({ at, outcome, method, ...device, ip: '127.0.0.1' });
  if (outcome !== 'SUCCESS') return;
  staff.lastLoginAt = at;
  staff.temporaryPassword = null;
  staff.sessions = [{ id: `S-live-${Date.now().toString(36)}`, ...device, ip: '127.0.0.1', createdAt: at, lastSeenAt: at, live: true }, ...staff.sessions.filter((item) => !item.live)];
}

/** Dev'da hozirgina ro'yxatdan o'tgan sotuvchi — sahifasi va statistikasi yo'q («Birinchi qadamlar»). */
export const isNewMockAccount = (account: Pick<MockAccount, 'phone'>) => registered.has(digitsOf(account.phone));

export function resetRegisteredMockAccounts(): void {
  seedAccounts();
}

export function mockUserByRole(role: MockUser['role']): MockUser {
  const user = Object.values(MOCK_USERS).find((item) => item.role === role);
  if (!user) throw new Error(`Mock foydalanuvchi yo'q: ${role}`);
  return user;
}

/**
 * Mock token: `mock.<telefonning 9 raqami>` (backend tokeni kabi bo'shliqsiz); hisob `authVersion` i oshgan bo'lsa
 * `.<versiya>` qo'shiladi — rol yoki blokdan oldingi token yaroqsiz (backend `CurrentRoleGuard`).
 */
export function mockTokenFor(user: Pick<MockAccount, 'phone'>): string {
  const digits = user.phone.slice(-9);
  const version = accounts.get(digits)?.authVersion ?? 0;
  return version ? `mock.${digits}.${version.toString()}` : `mock.${digits}`;
}

/** Token egasi; bloklangan, o'chirilgan yoki versiyasi eskirgan bo'lsa — null (backend: 401 «Token bekor qilingan»). */
export function userFromMockToken(token: string | null): MockAccount | null {
  const match = /^mock\.(\d{9})(?:\.(\d+))?$/.exec(token ?? '');
  if (!match) return null;
  const account = accounts.get(match[1]);
  if (!account || account.isDeleted || account.isBlocked || !account.isActive || Number(match[2] ?? 0) !== account.authVersion) return null;
  return account;
}
