import axios from 'axios';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { withOptionalBody, withOptionalParams } from '../../../shared/api/optionalParams';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import { asRecord, readItems, readNumber, readPagination, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import { isUserRole, type ImpersonationGrant } from '../../auth/model/authTypes';
import { userCode } from '../model/staffRules';
import type {
  AccountsPageParams,
  AuditEntry,
  CreateStaffInput,
  CreateStaffResult,
  LoginEvent,
  LoginMethod,
  LoginOutcome,
  PasswordDelivery,
  PasswordResetResult,
  PersonRef,
  StaffListFilter,
  StaffSession,
  Team,
  UserAccount,
  UsersPage,
} from '../model/staffTypes';

/**
 * Foydalanuvchilar va xodimlar (FE-15). Backend: `GET /admin/users` (ADMIN, SUPERADMIN), `POST /admin/team`,
 * `PATCH /admin/users/{id}/role`, `POST /admin/users/{id}/block|unblock`, `POST /admin/users/{id}/2fa/reset`,
 * `GET /admin/audit`. Qolgani — taklif (docs/api-taklif/fe-15-admin-foydalanuvchilar.md): backendda yo'q bo'lsa
 * (404) — ma'lumot «yo'q» deb qaytadi, ekran ishlayveradi.
 */
type Params = Record<string, string | number | boolean | undefined>;

const date = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

/** Taklif maydoni: kalit kelmasa — `undefined` (backend bermaydi), kelsa — o'qilgan qiymat (null ham). */
const optional = <T>(row: UnknownRecord, key: string, read: (value: unknown) => T): T | undefined => (key in row ? read(row[key]) : undefined);

function person(value: unknown): PersonRef | null {
  const row = asRecord(value);
  const id = readText(row, 'id');
  const name = readText(row, 'name');
  return id || name ? { id, name } : null;
}

export function parseUserAccount(value: unknown): UserAccount {
  const row = asRecord(value);
  const id = readText(row, 'id');
  if (!id) throw new Error('Foydalanuvchi ma’lumoti noto‘g‘ri formatda');
  const roleRaw = readText(row, 'role').toUpperCase();
  const name = readText(row, 'name').trim();
  const [first = '', ...rest] = name.split(/\s+/);
  return {
    id,
    code: userCode(id),
    name,
    firstName: readText(row, 'firstName') || first,
    lastName: readText(row, 'lastName') || rest.join(' '),
    phone: readText(row, 'phone'),
    role: isUserRole(roleRaw) ? roleRaw : null,
    roleRaw,
    isActive: row.isActive !== false,
    isBlocked: row.isBlocked === true,
    totpEnabledAt: date(row.totpEnabledAt),
    createdAt: readText(row, 'createdAt'),
    lastLoginAt: optional(row, 'lastLoginAt', date),
    createdBy: optional(row, 'createdBy', person),
    passwordSetAt: optional(row, 'passwordSetAt', date),
    temporaryPassword: optional(row, 'temporaryPassword', (raw) => {
      const item = asRecord(raw);
      const issuedAt = date(item.issuedAt);
      return issuedAt ? { issuedAt, smsSentAt: date(item.smsSentAt) } : null;
    }),
    twoFactorReset: optional(row, 'twoFactorReset', (raw) => {
      const item = asRecord(raw);
      const at = date(item.at);
      return at ? { at, by: readText(item, 'by') } : null;
    }),
    block: optional(row, 'block', (raw) => {
      const item = asRecord(raw);
      const at = date(item.at);
      return at ? { at, by: readText(item, 'by'), reason: readText(item, 'reason') || null } : null;
    }),
    team: optional(row, 'team', (raw) => {
      const item = asRecord(raw);
      const teamId = readText(item, 'id');
      return teamId ? { id: teamId, supervisorId: readText(item, 'supervisorId'), supervisorName: readText(item, 'supervisorName') } : null;
    }),
    affiliate: optional(row, 'affiliate', (raw) => {
      const item = asRecord(raw);
      return 'streams' in item ? { streams: readNumber(item, ['streams']), stoppedStreams: readNumber(item, ['stoppedStreams']) } : null;
    }),
    sanction: optional(row, 'sanction', (raw) => {
      const item = asRecord(raw);
      const kind = readText(item, 'kind').toUpperCase();
      const since = date(item.since);
      return (kind === 'WARNING' || kind === 'HOLD') && since ? { kind, since } : null;
    }),
  };
}

async function getUsersPage(params: Params, signal?: AbortSignal): Promise<UsersPage> {
  const { data } = await httpClient.get<unknown>('/admin/users', { params, signal });
  const value = unwrapApiData(data);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Foydalanuvchilar ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(parseUserAccount);
  return { items, ...readPagination(asRecord(value), { page: Number(params.page) || 1, limit: Number(params.limit) || 20, itemCount: items.length }) };
}

/** Backend `limit` ≤ 100: rol bo'yicha hamma sahifa (xodimlar soni kichik; himoya — 10 sahifa). */
const MAX_PAGES = 10;

async function getAllUsers(params: Params, signal?: AbortSignal): Promise<UserAccount[]> {
  const items: UserAccount[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await getUsersPage({ ...params, page, limit: 100 }, signal);
    items.push(...result.items);
    if (page >= result.totalPages || !result.items.length) break;
  }
  return items;
}

/**
 * Roli noma'lum hisoblar — taklif `unknownRole=true` (backend rad etsa yoki ishlamasa — banner chiqmaydi, ro'yxat
 * ishlayveradi).
 */
async function getUnknownRoleUsers(params: Params, signal?: AbortSignal): Promise<UserAccount[]> {
  try {
    const { data, dropped } = await withOptionalParams((query) => getUsersPage(query, signal), { ...params, unknownRole: true, page: 1, limit: 100 }, ['unknownRole']);
    return dropped.length ? [] : data.items.filter((item) => item.role === null);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    return [];
  }
}

/**
 * Xodimlar ro'yxati: backendda «hamma xodim» filtri yo'q — har rol alohida so'raladi (`role`, `search`, `blocked`
 * backendda bor). Superadmin backend ro'yxatida yashirin — taklif: `role=SUPERADMIN` so'ralsa qaytsin.
 */
export async function getStaff(filter: StaffListFilter & { includeUnknown?: boolean }, signal?: AbortSignal): Promise<UserAccount[]> {
  const base: Params = { search: filter.search?.trim() || undefined, blocked: filter.blocked };
  const [byRole, unknown] = await Promise.all([
    Promise.all(filter.roles.map((role) => getAllUsers({ ...base, role }, signal))),
    filter.includeUnknown ? getUnknownRoleUsers(base, signal) : Promise.resolve([]),
  ]);
  const seen = new Set<string>();
  return [...unknown, ...byRole.flat()].filter((user) => !seen.has(user.id) && Boolean(seen.add(user.id)));
}

const sanctionOf = (user: UserAccount) => user.sanction?.kind ?? 'NONE';

/**
 * «Sotuvchilar» va «Optoviklar» tablari — sahifalangan hisoblar. Holat filtri: «Bloklangan» — backend `blocked=true`;
 * «Faol», «Ogohlantirish», «Ushlab turilgan» — taklif `sanction` (NONE | WARNING | HOLD). Backend uni rad etsa,
 * kelgan sahifa joyida saralanadi (jami — shu sahifadagilar).
 */
export async function getAccountsPage({ role, search, blocked, status, page, limit }: AccountsPageParams, signal?: AbortSignal): Promise<UsersPage> {
  const base: Params = { role, search: search?.trim() || undefined, blocked: status ? status === 'BLOCKED' : blocked, page, limit };
  if (!status || status === 'BLOCKED') return getUsersPage(base, signal);
  const sanction = status === 'ACTIVE' ? 'NONE' : status;
  const { data, dropped } = await withOptionalParams((query) => getUsersPage(query, signal), { ...base, sanction }, ['sanction']);
  if (!dropped.length) return data;
  const items = data.items.filter((user) => sanctionOf(user) === sanction);
  return { items, total: items.length, page: 1, limit, totalPages: 1 };
}

export async function getUserAccount(id: string, signal?: AbortSignal): Promise<UserAccount> {
  const { data } = await httpClient.get<unknown>(`/admin/users/${encodeURIComponent(id)}`, { signal });
  return parseUserAccount(unwrapApiData(data));
}

/**
 * Xodim qo'shish (`POST /admin/team`: ism, telefon, rol; parolsiz — backend vaqtinchalik parol yaratadi va javobda bir
 * marta qaytaradi). Taklif: `firstName`/`lastName`, operatorga `teamId`, SMS (`smsSent`) — backend bilmasa ularsiz.
 */
export async function createStaff(input: CreateStaffInput): Promise<CreateStaffResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const { data } = await withOptionalBody(
    async (body) => (await httpClient.post<unknown>('/admin/team', body, { timeout: REQUEST_TIMEOUT.action })).data,
    {
      name: `${firstName} ${lastName}`.trim(), phone: input.phone, role: input.role, firstName, lastName,
      teamId: input.role === 'OPERATOR_LEAD' && input.teamId ? input.teamId : undefined,
      workspace: input.role === 'OPERATOR_LEAD' && input.workspace ? input.workspace : undefined,
    },
    ['firstName', 'lastName', 'teamId', 'workspace'],
  );
  const { temporaryPassword, smsSent, ...user } = asRecord(unwrapApiData(data));
  return {
    user: parseUserAccount(user),
    temporaryPassword: typeof temporaryPassword === 'string' && temporaryPassword ? temporaryPassword : null,
    smsSent: smsSent === true,
  };
}

