import { displayName } from '../../../features/staff/lib/staffFormat';
import type { OperatorLive, SoftphoneStatus, Workspace } from '../../../features/staff/model/operatorTypes';
import { MEMBER_STATES, memberState, type MemberState, type TeamMember } from '../../../features/staff/model/teamTypes';

/** «Operatorlar» bo'limi yorliqlari (nazoratchi-operatorlar): «Hozir», «Hisobot», «Quvvat rejasi» — FE-11; «Jamoa» — FE-15. */
export const SUPERVISOR_TABS = ['now', 'report', 'team', 'capacity'] as const;
export type SupervisorTab = (typeof SUPERVISOR_TABS)[number];
export const parseSupervisorTab = (value: string | null): SupervisorTab => ((SUPERVISOR_TABS as readonly string[]).includes(value ?? '') ? value as SupervisorTab : 'now');

export interface MemberRow {
  member: TeamMember;
  state: MemberState;
  live: OperatorLive | null;
}

export interface MemberFilters {
  search: string;
  state: MemberState | '';
  workspace: Exclude<Workspace, 'APP'> | '';
  softphone: SoftphoneStatus | '';
}

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | '' => ((values as readonly string[]).includes(value ?? '') ? value as T : '');

export function parseMemberFilters(params: URLSearchParams): MemberFilters {
  return {
    search: params.get('q') ?? '',
    state: oneOf(MEMBER_STATES, params.get('account')),
    workspace: oneOf<Exclude<Workspace, 'APP'>>(['BROWSER', 'SIP'], params.get('ws')),
    softphone: oneOf<SoftphoneStatus>(['REGISTERED', 'UNREGISTERED', 'DISABLED'], params.get('sp')),
  };
}

/** Jonli holat faqat kira oladigan operatorda (nofaol va bloklangan — «—»). */
export function buildMemberRows(members: readonly TeamMember[], live: readonly OperatorLive[] | undefined): MemberRow[] {
  const byId = new Map((live ?? []).map((item) => [item.operatorId, item]));
  return members.map((member) => {
    const state = memberState(member);
    const canWork = state === 'ACTIVE' || state === 'BLOCK_REQUESTED';
    return { member, state, live: canWork ? byId.get(member.user.id) ?? null : null };
  });
}

export function matchesMember(row: MemberRow, filters: MemberFilters): boolean {
  const query = filters.search.trim().toLowerCase().replace(/^\+/, '');
  const { user, softphone } = row.member;
  if (query && ![user.name, user.code, user.id, user.phone.replace(/\D/g, '')].some((value) => value.toLowerCase().includes(query))) return false;
  if (filters.state && row.state !== filters.state) return false;
  if (filters.workspace && softphone?.workspace !== filters.workspace) return false;
  if (filters.softphone && softphone?.status !== filters.softphone) return false;
  return true;
}

/** Yangi qo'shilgan (hali kirmagan) operator tepada (yangisi birinchi), qolganlari — ism bo'yicha. */
export function sortMembers(rows: readonly MemberRow[]): MemberRow[] {
  return [...rows].sort((a, b) => {
    const fresh = Number(b.state === 'NEVER_LOGGED_IN') - Number(a.state === 'NEVER_LOGGED_IN');
    if (fresh) return fresh;
    if (a.state === 'NEVER_LOGGED_IN') return b.member.user.createdAt.localeCompare(a.member.user.createdAt);
    return displayName(a.member.user).localeCompare(displayName(b.member.user));
  });
}

export interface TeamCounts {
  total: number;
  /** Kira oladi va lid oladi: faol, hali kirmagan va bloklash so'ralgan (javobgacha ishlaydi). */
  active: number;
  blocked: UserNames;
  softphones: number;
  browser: number;
  sip: number;
}

type UserNames = { count: number; names: string[] };

export function teamCounts(rows: readonly MemberRow[]): TeamCounts {
  const blocked = rows.filter((row) => row.state === 'BLOCKED');
  const working = rows.filter((row) => row.state !== 'BLOCKED' && row.state !== 'INACTIVE');
  return {
    total: rows.length,
    active: working.length,
    blocked: { count: blocked.length, names: blocked.map((row) => displayName(row.member.user)) },
    softphones: working.filter((row) => row.member.softphone).length,
    browser: working.filter((row) => row.member.softphone?.workspace === 'BROWSER').length,
    sip: working.filter((row) => row.member.softphone?.workspace === 'SIP').length,
  };
}
