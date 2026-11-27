import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { findMockUserById, mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { server } from '../../../mocks/node';
import { httpClient } from '../../../shared/api/httpClient';
import { STAFF_ROLES } from '../model/staffTypes';
import {
  blockUser,
  changeUserRole,
  createStaff,
  endAllUserSessions,
  existingUserOf,
  getAccountsPage,
  getAuditEntries,
  getStaff,
  getTeams,
  getUserSessions,
  impersonateUser,
  resetUserTwoFactor,
  unblockUser,
} from './staffApi';

/** FE-15: foydalanuvchilar (BE-05, BE-26, BE-27) — mock orqali, backend qoidalari va taklif maydonlari bilan. */
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

/** Xodim o'z tokeni bilan — CurrentRoleGuard: bloklangan yoki roli o'zgargan bo'lsa darhol 401. */
const meWith = (token: string) => statusOf(httpClient.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } }));

afterEach(() => {
  delete httpClient.defaults.headers.common.Authorization;
});

describe('xodimlar ro‘yxati va karta', () => {
  it('har rol alohida so‘raladi: superadmin (taklif), 13 operator, jamoa va roli noma’lum hisob', async () => {
    as('ADMIN');
    const staff = await getStaff({ roles: STAFF_ROLES, includeUnknown: true });
    const operators = staff.filter((user) => user.role === 'OPERATOR_LEAD');
    expect(operators).toHaveLength(13);
    expect(operators.filter((user) => user.isBlocked).map((user) => user.name)).toEqual(['Kamron Davletov']);
    expect(operators.every((user) => user.team?.supervisorName === 'Rustam Qodirov')).toBe(true);
    expect(staff.some((user) => user.role === 'SUPERADMIN')).toBe(true);
    expect(staff.filter((user) => user.role === null).map((user) => [user.code, user.roleRaw])).toEqual([['U-2087', 'SELLER']]);
    expect(staff.some((user) => user.role === 'AFFILIATE')).toBe(false);
    expect((await getStaff({ roles: STAFF_ROLES, search: 'lola' })).map((user) => user.name)).toEqual(['Lola Azimova']);
  });

  it('backend taklif parametrini rad etsa (400) — roli noma’lum hisoblar so‘ralmaydi, ro‘yxat ishlaydi', async () => {
    as('ADMIN');
    server.use(http.get('*/api/v1/admin/users', ({ request }) => (new URL(request.url).searchParams.has('unknownRole')
      ? HttpResponse.json({ statusCode: 400, message: 'property unknownRole should not exist', errorCode: 'VALIDATION_ERROR', details: [{ field: 'unknownRole', error: 'property unknownRole should not exist' }] }, { status: 400 })
      : undefined)));
    const staff = await getStaff({ roles: ['FINANCE'], includeUnknown: true });
    expect(staff.map((user) => user.name).sort()).toEqual(['Gulnora Saidova', 'Ozoda Botirova']);
  });

  it('taklif maydonlari kelmasa — undefined (ekranda «—»), «hali kirmagan» deb taxmin qilinmaydi', async () => {
    as('ADMIN');
    server.use(http.get('*/api/v1/admin/users', () => HttpResponse.json({ data: { items: [{ id: '1051', role: 'OPERATOR_LEAD', name: 'Dilnoza Rahimova', phone: '+998900000003', isActive: true, isBlocked: false, totpEnabledAt: null, createdAt: '2026-11-01T08:00:00.000Z' }], total: 1, page: 1, limit: 100, totalPages: 1 } })));
    const [user] = await getStaff({ roles: ['OPERATOR_LEAD'] });
    expect(user).toMatchObject({ code: 'U-1051', firstName: 'Dilnoza', lastName: 'Rahimova', lastLoginAt: undefined, team: undefined });
  });
});

