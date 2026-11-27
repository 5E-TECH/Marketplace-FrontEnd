import { http } from 'msw';
import { db } from '../db';
import { OFFER_CATEGORIES } from '../fixtures/offers';
import { REGION_TREE } from '../fixtures/regions';
import { API, fail, ok, pageOf } from '../utils';
import { currentMockUser } from './auth';

const requireUser = (request: Request, cookies: Record<string, string>, roles?: readonly string[]) => {
  const user = currentMockUser(request, cookies);
  if (!user) return fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
  if (roles && !roles.includes(user.role)) return fail(403, 'FORBIDDEN', 'Bu bo‘lim sizga ochiq emas');
  return null;
};

/** Bildirishnomalar, viloyatlar va kategoriyalar (foydalanuvchilar — `staff.ts`; qoldiq, audit — `admin.ts`). */
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

  // Ochiq kategoriyalar daraxti (offerlar filtri «Kategoriya»).
  http.get(`${API}/categories`, () => ok(OFFER_CATEGORIES)),
];
