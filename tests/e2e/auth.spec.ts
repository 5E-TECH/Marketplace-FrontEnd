import { expect, test } from '@playwright/test';
import {
  ACCESS_TOKEN_KEY,
  TEST_ACCESS_TOKEN,
  authenticatedUser,
  mockCurrentUser,
  seedAccessToken,
} from './support/auth';

test.beforeEach(async ({ page }) => {
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
});

test('TC1: token Authorization headerga Bearer formatida qo‘shiladi', async ({
  page,
}) => {
  await seedAccessToken(page);

  let authorizationHeader: string | undefined;
  await page.route('**/api/v1/auth/me', async (route) => {
    authorizationHeader = route.request().headers().authorization;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: authenticatedUser }),
    });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();
  expect(authorizationHeader).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
});

test('TC2: 401 javobi sessiyani tozalab login sahifasiga chiqaradi', async ({
  page,
}) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });

  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'MarketHub' }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY),
  ).toBeNull();
});

test('TC3: tokensiz himoyalangan route login sahifasiga redirect qiladi', async ({
  page,
}) => {
  let currentUserRequested = false;
  await page.route('**/api/v1/auth/me', async (route) => {
    currentUserRequested = true;
    await route.abort();
  });

  await page.goto('/products');

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'MarketHub' }),
  ).toBeVisible();
  expect(currentUserRequested).toBe(false);
});

test('TC4: sahifa yangilanganda token va autentifikatsiya saqlanadi', async ({
  page,
}) => {
  await seedAccessToken(page);
  await mockCurrentUser(page);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY),
  ).toBe(TEST_ACCESS_TOKEN);
});

test('TC5: pending seller sessiyasi saqlanadi va kabinetga kiradi', async ({
  page,
}) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { ...authenticatedUser, isActive: false },
      }),
    });
  });

  await page.goto('/');

  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY),
  ).toBe(TEST_ACCESS_TOKEN);
});
