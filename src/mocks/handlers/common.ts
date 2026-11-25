import { http } from 'msw';
import { db } from '../db';
import { OFFER_CATEGORIES } from '../fixtures/offers';
import { REGION_TREE } from '../fixtures/regions';
import { MOCK_AFFILIATES } from '../orderStore';
import { MOCK_USERS } from '../fixtures/users';
import { API, fail, ok, pageOf } from '../utils';
import { currentMockUser } from './auth';


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

  http.get(`${API}/admin/users`, ({ request, cookies }) => {
    const denied = requireUser(request, cookies, ADMIN_ROLES);
    if (denied) return denied;
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    // FE-26: lid/buyurtma filtrlaridagi sotuvchilar (orderStore) ham ro'yxatda.
    const extra = MOCK_AFFILIATES.filter((item) => !Object.values(MOCK_USERS).some((user) => user.id === item.id))
      .map((item) => ({ ...Object.values(MOCK_USERS)[0], id: item.id, role: 'AFFILIATE' as const, name: item.fullName, phone: `+99890${item.id.slice(-4)}000` }));
    const users = [...Object.values(MOCK_USERS), ...extra]
      .filter((user) => !role || user.role === role)
      .map((user) => ({ ...user, shopId: null, createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-10T08:00:00.000Z' }));
    return ok(pageOf(users, url));
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