describe('xodim qo‘shish (POST /admin/team)', () => {
  it('operator jamoa bilan qo‘shiladi: SMS ketgan, ID U-2088, hali kirmagan; audit yozuvi', async () => {
    as('ADMIN');
    const result = await createStaff({ firstName: 'Bahrom', lastName: 'Olimov', phone: '+998912457013', role: 'OPERATOR_LEAD', teamId: 'T-1' });
    expect(result).toMatchObject({ smsSent: true, user: { code: 'U-2088', name: 'Bahrom Olimov', role: 'OPERATOR_LEAD' } });
    expect(findMockUserById('U-2088')?.staff).toMatchObject({ lastLoginAt: null, teamId: 'T-1' });
    expect(db.userAudit[0]).toMatchObject({ action: 'admin.team.create', entityId: 'U-2088', actorId: 'U-0007' });
  });

  it('band raqam — 409 va kimniki (taklif `existingUser`); superadmin rolini admin bera olmaydi', async () => {
    as('ADMIN');
    let error: unknown;
    await createStaff({ firstName: 'Ali', lastName: 'Valiyev', phone: '+998900000009', role: 'WAREHOUSE' }).catch((reason: unknown) => { error = reason; });
    expect(existingUserOf(error)).toEqual({ id: 'U-2087', name: 'Laylo Nazarova' });
    expect(await statusOf(createStaff({ firstName: 'Ali', lastName: 'Valiyev', phone: '+998931112233', role: 'SUPERADMIN' }))).toBe(403);
  });

  it('backend taklif maydonlarini rad etsa — ism bitta `name` bilan qayta yuboriladi; parol SMS siz bir marta qaytadi', async () => {
    as('SUPERADMIN');
    const bodies: Record<string, unknown>[] = [];
    server.use(http.post('*/api/v1/admin/team', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      if ('firstName' in body) return HttpResponse.json({ statusCode: 400, message: ['property firstName should not exist', 'property lastName should not exist'], errorCode: 'VALIDATION_ERROR', details: [{ field: 'firstName', error: 'property firstName should not exist' }, { field: 'lastName', error: 'property lastName should not exist' }] }, { status: 400 });
      return HttpResponse.json({ data: { id: '2088', name: body.name, phone: body.phone, role: body.role, isActive: true, createdAt: '2026-11-26T09:00:00.000Z', updatedAt: '2026-11-26T09:00:00.000Z', temporaryPassword: 'aB3dE5fG7hJ9kL1m' } }, { status: 201 });
    }));
    const result = await createStaff({ firstName: 'Bahrom', lastName: 'Olimov', phone: '+998912457013', role: 'WAREHOUSE' });
    expect(bodies[1]).toEqual({ name: 'Bahrom Olimov', phone: '+998912457013', role: 'WAREHOUSE' });
    expect(result).toMatchObject({ temporaryPassword: 'aB3dE5fG7hJ9kL1m', smsSent: false, user: { code: 'U-2088', firstName: 'Bahrom', lastName: 'Olimov' } });
  });
});

describe('rol, bloklash va 2FA (TC1, TC2, TC4, TC5)', () => {
  it('TC1/TC4: operatorga nazoratchi roli — eski token 401, yangi token bilan rol SUPERVISOR; auditda eski va yangi', async () => {
    const before = mockTokenFor(mockUserByRole('OPERATOR_LEAD'));
    as('SUPERADMIN');
    await changeUserRole({ id: 'U-0003', role: 'SUPERVISOR' });
    expect(await meWith(before)).toBe(401);
    const me = await httpClient.get<{ data: { role: string } }>('/auth/me', { headers: { Authorization: `Bearer ${mockTokenFor(mockUserByRole('OPERATOR_LEAD'))}` } });
    expect(me.data.data.role).toBe('SUPERVISOR');
    const [entry] = await getAuditEntries({ entityType: 'User', entityId: 'U-0003', limit: 5 });
    expect(entry).toMatchObject({ action: 'user.role.update', meta: { before: { role: 'OPERATOR_LEAD' }, after: { role: 'SUPERVISOR' } } });
  });

  it('oxirgi superadmin o‘zini pasaytira olmaydi (409); admin o‘z rolini o‘zgartira olmaydi (403)', async () => {
    as('SUPERADMIN');
    expect(await statusOf(changeUserRole({ id: 'U-0008', role: 'ADMIN' }))).toBe(409);
    as('ADMIN');
    expect(await statusOf(changeUserRole({ id: 'U-0007', role: 'FINANCE' }))).toBe(403);
  });

  it('TC2: bloklash — xodimning tokeni darhol 401, sabab kartada; blokdan chiqqach yangi token ishlaydi', async () => {
    const warehouse = mockUserByRole('WAREHOUSE');
    const before = mockTokenFor(warehouse);
    as('ADMIN');
    await blockUser({ id: warehouse.id, reason: 'Inventarizatsiya farqi' });
    expect(await meWith(before)).toBe(401);
    expect(findMockUserById(warehouse.id)?.staff?.block).toMatchObject({ by: 'Nodira Karimova', reason: 'Inventarizatsiya farqi' });
    expect(await statusOf(blockUser({ id: 'U-0007', reason: 'x' }))).toBe(409);
    expect(await statusOf(blockUser({ id: 'U-0008', reason: 'x' }))).toBe(403);
    await unblockUser(warehouse.id);
    expect(await meWith(mockTokenFor(warehouse))).toBe('ok');
  });

  it('TC5: 2FA ni faqat superadmin tiklaydi — sir o‘chadi, «tiklandi» belgisi, sessiyalar tugaydi', async () => {
    as('ADMIN');
    expect(await statusOf(resetUserTwoFactor({ id: 'U-1009', reason: 'Telefon yo‘qoldi' }))).toBe(403);
    as('SUPERADMIN');
    await resetUserTwoFactor({ id: 'U-1009', reason: 'Telefon yo‘qoldi' });
    expect(db.twoFactor.accounts['911001009']).toMatchObject({ enabledAt: null, secret: null, reset: { by: 'Akmal Sobirov' } });
    const [ozoda] = (await getStaff({ roles: ['FINANCE'], search: 'Ozoda' }));
    expect(ozoda).toMatchObject({ totpEnabledAt: null, twoFactorReset: { by: 'Akmal Sobirov' } });
    expect(db.userAudit[0]).toMatchObject({ action: 'user.2fa.reset', entityId: 'U-1009', meta: { reason: 'Telefon yo‘qoldi' } });
  });
});

