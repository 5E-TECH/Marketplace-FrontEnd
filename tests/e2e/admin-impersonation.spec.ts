import { expect, test, type Page } from '@playwright/test';
import { ACCESS_TOKEN_KEY, authenticatedUser, mockDashboard, mockLogout, mockProducts, mockSellerShop, seedAccessToken } from './support/auth';
import { logoutViaUserMenu } from './support/shell';

/**
 * «Nomidan kirish» sessiyasi (BE-05 `POST /admin/users/{id}/impersonate`; FE-15 «Sotuvchilar» yorlig'i): alohida
 * 15 daqiqalik token, admin tokeni joyida qoladi; 401 da refresh qilinmaydi; muddat tugasa yoki «Chiqish» bosilsa —
 * admin sahifasiga qaytiladi, `/auth/logout` chaqirilmaydi.
 */
const ADMIN_TOKEN = 'admin.token';
const IMPERSONATION_TOKEN = 'imp.token';
const IMPERSONATION_KEY = 'elchi_impersonation';
const RETURN_TO = '/admin/users?tab=affiliates';

const seller = {
  id: '42', name: 'Ali Valiyev', phone: '+998901112233', email: null, avatarUrl: null, role: 'AFFILIATE',
  isActive: true, isBlocked: false, isDeleted: false, totpEnabledAt: null,
  createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-02T08:00:00.000Z',
};
const impersonatedSeller = { ...authenticatedUser, id: '42', name: 'Ali Valiyev', role: 'AFFILIATE' };
const superadmin = { id: 'admin-1', role: 'SUPERADMIN', name: 'Bosh Admin', phone: '+998900000001', isActive: true, isDeleted: false };

interface ApiLog { me: string[]; refresh: number; logout: number; impersonate: number }

async function mockAdminApi(page: Page): Promise<ApiLog> {
  const log: ApiLog = { me: [], refresh: 0, logout: 0, impersonate: 0 };
  // Mock qilinmagan so'rov dev proxy orqali haqiqiy backendga chiqmasin.
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'mock yo‘q' }) }));
  await mockLogout(page);
  await mockProducts(page);
  await mockDashboard(page);
  await mockSellerShop(page);
  await page.route('**/api/v1/auth/logout', (route) => { log.logout += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":null}' }); });
  await page.route('**/api/v1/auth/refresh', (route) => { log.refresh += 1; return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"refresh yo‘q"}' }); });
  await page.route('**/api/v1/auth/me', (route) => {
    const authorization = route.request().headers().authorization ?? '';
    log.me.push(authorization);
    if (authorization === `Bearer ${IMPERSONATION_TOKEN}`) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: impersonatedSeller }) });
    if (authorization === `Bearer ${ADMIN_TOKEN}`) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: superadmin }) });
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Token muddati tugagan"}' });
  });
  await page.route((url) => url.pathname === '/api/v1/admin/users', (route) => {
    const role = new URL(route.request().url()).searchParams.get('role');
    const items = role === 'AFFILIATE' ? [seller] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items, total: items.length, page: 1, limit: 10, totalPages: 1 } }) });
  });
  await page.route('**/api/v1/admin/users/42/impersonate', (route) => {
    log.impersonate += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
      impersonationToken: IMPERSONATION_TOKEN, expiresIn: 900, expiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: { id: '42', name: 'Ali Valiyev', role: 'AFFILIATE' },
    } }) });
  });
  return log;
}

async function seedImpersonation(page: Page, expiresInMs: number, token = IMPERSONATION_TOKEN) {
  await page.addInitScript(({ adminKey, adminToken, key, value }) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    sessionStorage.setItem(adminKey, adminToken);
    sessionStorage.setItem(key, value);
  }, {
    adminKey: ACCESS_TOKEN_KEY,
    adminToken: ADMIN_TOKEN,
    key: IMPERSONATION_KEY,
    value: JSON.stringify({ token, expiresAt: new Date(Date.now() + expiresInMs).toISOString(), returnTo: RETURN_TO, user: { id: '42', name: 'Ali Valiyev', role: 'AFFILIATE' } }),
  });
}

test('SUPERADMIN sotuvchi nomidan kiradi: ogohlantirish chizig‘i, alohida token va chiqish', async ({ page }) => {
  await seedAccessToken(page, ADMIN_TOKEN);
  const log = await mockAdminApi(page);
  await page.goto(RETURN_TO);

  await page.getByRole('button', { name: 'Ali V. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Nomidan kirish' }).click();
  const confirm = page.getByRole('dialog', { name: 'Ali V. nomidan kirilsinmi?' });
  await expect(confirm).toContainText('15 daqiqa');
  await confirm.getByRole('button', { name: 'Nomidan kirish' }).click();

  await expect(page).toHaveURL('/affiliate');
  const banner = page.getByTestId('impersonation-banner');
  await expect(banner).toContainText('Siz Ali Valiyev nomidan ko‘ryapsiz');
  await expect(banner).toContainText(/1[45]:\d\d/);
  expect(log.impersonate).toBe(1);
  expect(log.me.at(-1)).toBe(`Bearer ${IMPERSONATION_TOKEN}`);
  // Admin token'i o'z joyida qoladi, impersonatsiya alohida saqlanadi.
  expect(await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY)).toBe(ADMIN_TOKEN);

  // Sahifa yangilansa ham chiziq va impersonatsiya saqlanadi.
  await page.reload();
  await expect(page.getByTestId('impersonation-banner')).toContainText('Ali Valiyev');
  expect(log.me.at(-1)).toBe(`Bearer ${IMPERSONATION_TOKEN}`);

  await page.getByTestId('impersonation-banner').getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(RETURN_TO);
  await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
  await expect(page.getByText('O‘z hisobingizga qaytdingiz')).toBeVisible();
  expect(log.me.at(-1)).toBe(`Bearer ${ADMIN_TOKEN}`);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), IMPERSONATION_KEY)).toBeNull();
  expect(log.logout).toBe(0);
});

test('nomidan kirish tokeni 401 bersa refresh qilinmaydi va admin sahifasiga qaytiladi', async ({ page }) => {
  const log = await mockAdminApi(page);
  await seedImpersonation(page, 600_000, 'imp.expired');
  await page.goto('/');

  await expect(page).toHaveURL(RETURN_TO);
  await expect(page.getByText('Nomidan kirish muddati tugadi — o‘z hisobingizga qaytdingiz')).toBeVisible();
  await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
  expect(log.refresh).toBe(0);
  expect(log.me).toContain(`Bearer ${ADMIN_TOKEN}`);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), IMPERSONATION_KEY)).toBeNull();
});

test('15 daqiqalik muddat tugashi bilan avtomatik admin hisobiga qaytadi', async ({ page }) => {
  await mockAdminApi(page);
  await seedImpersonation(page, 8_000);
  await page.goto('/');
  await expect(page.getByTestId('impersonation-banner')).toContainText('Ali Valiyev');
  await expect(page).toHaveURL(RETURN_TO, { timeout: 15_000 });
  await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
});

test('nomidan kirish paytida «Chiqish» /auth/logout chaqirmaydi, faqat impersonatsiyadan chiqaradi', async ({ page }) => {
  const log = await mockAdminApi(page);
  await seedImpersonation(page, 600_000);
  await page.goto('/');
  await expect(page.getByTestId('impersonation-banner')).toBeVisible();

  await logoutViaUserMenu(page);
  await expect(page).toHaveURL(RETURN_TO);
  expect(log.logout).toBe(0);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY)).toBe(ADMIN_TOKEN);
});
