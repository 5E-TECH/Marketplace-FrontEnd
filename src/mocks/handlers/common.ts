import { http } from 'msw';
import type { components } from '../../generated/api-types';
import { db } from '../db';
import { OFFER_CATEGORIES } from '../fixtures/offers';
import { REGION_TREE } from '../fixtures/regions';
import { MOCK_USERS } from '../fixtures/users';
import { API, fail, ok, pageOf } from '../utils';
import { currentMockUser } from './auth';

type Schemas = components['schemas'];

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];

const requireUser = (request: Request, cookies: Record<string, string>, roles?: readonly string[]) => {
  const user = currentMockUser(request, cookies);
  if (!user) return fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
  if (roles && !roles.includes(user.role)) return fail(403, 'FORBIDDEN', 'Bu bo‘lim sizga ochiq emas');
  return null;
};

/** Bildirishnomalar, viloyatlar va admin lidlar/foydalanuvchilar ro'yxati (kategoriyalar, qoldiq, audit — `admin.ts`). */
export const commonHandlers = [
  http.get(`${API}/notifications`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies);
    if (denied) return denied;
    const items = [...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ ...pageOf(items, new URL(request.url)), unreadCount: items.filter((item) => !item.isRead).length });
  }),
  http.patch(`${API}/notifications/read-all`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies);
    if (denied) return denied;
    db.notifications.forEach((item) => { item.isRead = true; });
    return ok(null);
  }),
  http.patch(`${API}/notifications/:id/read`, ({ request, cookies, params }) => {
    const denied = requireUser(request, cookies);
    if (denied) return denied;
    db.notifications.forEach((item) => { if (item.id === params.id) item.isRead = true; });
    return ok(null);
  }),

  http.get(`${API}/regions/tree`, () => ok(REGION_TREE)),

  http.get(`${API}/admin/leads`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    const rows: Schemas['AdminLeadListItemDto'][] = db.operator.leads.map((lead, index) => ({
      id: lead.id, createdAt: new Date(Date.now() - (index + 1) * 25 * 60_000).toISOString(), status: lead.status, source: 'LANDING',
      customerName: lead.customerName, phoneMasked: '+998 ** *** 45 67', productName: lead.productName,
      affiliateName: 'Jasur T.', operatorName: lead.status === 'BOOKED' ? 'Dilnoza R.' : null, orderId: null,
    }));
    return ok(pageOf(rows, new URL(request.url)));
  }),

  http.get(`${API}/admin/users`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    const users = Object.values(MOCK_USERS).map((user) => ({ ...user, shopId: null, createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-10T08:00:00.000Z' }));
    return ok(pageOf(users, new URL(request.url)));
  }),
  http.get(`${API}/admin/users/:id`, ({ request, cookies, params }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    const user = Object.values(MOCK_USERS).find((item) => item.id === params.id);
    return user ? ok({ ...user, shopId: null, createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-10T08:00:00.000Z' }) : fail(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
  }),
  // Ochiq kategoriyalar daraxti (offerlar filtri «Kategoriya»).
  http.get(`${API}/categories`, () => ok(OFFER_CATEGORIES)),
];