/** Band raqam (409): taklif `existingUser` — kimniki («Bu raqam bilan hisob bor: Laylo N. (U-2087)»). */
export function existingUserOf(error: unknown): PersonRef | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  return person(asRecord(error.response.data).existingUser);
}

/** Rol (backend: `{role}`, faqat superadmin; taklif — admin ham). Operatorga jamoa — taklif `teamId`. */
export async function changeUserRole({ id, role, teamId }: { id: string; role: string; teamId?: string | null }): Promise<void> {
  await withOptionalBody(
    (body) => httpClient.patch(`/admin/users/${encodeURIComponent(id)}/role`, body, { timeout: REQUEST_TIMEOUT.action }),
    { role, teamId: role === 'OPERATOR_LEAD' && teamId ? teamId : undefined },
    ['teamId'],
  );
}

/** Bloklash: backend tanani o'qimaydi — `reason` taklif (audit va kartadagi «Sabab»). */
export async function blockUser({ id, reason }: { id: string; reason: string }): Promise<void> {
  await httpClient.post(`/admin/users/${encodeURIComponent(id)}/block`, { reason: reason.trim() }, { timeout: REQUEST_TIMEOUT.action });
}

export async function unblockUser(id: string): Promise<void> {
  await httpClient.post(`/admin/users/${encodeURIComponent(id)}/unblock`, undefined, { timeout: REQUEST_TIMEOUT.action });
}

