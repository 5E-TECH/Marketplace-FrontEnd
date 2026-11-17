import { http } from 'msw';
import { findMockUser, MOCK_WRONG_PASSWORD, mockTokenFor, userFromMockToken, type MockUser } from '../fixtures/users';
import { API, bearerToken, fail, ok } from '../utils';

/**
 * Auth (identity): login, profil, refresh, chiqish, sessiyalar. Haqiqiy backenddagi
 * refresh cookie o'rnida oddiy mock cookie — yangi tab undan jim sessiya tiklaydi (TC2).
 */
const SESSION_COOKIE = 'elchi_mock_session';

const sessionCookie = (user: MockUser) => `${SESSION_COOKIE}=${user.phone.slice(-9)}; Path=/; SameSite=Lax`;
const clearedCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;

/** Bearer token (body rejimi) yoki mock cookie — qaysi foydalanuvchi so'rayapti. */
export function currentMockUser(request: Request, cookies: Record<string, string>): MockUser | null {
  return userFromMockToken(bearerToken(request)) ?? (cookies[SESSION_COOKIE] ? findMockUser(cookies[SESSION_COOKIE]) : null);
}

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { phone?: unknown; password?: unknown };
    const user = typeof body.phone === 'string' ? findMockUser(body.phone) : null;
    if (!user || typeof body.password !== 'string' || !body.password || body.password === MOCK_WRONG_PASSWORD) {
      return fail(401, 'UNAUTHENTICATED', 'Telefon yoki parol xato');
    }
    return ok({ accessToken: mockTokenFor(user) }, 200, { 'Set-Cookie': sessionCookie(user) });
  }),

  http.get(`${API}/auth/me`, ({ request, cookies }) => {
    const user = currentMockUser(request, cookies);
    return user ? ok(user) : fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
  }),

  http.post(`${API}/auth/refresh`, ({ cookies }) => {
    const user = cookies[SESSION_COOKIE] ? findMockUser(cookies[SESSION_COOKIE]) : null;
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Refresh token topilmadi');
    return ok({ accessToken: mockTokenFor(user) }, 200, { 'Set-Cookie': sessionCookie(user) });
  }),

  http.post(`${API}/auth/logout`, () => {
    return ok(null, 200, { 'Set-Cookie': clearedCookie });
  }),

  http.get(`${API}/auth/sessions`, ({ request, cookies }) => {
    if (!currentMockUser(request, cookies)) return fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
    return ok([{ id: 's-1', userAgent: request.headers.get('user-agent') ?? 'Brauzer', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(), current: true }]);
  }),
];
