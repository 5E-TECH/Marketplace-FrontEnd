/**
 * Xodimlar (FE-15; admin-foydalanuvchilar, admin-foydalanuvchi-karta): dizayn namunasidagi qo'shimcha xodimlar va
 * kartadagi ma'lumot. Backend `/admin/users` da yo'q maydonlar (oxirgi kirish, kim qo'shgan, blok sababi, jamoa,
 * sessiyalar, kirishlar tarixi) — taklif: docs/api-taklif/fe-15-admin-foydalanuvchilar.md.
 * Kirish hisoblari `users.ts` da (bu fayl uni import qilmaydi).
 */

export interface MockSession {
  id: string;
  browser: string;
  os: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  /** Haqiqiy mock kirishda ochilgan sessiya (brauzer cookie'si) — tugatilsa shu brauzer chiqadi. */
  live: boolean;
}

export type MockLoginOutcome = 'SUCCESS' | 'WRONG_PASSWORD' | 'WRONG_CODE' | 'BLOCKED';
export type MockLoginMethod = 'PASSWORD' | 'PASSWORD_CODE' | 'RECOVERY_CODE' | 'SMS';

export interface MockLogin {
  at: string;
  outcome: MockLoginOutcome;
  method: MockLoginMethod;
  browser: string;
  os: string;
  ip: string;
}

export interface MockStaffInfo {
  firstName: string;
  lastName: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  /** null — hisob ochilgan, lekin hali kirilmagan («Hali kirmagan»). */
  lastLoginAt: string | null;
  passwordSetAt: string | null;
  /** Vaqtinchalik parol amalda (birinchi kirishgacha yoki admin tiklagach). */
  temporaryPassword: { issuedAt: string; smsSentAt: string | null } | null;
  block: { at: string; by: string; reason: string | null } | null;
  teamId: string | null;
  sessions: MockSession[];
  logins: MockLogin[];
  /** Operator ish joyi (taklif §13): softfon hisobi shu bilan; suhbat paytida o'zgarsa — `pendingWorkspace`. */
  workspace: 'BROWSER' | 'SIP';
  pendingWorkspace: 'BROWSER' | 'SIP' | null;
  /** Softfon kamida bir marta serverga ulangan (yangi operator — «birinchi kirishda ulanadi»). */
  softphoneConnected: boolean;
  /** Nazoratchi nofaol qilgan (taklif §14): qachon, kim, sabab. */
  inactive: { at: string; by: string; reason: string } | null;
  /** Nazoratchining admin'ga so'rovi: bloklash yoki blokdan chiqarish (javob kutilmoqda). */
  request: { kind: 'BLOCK' | 'UNBLOCK'; at: string; by: string; reason: string } | null;
}

