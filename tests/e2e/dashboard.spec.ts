import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test('dashboard kartalar, grafik va top mahsulotni API dan ko‘rsatadi', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '5 400 000 so‘m', level: 3 })).toBeVisible();
  await expect(page.getByText('42', { exact: true })).toBeVisible();
  await expect(page.getByText('30', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Kunlik daromad grafigi' })).toBeVisible();
  await expect(page.getByText('Telefon', { exact: true })).toBeVisible();
  await expect(page.getByText('21 dona sotilgan')).toBeVisible();
});

test('dashboard bo‘sh ma’lumotda chiroyli empty state ko‘rsatadi', async ({ page }) => {
  await page.route('**/api/v1/seller/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {
        ordersTotal: 0, revenue: 0, pendingShipments: 0, delivered: 0,
        lowStockCount: 0, topProducts: [], salesByDay: [],
      } }),
    });
  });

  await page.goto('/');

  await expect(page.getByText('Savdo ma’lumoti hali mavjud emas')).toBeVisible();
  await expect(page.getByText('Sotuvlar boshlangach top mahsulotlar chiqadi')).toBeVisible();
  await expect(page.getByRole('heading', { name: '0 so‘m', level: 3 })).toBeVisible();
});

test('desktop viewportga sig‘gan dashboard keraksiz scrollbar chiqarmaydi', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();

  await expect.poll(() => page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight,
  }))).toEqual({ horizontal: 0, vertical: 0 });
});
