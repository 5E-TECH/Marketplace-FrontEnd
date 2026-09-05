import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  authenticatedUser,
  mockDashboard,
  mockLogout,
  mockProducts,
  mockSellerShop,
  seedAccessToken,
} from './support/auth';

const REFRESHED_TOKEN = 'e2e.refreshed.token';

const ordersPage = {
  data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 },
};

function unauthorized() {
  return {
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({
      statusCode: 401,
      message: 'Token muddati tugagan',
      errorCode: 'UNAUTHENTICATED',
    }),
  };
}

/** Birinchi chaqiruvda 401, keyin — token yangilangan bo'lsa 200. */
async function mockExpiringEndpoint(
  page: Page,
  pattern: string,
  payload: unknown,
  seenTokens: string[],
) {
  let firstCall = true;

  await page.route(pattern, async (route) => {
    const authorization = route.request().headers().authorization ?? '';
    seenTokens.push(authorization);

    if (firstCall) {
      firstCall = false;
      await route.fulfill(unauthorized());
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

test('access token muddati tuganda sessiya refresh orqali tiklanadi', async ({
  page,
}) => {
  const meTokens: string[] = [];
  const orderTokens: string[] = [];
  let refreshCalls = 0;

  await seedAccessToken(page);
  await page.route('**/api/v1/auth/refresh', async (route) => {
    refreshCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: REFRESHED_TOKEN }),
    });
  });
  await mockExpiringEndpoint(
    page,
    '**/api/v1/auth/me',
    { statusCode: 200, message: 'OK', data: authenticatedUser },
    meTokens,
  );
  await mockExpiringEndpoint(
    page,
    '**/api/v1/seller/orders**',
    ordersPage,
    orderTokens,
  );
  await mockLogout(page);
  await mockProducts(page);
  await mockDashboard(page);
  await mockSellerShop(page);

  await page.goto('/orders');

  // Sahifa login'ga tashlanmaydi — so'rovlar yangi token bilan qaytariladi.
  await expect(page.getByRole('heading', { name: 'Buyurtmalar' })).toBeVisible();
  await expect(page).toHaveURL(/\/orders$/);

  expect(refreshCalls).toBeGreaterThan(0);
  expect(meTokens.at(-1)).toBe(`Bearer ${REFRESHED_TOKEN}`);
  expect(orderTokens.at(-1)).toBe(`Bearer ${REFRESHED_TOKEN}`);
});

test('doimiy 401 da so‘rov faqat bir marta qaytariladi (cheksiz sikl yo‘q)', async ({
  page,
}) => {
  let refreshCalls = 0;
  let orderCalls = 0;

  await seedAccessToken(page);
  await page.route('**/api/v1/auth/refresh', async (route) => {
    refreshCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: REFRESHED_TOKEN }),
    });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: authenticatedUser,
      }),
    });
  });
  // Token yangilangandan keyin ham 401 — server haqiqatan ruxsat bermayapti.
  await page.route('**/api/v1/seller/orders**', async (route) => {
    orderCalls += 1;
    await route.fulfill(unauthorized());
  });
  await mockLogout(page);
  await mockProducts(page);
  await mockDashboard(page);
  await mockSellerShop(page);

  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login$/);

  // Bir marta asl so'rov + bir marta refreshdan keyingi qayta urinish.
  expect(orderCalls).toBe(2);
  expect(refreshCalls).toBe(1);
});

test('refresh ham ishlamasa foydalanuvchi login sahifasiga qaytariladi', async ({
  page,
}) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill(unauthorized());
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill(unauthorized());
  });
  await mockLogout(page);

  await page.goto('/orders');

  await expect(page).toHaveURL(/\/login$/);
});
