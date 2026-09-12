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
  await page.route('**/api/v1/admin/products**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/v1/admin/finance/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/health**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }));
}

test('TC1: barcha sakkiz admin route direct URL orqali ochiladi', async ({ page }) => {
  await installAuthenticatedSession(page, superadmin);
  await mockAdminEndpoints(page);
  const routes = ['/admin/overview', '/admin/shops', '/admin/orders', '/admin/products', '/admin/users', '/admin/categories', '/admin/finance', '/admin/system-settings'];
  for (const path of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByTestId('admin-layout')).toBeVisible();
    await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
    await expect(page.getByText('Sahifa topilmadi')).toHaveCount(0);
  }
});

test('TC3: ADMIN va SUPERADMIN kiradi, SELLER admin route’dan qaytariladi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await mockAdminEndpoints(page);
  await page.goto('/admin/overview');
  await expect(page.getByTestId('admin-layout')).toBeVisible();

  await installAuthenticatedSession(page, superadmin);
  await page.reload();
  await expect(page.getByTestId('admin-layout')).toBeVisible();

  await installAuthenticatedSession(page);
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
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
  await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
});
