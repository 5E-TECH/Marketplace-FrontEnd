import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const admin = {
  id: 'route-admin', role: 'ADMIN', name: 'Route Admin', phone: '+998901234567',
  isActive: true, isDeleted: false,
} as const;
const superadmin = { ...admin, id: 'route-superadmin', role: 'SUPERADMIN', name: 'Route Superadmin' } as const;

async function mockAdminEndpoints(page: Page) {
  await page.route('**/api/v1/admin/dashboard', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { shops: { total: 0, pending: 0, active: 0, suspended: 0, rejected: 0 }, users: { total: 0, sellers: 0, buyers: 0, admins: 0, operators: 0 }, orders: { total: 0, today: 0 }, gmv: 0, revenue: 0 } }) }));
  await page.route('**/api/v1/admin/shops**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20 } }) }));
  await page.route('**/api/v1/admin/orders**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/returns**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/products**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/v1/admin/finance/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } }) }));
  await page.route('**/api/v1/admin/inventory/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0, warnings: [], searchTruncated: false } }) }));
  await page.route('**/api/v1/admin/integration/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/notifications/templates**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/v1/admin/broadcasts**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } }) }));
  await page.route('**/health**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }));
}

test('TC1: M1 admin menyusidagi har bir route direct URL orqali ochiladi', async ({ page }) => {
  // O'n beshta sahifa ketma-ket ochiladi — yuklama ostida umumiy 30 s yetmaydi.
  test.setTimeout(90_000);
  await installAuthenticatedSession(page, superadmin);
  await mockAdminEndpoints(page);
  const routes = [
    '/admin/moderation', '/admin/leads', '/admin/orders', '/admin/products', '/admin/categories', '/admin/inventory',
    '/admin/sellers', '/admin/wholesalers', '/admin/recordings', '/admin/audit-logs', '/admin/users', '/admin/users/new',
    '/admin/integrations', '/admin/settings', '/admin/profile',
  ];
  for (const path of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByTestId('admin-layout')).toBeVisible();
    await expect(page.getByTestId('not-found-page')).toHaveCount(0);
    await expect(page.getByTestId('forbidden-page')).toHaveCount(0);
  }
});

test('eski admin sahifalari uzilgan: admin karkasi ichida 404', async ({ page }) => {
  test.setTimeout(60_000);
  await installAuthenticatedSession(page, admin);
  await mockAdminEndpoints(page);
  // `/admin/orders/:orderId` — FE-26 buyurtma kartasi (admin-buyurtma-karta), endi qonuniy marshrut.
  for (const path of ['/admin/overview', '/admin/shops', '/admin/delivery', '/admin/returns', '/admin/finance', '/admin/notifications', '/admin/banners', '/admin/system-settings']) {
    await page.goto(path);
    await expect(page.getByTestId('admin-layout')).toBeVisible();
    await expect(page.getByTestId('not-found-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeVisible();
  }
});

test('TC3: ADMIN va SUPERADMIN kiradi, sotuvchi admin route’da 403 ko‘radi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await mockAdminEndpoints(page);
  await page.goto('/admin/moderation');
  await expect(page.getByTestId('admin-layout')).toBeVisible();

  await installAuthenticatedSession(page, superadmin);
  await page.reload();
  await expect(page.getByTestId('admin-layout')).toBeVisible();

  await installAuthenticatedSession(page);
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await expect(page.getByTestId('forbidden-page')).toBeVisible();
  await expect(page.getByTestId('admin-layout')).toHaveCount(0);
});

test('TC4: F5 dan keyin admin route va sahifa saqlanadi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await mockAdminEndpoints(page);
  await page.goto('/admin/orders');
  await expect(page.getByTestId('admin-layout')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByTestId('admin-layout')).toBeVisible();
  await expect(page.getByTestId('not-found-page')).toHaveCount(0);
});