export interface MockTeam {
  id: string;
  supervisorId: string;
  createdAt: string;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => minutesAgo(days * 24 * 60);

const AKMAL = { id: 'U-0008', name: 'Akmal Sobirov' };
const NODIRA = { id: 'U-0007', name: 'Nodira Karimova' };

/** Dizayndagi «Faol sessiyalar»: Chrome · Windows va Safari · iPhone (admin-foydalanuvchi-karta). */
const desk = (lastSeenMinutes: number, loginMinutes = lastSeenMinutes): MockSession => ({
  id: `S-${lastSeenMinutes}-${loginMinutes}`, browser: 'Chrome', os: 'Windows', ip: '203.0.113.31',
  createdAt: minutesAgo(loginMinutes), lastSeenAt: minutesAgo(lastSeenMinutes), live: false,
});
const phone = (lastSeenMinutes: number): MockSession => ({
  id: `S-p${lastSeenMinutes}`, browser: 'Safari', os: 'iPhone', ip: '198.51.100.58',
  createdAt: minutesAgo(lastSeenMinutes + 600), lastSeenAt: minutesAgo(lastSeenMinutes), live: false,
});

const login = (minutes: number, method: MockLoginMethod, outcome: MockLoginOutcome = 'SUCCESS'): MockLogin => ({
  at: minutesAgo(minutes), outcome, method, browser: 'Chrome', os: 'Windows', ip: '203.0.113.31',
});

interface StaffSeed {
  firstName: string;
  lastName: string;
  createdDays: number;
  createdBy: { id: string; name: string } | null;
  /** null — hali kirmagan. */
  lastLoginMinutes: number | null;
  sessions?: MockSession[];
  logins?: MockLogin[];
  block?: MockStaffInfo['block'];
  teamId?: string;
  workspace?: 'BROWSER' | 'SIP';
}

/** Kirish hisobi `users.ts` da; bu — qo'shimcha xodimlar (telefon 9 raqam → hisob). */
export const EXTRA_STAFF_ACCOUNTS = [
  { digits: '911001009', id: 'U-1009', role: 'FINANCE', firstName: 'Ozoda', lastName: 'Botirova' },
  { digits: '911001053', id: 'U-1053', role: 'OPERATOR_LEAD', firstName: 'Jamshid', lastName: 'Eshonqulov' },
  { digits: '911001054', id: 'U-1054', role: 'OPERATOR_LEAD', firstName: 'Lola', lastName: 'Azimova' },
  { digits: '911001055', id: 'U-1055', role: 'OPERATOR_LEAD', firstName: 'Marjona', lastName: 'Ismoilova' },
  { digits: '911001056', id: 'U-1056', role: 'OPERATOR_LEAD', firstName: 'Sardor', lastName: 'Toshpo‘latov' },
  { digits: '911001057', id: 'U-1057', role: 'OPERATOR_LEAD', firstName: 'Sabina', lastName: 'Xolmatova' },
  { digits: '911001058', id: 'U-1058', role: 'OPERATOR_LEAD', firstName: 'Bekzod', lastName: 'Aliyev' },
  { digits: '911001059', id: 'U-1059', role: 'OPERATOR_LEAD', firstName: 'Shohruh', lastName: 'Mirzayev' },
  { digits: '911001060', id: 'U-1060', role: 'OPERATOR_LEAD', firstName: 'Nilufar', lastName: 'Sodiqova' },
  { digits: '911001061', id: 'U-1061', role: 'OPERATOR_LEAD', firstName: 'Umida', lastName: 'Sobirova' },
  { digits: '911001062', id: 'U-1062', role: 'OPERATOR_LEAD', firstName: 'Temur', lastName: 'Komilov' },
  { digits: '911001066', id: 'U-1066', role: 'OPERATOR_LEAD', firstName: 'Feruza', lastName: 'Yo‘ldosheva' },
  { digits: '911001078', id: 'U-1078', role: 'OPERATOR_LEAD', firstName: 'Kamron', lastName: 'Davletov' },
] as const;

/** Mock jamoa: nazoratchi Rustam Qodirov (U-0004) va hamma operator (admin-operatorlar-jamoasi). */
export const MOCK_TEAM_ID = 'T-1';
export const mockTeams = (): MockTeam[] => [{ id: MOCK_TEAM_ID, supervisorId: 'U-0004', createdAt: daysAgo(60) }];

const operator = (firstName: string, lastName: string, lastLoginMinutes: number | null, extra: Partial<StaffSeed> = {}): StaffSeed => ({
  firstName, lastName, createdDays: 45, createdBy: NODIRA, lastLoginMinutes, teamId: MOCK_TEAM_ID,
  sessions: lastLoginMinutes !== null && lastLoginMinutes < 720 ? [desk(3, lastLoginMinutes)] : [],
  logins: lastLoginMinutes !== null ? [login(lastLoginMinutes, 'PASSWORD')] : [],
  ...extra,
});

const SEEDS: Record<string, StaffSeed> = {
  'U-0008': {
    firstName: 'Akmal', lastName: 'Sobirov', createdDays: 120, createdBy: null, lastLoginMinutes: 20,
    sessions: [desk(1, 20)], logins: [login(20, 'PASSWORD_CODE')],
  },
  'U-0007': {
    firstName: 'Nodira', lastName: 'Karimova', createdDays: 90, createdBy: AKMAL, lastLoginMinutes: 300,
    sessions: [desk(0, 300), phone(900), { ...desk(2400), id: 'S-mac', browser: 'Firefox', os: 'macOS', ip: '192.0.2.44' }],
    logins: [login(300, 'PASSWORD_CODE'), login(1700, 'PASSWORD_CODE')],
  },
  'U-0006': {
    firstName: 'Gulnora', lastName: 'Saidova', createdDays: 60, createdBy: AKMAL, lastLoginMinutes: 330,
    sessions: [desk(2, 330), phone(1110)],
    logins: [login(330, 'PASSWORD_CODE'), login(331, 'PASSWORD_CODE', 'WRONG_CODE'), login(1720, 'PASSWORD_CODE'), login(3160, 'PASSWORD_CODE'), login(4600, 'PASSWORD_CODE')],
  },
  'U-1009': {
    firstName: 'Ozoda', lastName: 'Botirova', createdDays: 58, createdBy: AKMAL, lastLoginMinutes: 1500,
    sessions: [phone(1500)], logins: [login(1500, 'PASSWORD_CODE')],
  },
  'U-0004': {
    firstName: 'Rustam', lastName: 'Qodirov', createdDays: 50, createdBy: NODIRA, lastLoginMinutes: 340,
    sessions: [desk(1, 340)], logins: [login(340, 'PASSWORD')],
  },
  'U-0005': {
    firstName: 'Otabek', lastName: 'Nurmatov', createdDays: 50, createdBy: NODIRA, lastLoginMinutes: 400,
    sessions: [desk(5, 400)], logins: [login(400, 'PASSWORD')],
  },
  'U-0003': operator('Dilnoza', 'Rahimova', 120),
  'U-1053': operator('Jamshid', 'Eshonqulov', 200),
  'U-1054': operator('Lola', 'Azimova', 260),
  // «Bugun kira olmadi» (Parolni tiklash namunasi): oxirgi kirish — kecha.
  'U-1055': operator('Marjona', 'Ismoilova', 1240, { logins: [login(30, 'PASSWORD', 'WRONG_PASSWORD'), login(32, 'PASSWORD', 'WRONG_PASSWORD'), login(1240, 'PASSWORD')] }),
  'U-1056': operator('Sardor', 'Toshpo‘latov', 180),
  // Stol telefoni (SIP) — admin-operatorlar-jamoasi namunasi.
  'U-1057': operator('Sabina', 'Xolmatova', 150, { workspace: 'SIP' }),
  'U-1058': operator('Bekzod', 'Aliyev', 310),
  'U-1059': operator('Shohruh', 'Mirzayev', 95),
  'U-1060': operator('Nilufar', 'Sodiqova', 2900, { workspace: 'SIP' }),
  'U-1061': operator('Umida', 'Sobirova', 210),
  'U-1062': operator('Temur', 'Komilov', 330),
  'U-1066': operator('Feruza', 'Yo‘ldosheva', 4400),
  'U-1078': operator('Kamron', 'Davletov', 23_000, {
    sessions: [], block: { at: daysAgo(16), by: NODIRA.name, reason: 'Firibgarlik tekshiruvi: soxta tasdiqlar' },
  }),
  // Backend roli frontendga noma'lum (BE-05 dan oldingi eski rol) — «Noma'lum rol» banneri.
  'U-2087': { firstName: 'Laylo', lastName: 'Nazarova', createdDays: 3, createdBy: NODIRA, lastLoginMinutes: 4, sessions: [desk(4)], logins: [login(4, 'PASSWORD')] },
};

/** Hisob uchun karta ma'lumoti; sotuvchi va optovik — yo'q (ularniki o'z bo'limida). */
export function staffInfoFor(id: string): MockStaffInfo | undefined {
  const seed = SEEDS[id];
  if (!seed) return undefined;
  return {
    firstName: seed.firstName,
    lastName: seed.lastName,
    createdAt: daysAgo(seed.createdDays),
    createdBy: seed.createdBy,
    lastLoginAt: seed.lastLoginMinutes === null ? null : minutesAgo(seed.lastLoginMinutes),
    passwordSetAt: daysAgo(Math.max(1, seed.createdDays - 1)),
    temporaryPassword: null,
    block: seed.block ?? null,
    teamId: seed.teamId ?? null,
    sessions: seed.sessions ?? [],
    logins: seed.logins ?? [],
    workspace: seed.workspace ?? 'BROWSER',
    pendingWorkspace: null,
    softphoneConnected: seed.lastLoginMinutes !== null,
    inactive: null,
    request: null,
  };
}

/**
 * Operator ko'rsatkichlari (admin-operatorlar-jamoasi «Bugun»): urinish, tasdiq, yaroqli lidlar, birinchi qo'ng'iroq
 * medianasi. «Oxirgi 7 kun» — taxminan besh baravar. Bugun ishlamaganlar — yo'q.
 */
const TODAY_STATS: Record<string, [attempts: number, confirmed: number, valid: number, median: number]> = {
  'U-0003': [38, 9, 22, 4], 'U-1066': [22, 5, 12, 6], 'U-1053': [25, 6, 13, 5], 'U-1054': [30, 7, 15, 5], 'U-1057': [33, 7, 18, 6],
  'U-1058': [36, 8, 19, 5], 'U-1059': [41, 11, 24, 5], 'U-1062': [31, 8, 17, 4], 'U-1061': [29, 6, 16, 7], 'U-1060': [27, 5, 14, 8],
};

export function mockOperatorStats(id: string, week: boolean) {
  const seed = TODAY_STATS[id];
  if (!seed) return null;
  const [attempts, confirmed, valid, median] = seed;
  const scale = (value: number, extra: number) => (week ? value * 5 + extra : value);
  const row = { attempts: scale(attempts, 7), confirmed: scale(confirmed, 2), valid: scale(valid, 4), firstCallMedianMinutes: median };
  return { operatorId: id, ...row, approveRate: row.valid ? Math.round((row.confirmed / row.valid) * 100) : null };
}

/** Brauzer va tizim — `User-Agent` dan (kirishlar tarixi, sessiya qatori). */
export function deviceOf(userAgent: string | null): { browser: string; os: string } {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Brauzer';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '—';
  return { browser, os };
}

/** Audit yozuvi (BE-27 `identity.activity_log`) — xodim kartasidagi «Oxirgi amallari» va rol/blok tarixi. */
export interface MockAuditEntry {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown>;
}

/** Namuna: moliya Gulnora Saidova pul yechishni tasdiqlagan (admin-foydalanuvchi-karta «Oxirgi amallari»). */
export const mockStaffAudit = (): MockAuditEntry[] => [
  { id: 'UA-3', createdAt: minutesAgo(200), actorId: 'U-0006', actorName: 'Gulnora Saidova', action: 'withdrawal.approve', entityType: 'Withdrawal', entityId: 'W-118', meta: { targetName: 'Sherzod Abdullayev', amount: 1_000_000, before: { status: 'REQUESTED' }, after: { status: 'APPROVED' } } },
  { id: 'UA-2', createdAt: minutesAgo(1500), actorId: 'U-0006', actorName: 'Gulnora Saidova', action: 'withdrawal.approve', entityType: 'Withdrawal', entityId: 'W-112', meta: { targetName: 'Jasur Toshmatov', amount: 450_000, before: { status: 'REQUESTED' }, after: { status: 'APPROVED' } } },
  // Rustam Qodirov nazoratchi qilingan (admin-rollar rol paneli: «Rol … da berilgan — auditda bor»).
  { id: 'UA-0', createdAt: daysAgo(5), actorId: 'U-0008', actorName: 'Akmal Sobirov', action: 'user.role.update', entityType: 'User', entityId: 'U-0004', meta: { before: { role: 'OPERATOR_LEAD' }, after: { role: 'SUPERVISOR' } } },
  { id: 'UA-1', createdAt: daysAgo(16), actorId: 'U-0007', actorName: 'Nodira Karimova', action: 'user.block', entityType: 'User', entityId: 'U-1078', meta: { reason: 'Firibgarlik tekshiruvi: soxta tasdiqlar' } },
];
