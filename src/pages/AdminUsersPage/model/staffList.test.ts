import { describe, expect, it } from 'vitest';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { groupStaff, matchesStaff, operatorSummary, parseFilters, phoneSlice } from './staffList';

/** FE-15 «Xodimlar»: filtrlar, rol bo'yicha guruhlar, saralash, telefonda «Yana N ta». */
const user = (patch: Partial<UserAccount>): UserAccount => ({
  id: 'U-1', code: 'U-1', name: 'Ali Valiyev', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112233', role: 'OPERATOR_LEAD', roleRaw: 'OPERATOR_LEAD',
  isActive: true, isBlocked: false, totpEnabledAt: null, createdAt: '2026-11-01T08:00:00.000Z', lastLoginAt: '2026-11-26T08:00:00.000Z', ...patch,
});

const NONE = parseFilters(new URLSearchParams());

describe('xodimlar ro‘yxati', () => {
  it('URL filtrlari: noto‘g‘ri qiymat — «Barchasi»', () => {
    expect(parseFilters(new URLSearchParams('q=lola&role=SUPERVISOR&status=BLOCKED&login=passwordCode'))).toEqual({ search: 'lola', role: 'SUPERVISOR', status: 'BLOCKED', login: 'passwordCode' });
    expect(parseFilters(new URLSearchParams('role=SELLER&status=x&login=sms'))).toEqual(NONE);
  });

  it('qidiruv: ism, ID va telefon raqamlari; holat va kirish usuli', () => {
    const ali = user({});
    expect(matchesStaff(ali, { ...NONE, search: 'valiyev' })).toBe(true);
    expect(matchesStaff(ali, { ...NONE, search: 'u-1' })).toBe(true);
    expect(matchesStaff(ali, { ...NONE, search: '90 111' })).toBe(true);
    expect(matchesStaff(ali, { ...NONE, search: 'Shoxrux' })).toBe(false);
    expect(matchesStaff(user({ isBlocked: true }), { ...NONE, status: 'BLOCKED' })).toBe(true);
    expect(matchesStaff(user({ lastLoginAt: null }), { ...NONE, status: 'ACTIVE' })).toBe(false);
    expect(matchesStaff(user({ lastLoginAt: null }), { ...NONE, status: 'NEVER_LOGGED_IN' })).toBe(true);
    expect(matchesStaff(user({ role: 'FINANCE' }), { ...NONE, login: 'passwordCode' })).toBe(true);
    expect(matchesStaff(ali, { ...NONE, login: 'passwordCode' })).toBe(false);
    // Roli noma'lum — faqat rol va kirish filtrisiz.
    expect(matchesStaff(user({ role: null }), NONE)).toBe(true);
    expect(matchesStaff(user({ role: null }), { ...NONE, role: 'OPERATOR_LEAD' })).toBe(false);
  });

  it('guruhlar dizayn tartibida; ichida ism yoki oxirgi kirish bo‘yicha', () => {
    const rows = [
      user({ id: 'a', name: 'Zarina H.', lastLoginAt: '2026-11-26T09:00:00.000Z' }),
      user({ id: 'b', name: 'Bekzod A.', lastLoginAt: '2026-11-26T07:00:00.000Z' }),
      user({ id: 'c', name: 'Akmal S.', role: 'SUPERADMIN' }),
      user({ id: 'd', name: 'Laylo N.', role: null }),
    ];
    expect(groupStaff(rows, 'name').map((group) => [group.key, group.users.map((item) => item.id)])).toEqual([['UNKNOWN', ['d']], ['SUPERADMIN', ['c']], ['OPERATOR_LEAD', ['b', 'a']]]);
    expect(groupStaff(rows, 'lastLoginDesc').at(-1)?.users.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('operator guruhi sarlavhasi va telefon bo‘lagi: qolganlari bitta guruhdan — «Yana 9 ta operator»', () => {
    const operators = Array.from({ length: 13 }, (_, index) => user({ id: `o${String(index).padStart(2, '0')}`, name: `Operator ${String(index).padStart(2, '0')}`, isBlocked: index === 3, team: { id: 'T-1', supervisorId: 'U-4', supervisorName: 'Rustam Qodirov' } }));
    expect(operatorSummary(operators)).toEqual({ supervisors: ['Rustam Qodirov'], active: 12, blocked: 1 });
    const groups = groupStaff([...operators, ...Array.from({ length: 7 }, (_, index) => user({ id: `s${String(index)}`, role: 'WAREHOUSE' }))], 'name');
    const slice = phoneSlice(groups, 11);
    expect(slice).toMatchObject({ shown: 11, total: 20, remaining: 9, remainingGroup: 'OPERATOR_LEAD' });
    expect(slice.groups.at(-1)).toMatchObject({ key: 'OPERATOR_LEAD' });
    expect(slice.groups.at(-1)?.users).toHaveLength(4);
    expect(slice.groups.at(-1)?.all).toHaveLength(13);
  });
});
