import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const superadmin = {
  id: 'navigation-superadmin', role: 'SUPERADMIN', name: 'Navigation Admin',
  phone: '+998901234567', isActive: true, isDeleted: false,
} as const;

const availableItems = [
  ['Dashboard', '/admin/overview'],
  ['Accountlar', '/admin/users'],
  ['Do‘konlar', '/admin/shops'],
  ['Buyurtmalar', '/admin/orders'],
  ['Mahsulot moderatsiyasi', '/admin/products'],
  ['Kategoriyalar', '/admin/categories'],
  ['Bannerlar', '/admin/banners'],
  ['Audit loglar', '/admin/audit-logs'],
  ['Moliya', '/admin/finance'],
  ['Tizim holati', '/admin/system-settings'],
] as const;

const unavailableItems = [
  ['Sotuvchilar', '/admin/sellers'],
  ['Komissiya tarixi', '/admin/payout-history'],
  ['Brendlar', '/admin/brands'],
  ['Atributlar', '/admin/attributes'],
  ['Tranzaksiyalar', '/admin/transactions'],
  ['Omborlar', '/admin/warehouses'],
  ['Qoldiq monitoringi', '/admin/stock'],
  ['Transfer so‘rovlari', '/admin/transfers'],
  ['Promokodlar', '/admin/promocodes'],
  ['Flash sale va kolleksiyalar', '/admin/collections'],
  ['Sharh moderatsiyasi', '/admin/reviews'],
  ['Reyting va shikoyatlar', '/admin/disputes'],
  ['Jamoa', '/admin/team'],
] as const;

async function mockAdminEndpoints(page: Page) {
  await page.route('**/api/v1/admin/dashboard', (route) => route.fulfill({ status: 200, json: { data: { shops: { total: 0, pending: 0, active: 0, suspended: 0, rejected: 0 }, users: { total: 0, sellers: 0, buyers: 0, admins: 0, operators: 0 }, orders: { total: 0, today: 0 }, gmv: 0, revenue: 0 } } }));
  await page.route('**/api/v1/admin/shops**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20 } } }));
  await page.route('**/api/v1/admin/orders**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/api/v1/admin/products**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({ status: 200, json: { data: [] } }));
  await page.route('**/api/v1/admin/content/banners**', (route) => route.fulfill({ status: 200, json: { data: [] } }));
  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/api/v1/admin/finance/**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/health**', (route) => route.fulfill({ status: 200, json: { status: 'ok' } }));
}

test('SUPERADMIN menyusida faqat sahifasi mavjud bo‘lgan bo‘limlar turadi va ishlaydi', async ({ page }) => {
  await installAuthenticatedSession(page, superadmin);
  await mockAdminEndpoints(page);
  await page.goto('/admin/overview');

  const sidebar = page.getByRole('complementary', { name: 'Admin menyusi' });
  await expect(sidebar.getByRole('menuitem')).toHaveCount(availableItems.length);
  for (const [label] of unavailableItems) {
    await expect(sidebar.getByRole('menuitem', { name: label })).toHaveCount(0);
  }

  for (const [label, path] of availableItems) {
    await sidebar.getByRole('menuitem', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByText('Bu bo‘lim hali mavjud emas')).toHaveCount(0);
    await expect(page.getByText('Sahifa topilmadi')).toHaveCount(0);
  }
});

for (const [label, path] of unavailableItems) {
  test(`${label} yashirin URL placeholder emas, 404 sahifaga tushadi`, async ({ page }) => {
    await installAuthenticatedSession(page, superadmin);
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByText('Sahifa topilmadi')).toBeVisible();
    await expect(page.getByText('Bu bo‘lim hali mavjud emas')).toHaveCount(0);
  });
}
