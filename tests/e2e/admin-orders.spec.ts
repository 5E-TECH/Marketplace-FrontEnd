import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }),
  }));
  await page.route('**/api/v1/admin/orders**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } }),
  }));
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`admin orders filtrlari ${viewport.name} ekranda sig‘adi`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/admin/orders');

    const filters = page.getByRole('region', { name: 'Buyurtma filtrlari' });
    await expect(filters).toBeVisible();
    await expect(filters.getByLabel('Market ID')).toBeVisible();
    await expect(filters.getByLabel('Boshlanish sanasi')).toBeVisible();
    await expect(filters.getByLabel('Tugash sanasi')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('admin order list filtrlari va detail requesti to‘g‘ri yuboriladi', async ({ page }) => {
  const order = { id: '91', orderNumber: 'A-91', buyerName: 'Ali Valiyev', shopId: '7', totalAmount: 250000, paymentMethod: 'cod', status: 'CONFIRMED', createdAt: '2026-09-03T10:00:00.000Z' };
  let detailRequested = false;
  await page.route('**/api/v1/admin/orders**', async (route) => {
    const request = route.request();
    if (/\/admin\/orders\/91$/.test(request.url())) {
      detailRequested = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...order, items: [] } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [order], total: 1, page: 1, limit: 20, totalPages: 1 } }) });
  });

  await page.goto('/admin/orders');
  await page.getByLabel('Market ID').fill('7');
  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/admin/orders')
      && url.searchParams.get('page') === '1'
      && url.searchParams.get('limit') === '20'
      && url.searchParams.get('status') === 'CONFIRMED'
      && url.searchParams.get('shopId') === '7';
  });
  await page.locator('#admin-order-status').click();
  await page.getByText('CONFIRMED', { exact: true }).last().click();
  await filteredRequest;

  await page.getByRole('button', { name: 'Buyurtma tafsilotlari' }).click();
  await expect.poll(() => detailRequested).toBe(true);
  await expect(page.getByRole('dialog')).toContainText('Ali Valiyev');
  await expect(page.getByRole('button', { name: 'Buyurtma yaratish' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Buyurtmani o‘chirish' })).toHaveCount(0);
});
