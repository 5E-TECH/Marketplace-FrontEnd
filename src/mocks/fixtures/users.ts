/**
 * Mock foydalanuvchilar: 8 rol (BE-05) + tanilmagan eski rol. Dev rejimida login
 * telefon raqami bilan (+998 dan keyin), parol — istalgan; `xato` — noto'g'ri parol.
 * E2E ham shu ro'yxatdan foydalanadi (`tests/e2e/support/auth.ts` → `roleUsers`).
 */
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
  // Backend hali eski rolni qaytarsa (BE-05 gacha) — «Ish joyi topilmadi» holati.
  '900000009': { ...base, id: 'U-2087', role: 'SELLER', name: 'Laylo Nazarova', phone: '+998900000009' },
} as const;

export type MockPhone = keyof typeof MOCK_USERS;
export type MockUser = (typeof MOCK_USERS)[MockPhone];

export function findMockUser(phoneOrDigits: string): MockUser | null {
  const digits = phoneOrDigits.replace(/\D/g, '').slice(-9);
  return digits in MOCK_USERS ? MOCK_USERS[digits as MockPhone] : null;
}

export function mockUserByRole(role: MockUser['role']): MockUser {
  const user = Object.values(MOCK_USERS).find((item) => item.role === role);
  if (!user) throw new Error(`Mock foydalanuvchi yo'q: ${role}`);
  return user;
}

/** Mock token: `mock.<telefonning 9 raqami>` — backend tokeni kabi bo'shliqsiz. */
export const mockTokenFor = (user: MockUser) => `mock.${user.phone.slice(-9)}`;

export function userFromMockToken(token: string | null): MockUser | null {
  return token?.startsWith('mock.') ? findMockUser(token.slice(5)) : null;
}