/** BE-26: faqat superadmin; hamma sessiya tugaydi, keyingi kirishda QR bilan qayta ulanadi. `reason` — taklif. */
export async function resetUserTwoFactor({ id, reason }: { id: string; reason: string }): Promise<void> {
  await httpClient.post(`/admin/users/${encodeURIComponent(id)}/2fa/reset`, { reason: reason.trim() }, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif: parolni tiklash — vaqtinchalik parol SMS bilan yoki adminga bir marta ko'rsatiladi. */
export async function resetUserPassword({ id, delivery }: { id: string; delivery: PasswordDelivery }): Promise<PasswordResetResult> {
  const { data } = await httpClient.post<unknown>(`/admin/users/${encodeURIComponent(id)}/password/reset`, { delivery }, { timeout: REQUEST_TIMEOUT.action });
  const row = asRecord(unwrapApiData(data));
  return { temporaryPassword: readText(row, 'temporaryPassword') || null, smsSent: row.smsSent === true };
}

/** Taklif: hali kirmagan xodimga vaqtinchalik parol SMS ini qayta yuborish. */
export async function resendWelcomeSms(id: string): Promise<void> {
  await httpClient.post(`/admin/users/${encodeURIComponent(id)}/welcome-sms`, undefined, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif endpointi backendda yo'q (404) — `null`: ekran «ma'lumot yo'q» deydi, xato emas. */
/** Taklif endpointi backendda hali yo'q (404) — `null`: ekran «ma'lumot yo'q» deydi, xato bermaydi. */
export async function unlessMissing<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

function parseSession(value: unknown): StaffSession {
  const row = asRecord(value);
  return {
    id: readText(row, 'id'), browser: readText(row, 'browser'), os: readText(row, 'os'), ip: readText(row, 'ip'),
    createdAt: readText(row, 'createdAt'), lastSeenAt: readText(row, 'lastSeenAt') || readText(row, 'createdAt'), current: row.current === true,
  };
}

/** Taklif: xodimning faol sessiyalari. */
export function getUserSessions(id: string, signal?: AbortSignal): Promise<StaffSession[] | null> {
  return unlessMissing(async () => {
    const { data } = await httpClient.get<unknown>(`/admin/users/${encodeURIComponent(id)}/sessions`, { signal });
    return (readItems(unwrapApiData(data), 'items') ?? []).map(parseSession).filter((session) => session.id);
  });
}

export async function endUserSession({ id, sessionId }: { id: string; sessionId: string }): Promise<void> {
  await httpClient.delete(`/admin/users/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}`, { timeout: REQUEST_TIMEOUT.action });
}

export async function endAllUserSessions(id: string): Promise<void> {
  await httpClient.delete(`/admin/users/${encodeURIComponent(id)}/sessions`, { timeout: REQUEST_TIMEOUT.action });
}

const OUTCOMES: readonly LoginOutcome[] = ['SUCCESS', 'WRONG_PASSWORD', 'WRONG_CODE', 'BLOCKED'];
const METHODS: readonly LoginMethod[] = ['PASSWORD', 'PASSWORD_CODE', 'RECOVERY_CODE', 'SMS'];

/** Taklif: kirishlar tarixi (oxirgi `limit` ta). */
export function getUserLogins(id: string, limit = 5, signal?: AbortSignal): Promise<LoginEvent[] | null> {
  return unlessMissing(async () => {
    const { data } = await httpClient.get<unknown>(`/admin/users/${encodeURIComponent(id)}/logins`, { params: { limit }, signal });
    return (readItems(unwrapApiData(data), 'items') ?? []).map((value) => {
      const row = asRecord(value);
      const outcome = readText(row, 'outcome') as LoginOutcome;
      const method = readText(row, 'method') as LoginMethod;
      return {
        at: readText(row, 'at'), outcome: OUTCOMES.includes(outcome) ? outcome : 'SUCCESS', method: METHODS.includes(method) ? method : 'PASSWORD',
        browser: readText(row, 'browser'), os: readText(row, 'os'), ip: readText(row, 'ip'),
      };
    }).filter((event) => date(event.at));
  });
}

/** Taklif: operatorlar jamoalari; backendda yo'q bo'lsa — bo'sh ro'yxat (jamoa tanlovi chiqmaydi). */
export async function getTeams(signal?: AbortSignal): Promise<Team[]> {
  const teams = await unlessMissing(async () => {
    const { data } = await httpClient.get<unknown>('/admin/teams', { signal });
    return (readItems(unwrapApiData(data), 'items') ?? []).map((value) => {
      const row = asRecord(value);
      return { id: readText(row, 'id'), supervisor: person(row.supervisor) ?? { id: '', name: '' }, operatorCount: readNumber(row, ['operatorCount']), createdAt: readText(row, 'createdAt') };
    }).filter((team) => team.id);
  });
  return teams ?? [];
}

/** BE-27 audit (`GET /admin/audit`, ADMIN va SUPERADMIN): xodim qilgan oxirgi amallar yoki xodim ustidagi yozuvlar. */
export async function getAuditEntries(params: { actorId?: string; entityType?: string; entityId?: string; limit: number }, signal?: AbortSignal): Promise<AuditEntry[]> {
  const { data } = await httpClient.get<unknown>('/admin/audit', { params: { ...params, page: 1 }, signal });
  return (readItems(unwrapApiData(data), 'items') ?? []).map((value) => {
    const row = asRecord(value);
    return {
      id: readText(row, 'id'), createdAt: readText(row, 'createdAt'), actorId: readText(row, 'actorId'), actorName: readText(row, 'actorName'),
      action: readText(row, 'action'), entityType: readText(row, 'entityType'), entityId: readText(row, 'entityId'), meta: asRecord(row.meta),
    };
  }).filter((entry) => entry.id && entry.action);
}

/**
 * Superadmin sotuvchi yoki optovik nomidan kiradi (`POST /admin/users/{id}/impersonate`, faqat AFFILIATE va WHOLESALER):
 * 15 daqiqalik, refresh qilinmaydigan token.
 */
export async function impersonateUser(id: string): Promise<ImpersonationGrant> {
  const { data } = await httpClient.post<unknown>(`/admin/users/${encodeURIComponent(id)}/impersonate`);
  const row = asRecord(unwrapApiData(data));
  const user = asRecord(row.user);
  const token = row.impersonationToken;
  const role = typeof user.role === 'string' ? user.role.toUpperCase() : '';
  const expiresAt = typeof row.expiresAt === 'string' && !Number.isNaN(Date.parse(row.expiresAt))
    ? row.expiresAt
    : typeof row.expiresIn === 'number' && row.expiresIn > 0 ? new Date(Date.now() + row.expiresIn * 1000).toISOString() : null;
  if (
    typeof token !== 'string' || !token || token.length > 16_384 || /\s/.test(token) ||
    // Nomidan kirilgan foydalanuvchi panelga kiradi — rol panel rollaridan bo'lishi shart.
    !expiresAt || (typeof user.id !== 'string' && typeof user.id !== 'number') || !isUserRole(role)
  ) {
    throw new Error('Serverdan kutilmagan javob olindi');
  }
  return { token, expiresAt, user: { id: String(user.id), name: readText(user, 'name') || '—', role } };
}