describe('taklif endpointlari', () => {
  it('sessiyalar: ro‘yxat va «Hammasini tugatish»; jamoalar', async () => {
    as('ADMIN');
    expect((await getUserSessions('U-0006'))?.map((session) => `${session.browser} · ${session.os}`)).toEqual(['Chrome · Windows', 'Safari · iPhone']);
    await endAllUserSessions('U-0006');
    expect(await getUserSessions('U-0006')).toEqual([]);
    expect(await getTeams()).toEqual([{ id: 'T-1', supervisor: { id: 'U-0004', name: 'Rustam Qodirov' }, operatorCount: 13, createdAt: expect.any(String) as string }]);
  });

  it('backendda yo‘q (404) — sessiyalar `null`, jamoalar bo‘sh: ekran xato bermaydi', async () => {
    as('ADMIN');
    server.use(
      http.get('*/api/v1/admin/users/:id/sessions', () => HttpResponse.json({ statusCode: 404, message: 'Cannot GET', errorCode: 'NOT_FOUND' }, { status: 404 })),
      http.get('*/api/v1/admin/teams', () => HttpResponse.json({ statusCode: 404, message: 'Cannot GET', errorCode: 'NOT_FOUND' }, { status: 404 })),
    );
    expect(await getUserSessions('U-0006')).toBeNull();
    expect(await getTeams()).toEqual([]);
  });
});

describe('«Sotuvchilar» yorlig‘i va nomidan kirish', () => {
  it('holat filtri: «Bloklangan» — `blocked=true`, jazolar — taklif `sanction`; sahifa kodi bo‘yicha qidiruv', async () => {
    as('ADMIN');
    const first = await getAccountsPage({ role: 'AFFILIATE', page: 1, limit: 10 });
    expect(first.total).toBe(41);
    expect(first.items[0]).toMatchObject({ name: 'Jasur Toshmatov', affiliate: { streams: 2, stoppedStreams: 0 }, sanction: null });
    const blocked = await getAccountsPage({ role: 'AFFILIATE', status: 'BLOCKED', page: 1, limit: 10 });
    expect(blocked.items.map((user) => [user.name, user.affiliate?.stoppedStreams, user.block?.reason])).toEqual([['Bobur Yoqubov', 1, 'Aldovli reklama']]);
    const hold = await getAccountsPage({ role: 'AFFILIATE', status: 'HOLD', page: 1, limit: 10 });
    expect(hold.items.map((user) => [user.name, user.sanction?.kind])).toEqual([['Ilhom Bakirov', 'HOLD']]);
    expect((await getAccountsPage({ role: 'AFFILIATE', status: 'ACTIVE', page: 1, limit: 10 })).total).toBe(38);
    expect((await getAccountsPage({ role: 'AFFILIATE', search: 'y3m9lc', page: 1, limit: 10 })).items.map((user) => user.name)).toEqual(['Diyor Saidov']);
  });

  it('backend `sanction` ni rad etsa (400) — parametrsiz qayta so‘raladi va sahifa joyida saralanadi', async () => {
    as('ADMIN');
    const sent: string[] = [];
    server.use(http.get('*/api/v1/admin/users', ({ request }) => {
      const url = new URL(request.url);
      sent.push(url.search);
      return url.searchParams.has('sanction')
        ? HttpResponse.json({ statusCode: 400, message: 'property sanction should not exist', errorCode: 'VALIDATION_ERROR', details: [{ field: 'sanction', error: 'property sanction should not exist' }] }, { status: 400 })
        : undefined;
    }));
    const page = await getAccountsPage({ role: 'AFFILIATE', status: 'WARNING', page: 1, limit: 10 });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toContain('blocked=false');
    expect(sent[1]).not.toContain('sanction');
    expect(page.items.map((user) => user.name)).toEqual(['Diyor Saidov']);
    expect(page).toMatchObject({ total: 1, totalPages: 1 });
  });

  it('nomidan kirish: faqat superadmin, faqat faol sotuvchi yoki optovik; javobda 15 daqiqalik token', async () => {
    as('ADMIN');
    expect(await statusOf(impersonateUser('U-0001'))).toBe(403);
    as('SUPERADMIN');
    const grant = await impersonateUser('U-0001');
    expect(grant.user).toEqual({ id: 'U-0001', name: 'Jasur Toshmatov', role: 'AFFILIATE' });
    expect(Date.parse(grant.expiresAt) - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(await meWith(grant.token)).toBe('ok');
    expect(db.userAudit[0]).toMatchObject({ action: 'user.impersonate', entityId: 'U-0001' });
    expect(await statusOf(impersonateUser('U-0110'))).toBe(409);
    expect(await statusOf(impersonateUser('U-0006'))).toBe(403);
  });
});
