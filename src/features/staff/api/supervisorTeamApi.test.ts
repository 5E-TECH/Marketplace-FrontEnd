import axios from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { findMockUserById, mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { httpClient } from '../../../shared/api/httpClient';
import { memberState } from '../model/teamTypes';
import { blockUser } from './staffApi';
import {
  activateMember, addTeamMember, deactivateMember, getMemberHistory, getSupervisorTeam, requestMemberBlock, requestMemberUnblock, updateTeamMember,
} from './supervisorTeamApi';

/** FE-15 nazoratchi «Jamoa» (15-qaror — asosiy variant): taklif `/supervisor/team` (§14) — mock orqali. */
const as = (role: string) => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole(role as never))}`;
};
const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return axios.isAxiosError(error) ? error.response?.status : 'not-axios';
  }
  return 'ok';
};
const meWith = (token: string) => statusOf(httpClient.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } }));

afterEach(() => {
  delete httpClient.defaults.headers.common.Authorization;
});

describe('nazoratchi jamoasi', () => {
  it('faqat nazoratchi: o‘z jamoasi — 13 operator, Kamron D. bloklangan; softfon bilan', async () => {
    as('ADMIN');
    expect(await statusOf(getSupervisorTeam())).toBe(403);
    as('SUPERVISOR');
    const team = await getSupervisorTeam();
    expect(team.team).toMatchObject({ id: 'T-1', supervisorId: 'U-0004' });
    expect(team.members).toHaveLength(13);
    const kamron = team.members.find((member) => member.user.id === 'U-1078');
    expect(kamron && memberState(kamron)).toBe('BLOCKED');
    expect(team.members.find((member) => member.user.id === 'U-1059')?.softphone).toMatchObject({ account: '1059', status: 'REGISTERED' });
  });

  it('qo‘shish o‘z jamoasiga; tahrirlash — band telefon 409; ism va ish joyi o‘zgaradi, auditda', async () => {
    as('SUPERVISOR');
    const added = await addTeamMember({ firstName: 'Bahrom', lastName: 'Olimov', phone: '+998912457013', workspace: 'SIP' });
    expect(added).toMatchObject({ smsSent: true, member: { user: { code: 'U-2088' }, softphone: { account: '2088', workspace: 'SIP', neverConnected: true } } });
    expect(memberState(added.member)).toBe('NEVER_LOGGED_IN');
    expect(findMockUserById('U-2088')?.staff?.teamId).toBe('T-1');
    expect(await statusOf(updateTeamMember({ id: 'U-1054', firstName: 'Lola', lastName: 'Azimova', phone: '+998900000007', workspace: 'BROWSER' }))).toBe(409);
    const saved = await updateTeamMember({ id: 'U-1054', firstName: 'Lola', lastName: 'Karimova', phone: '+998978254361', workspace: 'SIP' });
    expect(saved.user.name).toBe('Lola Karimova');
    expect(saved.softphone?.workspace).toBe('SIP');
    expect(db.userAudit[0]).toMatchObject({ action: 'supervisor.operator.update', entityId: 'U-1054' });
  });

  it('nofaol qilish: suhbatda — 409; aks holda tokeni darhol bekor, softfon to‘xtaydi; faollashtirish qaytaradi', async () => {
    as('SUPERVISOR');
    expect(await statusOf(deactivateMember({ id: 'U-1059', reason: 'Ta’til' }))).toBe(409);
    const token = mockTokenFor(findMockUserById('U-1055') ?? { phone: '' });
    expect(await meWith(token)).toBe('ok');
    await deactivateMember({ id: 'U-1055', reason: 'Ta’tilga chiqdi' });
    expect(await meWith(token)).toBe(401);
    const team = await getSupervisorTeam();
    const marjona = team.members.find((member) => member.user.id === 'U-1055');
    expect(marjona && memberState(marjona)).toBe('INACTIVE');
    expect(marjona).toMatchObject({ inactive: { by: 'Rustam Qodirov', reason: 'Ta’tilga chiqdi' }, softphone: { status: 'DISABLED' } });
    await activateMember('U-1055');
    expect(findMockUserById('U-1055')?.isActive).toBe(true);
  });

  it('bloklashni so‘rash (javobgacha nofaol bilan) → «Bloklash so‘ralgan»; admin bloklasa so‘rov yopiladi; tarix', async () => {
    as('SUPERVISOR');
    expect(await statusOf(requestMemberBlock({ id: 'U-1062', reason: '  ', deactivate: false }))).toBe(400);
    await requestMemberBlock({ id: 'U-1062', reason: 'Soxta tasdiq', deactivate: false });
    let temur = (await getSupervisorTeam()).members.find((member) => member.user.id === 'U-1062');
    expect(temur && memberState(temur)).toBe('BLOCK_REQUESTED');
    expect((await getMemberHistory('U-1062'))[0]).toMatchObject({ action: 'supervisor.block.request' });
    as('ADMIN');
    await blockUser({ id: 'U-1062', reason: 'So‘rov bo‘yicha' });
    as('SUPERVISOR');
    temur = (await getSupervisorTeam()).members.find((member) => member.user.id === 'U-1062');
    expect(temur?.request).toBeNull();
    expect(temur && memberState(temur)).toBe('BLOCKED');
    await requestMemberUnblock({ id: 'U-1062', reason: 'Tekshiruv tugadi' });
    expect(findMockUserById('U-1062')?.staff?.request).toMatchObject({ kind: 'UNBLOCK' });
  });
});
