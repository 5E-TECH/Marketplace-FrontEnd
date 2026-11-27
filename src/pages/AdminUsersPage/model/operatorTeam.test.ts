import { describe, expect, it } from 'vitest';
import type { OperatorLive, OperatorStatsRow, Softphone } from '../../../features/staff/model/operatorTypes';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { bookingsValue, buildRows, matchesRow, parseTeamFilters, sortRows, teamSummary } from './operatorTeam';

/** FE-15 «Operatorlar jamoasi»: qatorlar (jonli holat + softfon + ko'rsatkich), filtrlar, jamoa yig'indisi. */
const user = (id: string, name: string, patch: Partial<UserAccount> = {}): UserAccount => ({
  id, code: id, name, firstName: name.split(' ')[0] ?? '', lastName: name.split(' ')[1] ?? '', phone: '+998901112233', role: 'OPERATOR_LEAD', roleRaw: 'OPERATOR_LEAD',
  isActive: true, isBlocked: false, totpEnabledAt: null, createdAt: '2026-11-01T08:00:00.000Z', ...patch,
});
const live = (operatorId: string, state: OperatorLive['state'], patch: Partial<OperatorLive> = {}): OperatorLive => ({
  operatorId, state, since: null, activeBookings: 1, maxBookings: 5, scheduledCalls: 2, activity: null, ...patch,
});
const phone = (operatorId: string, patch: Partial<Softphone> = {}): Softphone => ({
  operatorId, account: operatorId.slice(2), status: 'REGISTERED', since: null, workspace: 'BROWSER', neverConnected: false, pendingWorkspace: null, ...patch,
});
const stats = (operatorId: string, attempts: number, confirmed: number, valid: number, median: number | null): OperatorStatsRow => ({
  operatorId, attempts, confirmed, valid, approveRate: Math.round((confirmed / valid) * 100), firstCallMedianMinutes: median,
});

const users = [user('U-1', 'Zarina H'), user('U-2', 'Ali V'), user('U-3', 'Kamron D', { isBlocked: true }), user('U-4', 'Lola A')];
const rows = buildRows(users, [live('U-1', 'ONLINE'), live('U-2', 'BREAK', { scheduledCalls: 0 }), live('U-3', 'ONLINE')], [phone('U-1', { workspace: 'SIP' }), phone('U-2'), phone('U-3', { status: 'DISABLED' })], [stats('U-1', 30, 7, 15, 5), stats('U-2', 20, 5, 12, 7), stats('U-4', 10, 1, 3, null)]);

describe('operatorlar jadvali', () => {
  it('blok jonli holatdan ustun; ro‘yxatda yo‘q — oflayn; softfon yo‘q — null, backendda yo‘q — undefined', () => {
    expect(rows.map((row) => row.presence)).toEqual(['ONLINE', 'BREAK', 'BLOCKED', 'OFFLINE']);
    expect(rows[3].softphone).toBeNull();
    expect(buildRows(users, [], null, undefined)[0]).toMatchObject({ softphone: undefined, stats: undefined });
    expect(bookingsValue(rows[0])).toBe('1/5 · +2');
    expect(bookingsValue(rows[1])).toBe('1/5');
    expect(bookingsValue(rows[2])).toBe('—');
  });

  it('filtrlar URL dan; holat, ish joyi, softfon va qidiruv; «Bugun» — urinishlar bo‘yicha', () => {
    const filters = parseTeamFilters(new URLSearchParams('state=BLOCKED&ws=SIP&sp=DISABLED&period=week&sort=attempts&q=ali'));
    expect(filters).toEqual({ search: 'ali', presence: 'BLOCKED', workspace: 'SIP', softphone: 'DISABLED', period: 'week', sort: 'attempts' });
    const none = parseTeamFilters(new URLSearchParams('state=x&ws=APP'));
    expect(rows.filter((row) => matchesRow(row, { ...none, workspace: 'SIP' })).map((row) => row.user.id)).toEqual(['U-1']);
    expect(rows.filter((row) => matchesRow(row, { ...none, softphone: 'DISABLED' })).map((row) => row.user.id)).toEqual(['U-3']);
    expect(rows.filter((row) => matchesRow(row, { ...none, search: 'lola' })).map((row) => row.user.id)).toEqual(['U-4']);
    expect(sortRows(rows, 'name').map((row) => row.user.name)).toEqual(['Ali V', 'Kamron D', 'Lola A', 'Zarina H']);
    expect(sortRows(rows, 'attempts').map((row) => row.user.id)).toEqual(['U-1', 'U-2', 'U-4', 'U-3']);
  });

  it('jamoa yig‘indisi: holatlar, tasdiq foizi (tasdiqlangan / yaroqli), mediana, bronlar, faol hisoblar', () => {
    const summary = teamSummary(rows);
    expect(summary.counts).toEqual({ ONLINE: 1, BREAK: 1, OFFLINE: 1, BLOCKED: 1 });
    expect(summary).toMatchObject({ attempts: 60, confirmed: 13, valid: 30, rate: 43, median: 6, bookings: 2, scheduled: 2, activeAccounts: 2, browser: 1, sip: 1 });
  });
});
