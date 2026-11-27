import { describe, expect, it } from 'vitest';
import type { TeamMember } from '../../../features/staff/model/teamTypes';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { buildMemberRows, matchesMember, parseMemberFilters, parseSupervisorTab, sortMembers, teamCounts } from './teamMembers';

/** FE-15 nazoratchi «Jamoa»: hisob holati, tartib (yangi qo'shilgan tepada), filtrlar, jamoa sonlari. */
const member = (id: string, name: string, patch: Partial<UserAccount> = {}, extra: Partial<TeamMember> = {}): TeamMember => ({
  user: {
    id, code: id, name, firstName: name, lastName: '', phone: '+998901112233', role: 'OPERATOR_LEAD', roleRaw: 'OPERATOR_LEAD', isActive: true, isBlocked: false,
    totpEnabledAt: null, createdAt: '2026-11-01T08:00:00.000Z', lastLoginAt: '2026-11-27T08:00:00.000Z', ...patch,
  },
  softphone: { operatorId: id, account: id, status: 'REGISTERED', since: null, workspace: 'BROWSER', neverConnected: false, pendingWorkspace: null },
  inactive: null,
  request: null,
  ...extra,
});

const members = [
  member('U-3', 'Zarina'),
  member('U-1', 'Ali', { isBlocked: true }),
  member('U-2', 'Bahrom', { lastLoginAt: null, createdAt: '2026-11-27T09:52:00.000Z' }),
  member('U-4', 'Marjona', { isActive: false }, { inactive: { at: '2026-11-27T09:45:00.000Z', by: 'Rustam Qodirov', reason: 'Ta’til' } }),
  member('U-5', 'Temur', {}, { request: { kind: 'BLOCK', at: '2026-11-27T09:50:00.000Z', by: 'Rustam Qodirov', reason: 'Soxta tasdiq' } }),
];
const rows = buildMemberRows(members, [{ operatorId: 'U-1', state: 'ONLINE', since: null, activeBookings: 0, maxBookings: 5, scheduledCalls: 0, activity: null }, { operatorId: 'U-5', state: 'ONLINE', since: null, activeBookings: 1, maxBookings: 5, scheduledCalls: 0, activity: null }]);

describe('nazoratchi jamoasi ro‘yxati', () => {
  it('holat: blok > so‘rov > nofaol > hali kirmagan; jonli holat faqat ishlay oladiganda', () => {
    expect(rows.map((row) => row.state)).toEqual(['ACTIVE', 'BLOCKED', 'NEVER_LOGGED_IN', 'INACTIVE', 'BLOCK_REQUESTED']);
    expect(rows[1].live).toBeNull();
    expect(rows[4].live?.state).toBe('ONLINE');
    expect(parseSupervisorTab('team')).toBe('team');
    expect(parseSupervisorTab('x')).toBe('now');
  });

  it('tartib: yangi qo‘shilgan tepada, qolganlari ism bo‘yicha; filtr «Hisob»', () => {
    expect(sortMembers(rows).map((row) => row.member.user.name)).toEqual(['Bahrom', 'Ali', 'Marjona', 'Temur', 'Zarina']);
    const filters = parseMemberFilters(new URLSearchParams('account=INACTIVE'));
    expect(rows.filter((row) => matchesMember(row, filters)).map((row) => row.member.user.id)).toEqual(['U-4']);
  });

  it('jamoa sonlari: faol hisoblar (blok va nofaolsiz), admin bloklagan, softfon', () => {
    expect(teamCounts(rows)).toEqual({ total: 5, active: 3, blocked: { count: 1, names: ['Ali'] }, softphones: 3, browser: 3, sip: 0 });
  });
});
