import { expect, test, type Page, type Route } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const adminUser = {
  id: 'dashboard-admin', role: 'ADMIN', name: 'Dashboard Admin',
  phone: '+998901234567', isActive: true, isDeleted: false,
} as const;

const dashboard = {
  shops: { total: 12, pending: 2, active: 8, suspended: 1, rejected: 1 },
  users: { total: 75, sellers: 11, buyers: 57, admins: 2, operators: 5 },
  orders: { total: 320, today: 7 },
  gmv: 54_000_000,
  revenue: 2_700_000,
};

const pendingShop = {
  id: '15', ownerUserId: '42', name: 'Tasdiq Market', slug: 'tasdiq-market',
  description: null, logoUrl: null, bannerUrl: null, status: 'PENDING',
  phone: '+998901112233', regionId: '1', districtId: '2', address: 'Toshkent',
  rating: 0, ordersCount: 0, elchiMarketId: null, isDeleted: false,
  createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
};

const fulfillJson = (route: Route, data: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
});

async function mockPendingShops(page: Page, items = [pendingShop]) {
  await page.route('**/api/v1/admin/shops?**', (route) => fulfillJson(route, {
    items, total: items.length, page: 1, limit: 5,
  }));
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
});

test('TC1: statistika kartalari GET /admin/dashboard qiymatlarini ko‘rsatadi', async ({ page }) => {
  let dashboardRequested = false;
  await page.route('**/api/v1/admin/dashboard', (route) => {
    dashboardRequested = true;
    return fulfillJson(route, dashboard);
  });
  await mockPendingShops(page);
  await page.goto('/admin/overview');

  await expect.poll(() => dashboardRequested).toBe(true);
  const statistics = page.getByRole('region', { name: 'Asosiy statistika' });
  const expectedCards = [
    ['Do‘konlar', '12'], ['Sotuvchilar', '11'], ['Buyurtmalar', '320'],
    ['Savdo hajmi', '54 000 000 UZS'], ['Daromad', '2 700 000 UZS'],
  ];
  for (const [title, value] of expectedCards) {
    const card = statistics.locator('article').filter({ hasText: title });
    await expect(card).toContainText(value);
  }
});

test('tasdiq kutayotgan do‘konlar API dan chiqadi va barcha do‘konlarga o‘tadi', async ({ page }) => {
  await page.route('**/api/v1/admin/dashboard', (route) => fulfillJson(route, dashboard));
  await mockPendingShops(page);
  await page.route('**/api/v1/admin/shops/15', (route) => fulfillJson(route, {}));
  await page.goto('/admin/overview');

  await expect(page.getByText('Tasdiq Market', { exact: true })).toBeVisible();
  await expect(page.getByText('+998901112233')).toBeVisible();
  await page.getByRole('button', { name: 'Barchasini ko‘rish' }).click();
  await expect(page).toHaveURL(/\/admin\/shops$/);
});

test('TC2: bo‘sh platformada kartalar nol va pending empty state ko‘rsatadi', async ({ page }) => {
  const zeroDashboard = {
    shops: { total: 0, pending: 0, active: 0, suspended: 0, rejected: 0 },
    users: { total: 0, sellers: 0, buyers: 0, admins: 0, operators: 0 },
    orders: { total: 0, today: 0 }, gmv: 0, revenue: 0,
  };
  await page.route('**/api/v1/admin/dashboard', (route) => fulfillJson(route, zeroDashboard));
  await mockPendingShops(page, []);
  await page.goto('/admin/overview');

  const statistics = page.getByRole('region', { name: 'Asosiy statistika' });
  await expect(statistics.locator('article')).toHaveCount(5);
  for (const card of await statistics.locator('article').all()) await expect(card.locator('strong')).toContainText('0');
  await expect(page.getByText('Tasdiq kutayotgan do‘kon yo‘q')).toBeVisible();
});

test('TC3: loading holatida dashboard skeleton ko‘rinadi', async ({ page }) => {
  await page.route('**/api/v1/admin/dashboard', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await fulfillJson(route, dashboard);
  });
  await mockPendingShops(page);
  await page.goto('/admin/overview');

  await expect(page.getByLabel('Dashboard yuklanmoqda')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('TC5: dashboard xatosi ko‘rinadi va retry ma’lumotni tiklaydi', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/admin/dashboard', (route) => {
    attempts += 1;
    return attempts === 1 ? fulfillJson(route, { message: 'Bad request' }, 400) : fulfillJson(route, dashboard);
  });
  await mockPendingShops(page);
  await page.goto('/admin/overview');

  await expect(page.getByText('Dashboard ma’lumotlarini yuklab bo‘lmadi')).toBeVisible();
  await page.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(page.getByRole('region', { name: 'Asosiy statistika' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('TC4: Ko‘rish tugmasi tanlangan do‘kon detalini ochadi', async ({ page }) => {
  await page.route('**/api/v1/admin/dashboard', (route) => fulfillJson(route, dashboard));
  await mockPendingShops(page);
  await page.route('**/api/v1/admin/shops/15', (route) => fulfillJson(route, {
    id: '15', ownerUserId: '42', name: 'Tasdiq Market', status: 'PENDING',
    stats: { products: 12, orders: 28, warehouses: 2 },
  }));
  await page.goto('/admin/overview');

  await page.getByRole('button', { name: 'Ko‘rish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/shops\?shopId=15$/);
  await expect(page.getByText('Do‘kon moderatsiyasi')).toBeVisible();
  await expect(page.getByText('Tasdiq Market', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  await expect(page.getByText('28', { exact: true })).toBeVisible();
});
