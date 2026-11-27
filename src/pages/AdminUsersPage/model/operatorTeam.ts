import { bookingsText } from '../../../features/staff/lib/operatorFormat';
import { displayName } from '../../../features/staff/lib/staffFormat';
import type { OperatorLive, OperatorStatsRow, Softphone, SoftphoneStatus, StatsPeriod, Workspace } from '../../../features/staff/model/operatorTypes';
import type { UserAccount } from '../../../features/staff/model/staffTypes';

/** «Hozir» ustuni: jonli holat yoki bloklangan (blok ustun). */
export type Presence = 'ONLINE' | 'BREAK' | 'OFFLINE' | 'BLOCKED';
export const PRESENCES: readonly Presence[] = ['ONLINE', 'BREAK', 'OFFLINE', 'BLOCKED'];
export const FILTER_WORKSPACES: readonly Workspace[] = ['BROWSER', 'SIP'];

export interface OperatorRow {
  user: UserAccount;
  presence: Presence;
  live: OperatorLive | null;
  /** undefined — softfon ma'lumoti backendda yo'q (taklif); null — shu operatorda hisob yo'q. */
  softphone: Softphone | null | undefined;
  stats: OperatorStatsRow | null | undefined;
}

export function buildRows(
  users: readonly UserAccount[],
  live: readonly OperatorLive[] | undefined,
  softphones: readonly Softphone[] | null | undefined,
  stats: readonly OperatorStatsRow[] | null | undefined,
): OperatorRow[] {
  const liveById = new Map((live ?? []).map((item) => [item.operatorId, item]));
  const phoneById = new Map((softphones ?? []).map((item) => [item.operatorId, item]));
  const statsById = new Map((stats ?? []).map((item) => [item.operatorId, item]));
  return users.map((user) => {
    const current = user.isBlocked ? null : liveById.get(user.id) ?? null;
    return {
      user,
      presence: user.isBlocked ? 'BLOCKED' : current?.state ?? 'OFFLINE',
      live: current,
      softphone: softphones ? phoneById.get(user.id) ?? null : undefined,
      stats: stats ? statsById.get(user.id) ?? null : undefined,
    };
  });
}

/** «Bronlar»: «1/5 · +3»; oflayn (jonli ro'yxatda yo'q) yoki bloklangan — «—». */
export const bookingsValue = (row: OperatorRow) => (row.live && !row.user.isBlocked ? bookingsText(row.live) : '—');

export interface TeamFilters {
  search: string;
  presence: Presence | '';
  workspace: Workspace | '';
  softphone: SoftphoneStatus | '';
  period: StatsPeriod;
  sort: 'name' | 'attempts';
}

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | '' => ((values as readonly string[]).includes(value ?? '') ? value as T : '');

export function parseTeamFilters(params: URLSearchParams): TeamFilters {
  return {
    search: params.get('q') ?? '',
    presence: oneOf(PRESENCES, params.get('state')),
    workspace: oneOf(FILTER_WORKSPACES, params.get('ws')),
    softphone: oneOf<SoftphoneStatus>(['REGISTERED', 'UNREGISTERED', 'DISABLED'], params.get('sp')),
    period: params.get('period') === 'week' ? 'week' : 'today',
    sort: params.get('sort') === 'attempts' ? 'attempts' : 'name',
  };
}

export const hasTeamFilters = (filters: TeamFilters) => Boolean(filters.search.trim() || filters.presence || filters.workspace || filters.softphone);

export function matchesRow(row: OperatorRow, filters: TeamFilters): boolean {
  const query = filters.search.trim().toLowerCase().replace(/^\+/, '');
  if (query) {
    const haystack = [row.user.name, row.user.code, row.user.id, row.user.phone.replace(/\D/g, '')].map((value) => value.toLowerCase());
    if (!haystack.some((value) => value.includes(query))) return false;
  }
  if (filters.presence && row.presence !== filters.presence) return false;
  if (filters.workspace && row.softphone?.workspace !== filters.workspace) return false;
  if (filters.softphone && row.softphone?.status !== filters.softphone) return false;
  return true;
}

/** Tartib: ism bo'yicha (admin-operatorlar-jamoasi); «Bugun» bosilsa — urinishlar ko'pi tepada. */
export function sortRows(rows: readonly OperatorRow[], sort: TeamFilters['sort']): OperatorRow[] {
  const byName = (a: OperatorRow, b: OperatorRow) => displayName(a.user).localeCompare(displayName(b.user));
  return [...rows].sort(sort === 'attempts' ? (a, b) => (b.stats?.attempts ?? -1) - (a.stats?.attempts ?? -1) || byName(a, b) : byName);
}

export interface TeamSummary {
  total: number;
  counts: Record<Presence, number>;
  attempts: number;
  confirmed: number;
  valid: number;
  /** Tasdiq foizi: tasdiqlangan / yaroqli; maxraj 0 — null. */
  rate: number | null;
  /** Birinchi qo'ng'iroq medianasi — operatorlar medianalarining medianasi. */
  median: number | null;
  bookings: number;
  scheduled: number;
  activeAccounts: number;
  browser: number;
  sip: number;
  hasStats: boolean;
  hasSoftphones: boolean;
}

function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function teamSummary(rows: readonly OperatorRow[]): TeamSummary {
  const counts: Record<Presence, number> = { ONLINE: 0, BREAK: 0, OFFLINE: 0, BLOCKED: 0 };
  let attempts = 0;
  let confirmed = 0;
  let valid = 0;
  let bookings = 0;
  let scheduled = 0;
  const medians: number[] = [];
  for (const row of rows) {
    counts[row.presence] += 1;
    if (row.stats) {
      attempts += row.stats.attempts;
      confirmed += row.stats.confirmed;
      valid += row.stats.valid;
      if (row.stats.firstCallMedianMinutes !== null) medians.push(row.stats.firstCallMedianMinutes);
    }
    if (row.live) {
      bookings += row.live.activeBookings;
      scheduled += row.live.scheduledCalls;
    }
  }
  const phones = rows.map((row) => row.softphone).filter((item): item is Softphone => Boolean(item));
  return {
    total: rows.length,
    counts,
    attempts,
    confirmed,
    valid,
    rate: valid ? Math.round((confirmed / valid) * 100) : null,
    median: medianOf(medians),
    bookings,
    scheduled,
    activeAccounts: phones.filter((item) => item.status !== 'DISABLED').length,
    browser: rows.filter((row) => !row.user.isBlocked && row.softphone?.workspace === 'BROWSER').length,
    sip: rows.filter((row) => !row.user.isBlocked && row.softphone?.workspace === 'SIP').length,
    hasStats: rows.some((row) => row.stats !== undefined),
    hasSoftphones: rows.some((row) => row.softphone !== undefined),
  };
}
