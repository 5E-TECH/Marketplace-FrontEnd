import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

const pendingShop = { id: '15', ownerUserId: '42', name: 'Ali Market', slug: 'ali-market', description: null, logoUrl: null, bannerUrl: null, status: 'PENDING', phone: '+998901234567', regionId: '1', districtId: '2', address: 'Toshkent', rating: 0, ordersCount: 0, elchiMarketId: null, isDeleted: false, isFeatured: false, tariffHome: 25000, tariffCenter: 15000, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' };

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '1', role: 'ADMIN', name: 'Admin', phone: '+998900000000', email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false } }) }));
  await page.route('**/api/v1/admin/shops?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [pendingShop], total: 1, page: 1, limit: 20 } }) }));
  await page.route('**/api/v1/admin/shops/15', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '15', ownerUserId: '42', name: 'Ali Market', status: 'PENDING', isFeatured: false, tariffHome: 25000, tariffCenter: 15000, stats: { products: 12, orders: 28, warehouses: 2 } } }) }));
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

test('featured holati va yetkazish tariflari backendga yuboriladi', async ({ page }) => {
  let featureBody: unknown;
  let tariffBody: unknown;
  let tariffMethod = '';
  await page.route('**/api/v1/admin/shops/15/feature', async route => { featureBody = route.request().postDataJSON(); await route.fulfill({ status: 201, body: '{}' }); });
  await page.route('**/api/v1/admin/shops/15/tariffs', async route => {
    tariffMethod = route.request().method();
    tariffBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('/admin/shops');
  await page.getByRole('button', { name: 'Ali Market tafsilotlarini ko‘rish' }).click();
  await expect(page.getByText('25 000 so‘m')).toBeVisible();
  await expect(page.getByText('15 000 so‘m')).toBeVisible();
  await page.getByRole('button', { name: 'Tavsiya etish' }).click();
  await expect.poll(() => featureBody).toEqual({ featured: true });
  await page.getByRole('button', { name: 'Tariflar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ali Market tariflari' });
  await dialog.getByLabel('Uyga yetkazish tarifi').fill('30000');
  await dialog.getByLabel('Elchi markazigacha yetkazish tarifi').fill('18000');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  expect(tariffMethod).toBe('PATCH');
  await expect.poll(() => tariffBody).toEqual({ tariffHome: 30000, tariffCenter: 18000 });
});
