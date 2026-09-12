import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

const pendingShop = { id: '15', ownerUserId: '42', name: 'Ali Market', slug: 'ali-market', description: null, logoUrl: null, bannerUrl: null, status: 'PENDING', phone: '+998901234567', regionId: '1', districtId: '2', address: 'Toshkent', rating: 0, ordersCount: 0, elchiMarketId: null, isDeleted: false, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' };

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '1', role: 'ADMIN', name: 'Admin', phone: '+998900000000', email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false } }) }));
  await page.route('**/api/v1/admin/shops?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [pendingShop], total: 1, page: 1, limit: 20 } }) }));
  await page.route('**/api/v1/admin/shops/15', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '15', ownerUserId: '42', name: 'Ali Market', status: 'PENDING', stats: { products: 12, orders: 28, warehouses: 2 } } }) }));
});

test('pending list va detail statistikasi ko‘rinadi, approve ishlaydi', async ({ page }) => {
  let approved = false;
  await page.route('**/api/v1/admin/shops/15/approve', (route) => { approved = true; return route.fulfill({ status: 201, body: '{}' }); });
  await page.goto('/admin/shops');
  const tablePanel = page.locator('section').filter({ has: page.getByRole('table') });
  await expect(tablePanel).toContainText('Market');
  await expect(tablePanel).toContainText('Jami 1 ta');
  await expect(page.getByText('Ali Market', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ali Market tafsilotlarini ko‘rish' }).click();
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  await expect(page.getByText('28', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect.poll(() => approved).toBe(true);
});

test('reject sababini backendga yuboradi', async ({ page }) => {
  let reason = '';
  await page.route('**/api/v1/admin/shops/15/reject', async (route) => { reason = (route.request().postDataJSON() as { reason: string }).reason; await route.fulfill({ status: 201, body: '{}' }); });
  await page.goto('/admin/shops');
  await page.getByRole('button', { name: 'Ali Market tafsilotlarini ko‘rish' }).click();
  await page.getByRole('button', { name: 'Rad etish' }).click();
  await page.getByLabel('Rad etish sababi').fill('Hujjatlar to‘liq emas');
  await page.getByLabel('Do‘konni rad etish').getByRole('button', { name: 'Rad etish' }).click();
  await expect.poll(() => reason).toBe('Hujjatlar to‘liq emas');
});
