import { http } from 'msw';
import type { components } from '../../generated/api-types';
import { db } from '../db';
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

/** Bildirishnomalar, viloyatlar va hozir ulangan admin sahifalari (Kategoriyalar, Qoldiq, Audit, Foydalanuvchilar). */
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

  http.get(`${API}/regions/tree`, () => {
    const tree: Schemas['LeadRegionGroupDto'][] = [
      { satoCode: '1726', name: 'Toshkent shahri', districts: [{ satoCode: '1726277', name: 'Chilonzor tumani' }, { satoCode: '1726262', name: 'Yunusobod tumani' }] },
      { satoCode: '1730', name: 'Farg‘ona viloyati', districts: [{ satoCode: '1730412', name: 'Qo‘qon shahri' }, { satoCode: '1730401', name: 'Farg‘ona shahri' }] },
    ];
    return ok(tree);
  }),

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
  http.get(`${API}/admin/categories`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    return ok([
      { id: '1', name: 'Elektronika', slug: 'elektronika', parentId: null, iconUrl: null, sortOrder: 0, isActive: true, children: [] },
      { id: '2', name: 'Oshxona', slug: 'oshxona', parentId: null, iconUrl: null, sortOrder: 1, isActive: true, children: [] },
    ]);
  }),
  http.get(`${API}/admin/inventory/:kind`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    return ok({ items: [], total: 0, page: 1, limit: 20, totalPages: 1, warnings: [], searchTruncated: false });
  }),
  http.get(`${API}/admin/audit`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    return ok({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
  }),
];
