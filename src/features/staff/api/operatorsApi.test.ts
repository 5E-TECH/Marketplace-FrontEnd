import axios from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { findMockUserById, mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { httpClient } from '../../../shared/api/httpClient';
import { assignTeam, changeTeamSupervisor, createTeam, getOperatorsLive, getOperatorsStats, getSoftphones, statsRange, updateSoftphone } from './operatorsApi';
import { createStaff } from './staffApi';

/** FE-15 «Operatorlar jamoasi»: queue-summary (BE-13/BE-25) va taklif endpointlari (§13) — mock orqali. */
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

afterEach(() => {
  delete httpClient.defaults.headers.common.Authorization;
});

describe('operatorlar jamoasi', () => {
  it('jonli holat: xodim ID si bilan, holat qachondan (taklif) va telefoniya bosqichi', async () => {
    as('ADMIN');
    const live = await getOperatorsLive();
    const shohruh = live.find((item) => item.operatorId === 'U-1059');
    expect(shohruh).toMatchObject({ state: 'ONLINE', activeBookings: 2, maxBookings: 5, scheduledCalls: 4, activity: { kind: 'IN_CALL', leadId: 'L-1249' } });
    expect(shohruh?.since).toEqual(expect.any(String));
    expect(live.find((item) => item.operatorId === 'U-1066')?.state).toBe('BREAK');
  });

  it('softfon hisoblari: ID dan raqam, ro‘yxatda / ulanmagan / bloklanganda o‘chirilgan; stol telefoni', async () => {
    as('ADMIN');
    const phones = await getSoftphones();
    const byId = new Map((phones ?? []).map((item) => [item.operatorId, item]));
    expect(byId.get('U-1059')).toMatchObject({ account: '1059', status: 'REGISTERED', workspace: 'BROWSER' });
    expect(byId.get('U-1078')).toMatchObject({ account: '1078', status: 'DISABLED' });
    expect(byId.get('U-1055')).toMatchObject({ status: 'UNREGISTERED' });
    expect(byId.get('U-1057')?.workspace).toBe('SIP');
  });

  it('ish joyi: suhbatda bo‘lsa — suhbat tugagach (pendingWorkspace), bo‘sh bo‘lsa — darhol; mobil ilova — 400', async () => {
    as('ADMIN');
    expect(await updateSoftphone({ id: 'U-1059', workspace: 'SIP' })).toMatchObject({ workspace: 'BROWSER', pendingWorkspace: 'SIP' });
    expect(await updateSoftphone({ id: 'U-1055', workspace: 'SIP' })).toMatchObject({ workspace: 'SIP', pendingWorkspace: null });
    expect(db.userAudit[0]).toMatchObject({ action: 'operator.softphone.update', entityId: 'U-1055', meta: { before: { workspace: 'BROWSER' }, after: { workspace: 'SIP' } } });
    expect(await statusOf(updateSoftphone({ id: 'U-1055', workspace: 'APP' }))).toBe(400);
  });

  it('ko‘rsatkichlar: bugun va oxirgi 7 kun (Toshkent sanasi), yaroqli lidlar bilan', async () => {
    as('ADMIN');
    expect(statsRange('week', Date.parse('2026-11-27T10:00:00Z'))).toEqual({ from: '2026-11-21', to: '2026-11-27' });
    const today = await getOperatorsStats('today');
    expect(today?.find((row) => row.operatorId === 'U-0003')).toEqual({ operatorId: 'U-0003', attempts: 38, confirmed: 9, valid: 22, approveRate: 41, firstCallMedianMinutes: 4 });
    const week = await getOperatorsStats('week');
    expect(week?.find((row) => row.operatorId === 'U-0003')?.attempts).toBe(197);
  });

  it('jamoa: yangi operator ish joyi bilan, jamoaga biriktirish; band nazoratchi — 409; nazoratchi bo‘lmagan — 400', async () => {
    as('ADMIN');
    const created = await createStaff({ firstName: 'Bahrom', lastName: 'Olimov', phone: '+998912457013', role: 'OPERATOR_LEAD', teamId: null, workspace: 'SIP' });
    expect(findMockUserById(created.user.id)?.staff).toMatchObject({ workspace: 'SIP', teamId: null, softphoneConnected: false });
    await assignTeam({ id: created.user.id, teamId: 'T-1' });
    expect(findMockUserById(created.user.id)?.staff?.teamId).toBe('T-1');
    expect(db.userAudit[0]).toMatchObject({ action: 'user.team.update', meta: { before: { teamId: null }, after: { teamId: 'T-1' } } });
    expect(await statusOf(createTeam('U-0004'))).toBe(409);
    expect(await statusOf(changeTeamSupervisor({ teamId: 'T-1', supervisorId: 'U-1053' }))).toBe(400);
  });
});
