import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  authenticatedUser,
  installAuthenticatedSession,
  mockLogout,
  seedAccessToken,
} from './support/auth';

const REFRESHED_TOKEN = 'e2e.refreshed.token';

// Sotuvchi bosh sahifasida header qo'ng'iroqchasi bildirishnomalarni so'raydi —
// token yangilanishi shu ma'lumot so'rovida tekshiriladi.
const NOTIFICATIONS = '**/api/v1/notifications**';
const notificationsPage = {
  data: { items: [], total: 0, unreadCount: 0, page: 1, limit: 20 },
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
  const dataTokens: string[] = [];
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
  await mockExpiringEndpoint(page, NOTIFICATIONS, notificationsPage, dataTokens);
  await mockLogout(page);

  await page.goto('/affiliate');

  // Sahifa login'ga tashlanmaydi — so'rovlar yangi token bilan qaytariladi.
  await expect(page.getByRole('heading', { level: 1, name: 'Bosh sahifa' })).toBeVisible();
  await expect(page).toHaveURL(/\/affiliate$/);

  expect(refreshCalls).toBeGreaterThan(0);
  expect(meTokens.at(-1)).toBe(`Bearer ${REFRESHED_TOKEN}`);
  await expect.poll(() => dataTokens.at(-1)).toBe(`Bearer ${REFRESHED_TOKEN}`);
});

test('doimiy 401 da so‘rov faqat bir marta qaytariladi (cheksiz sikl yo‘q)', async ({
  page,
}) => {
  let refreshCalls = 0;
  let dataCalls = 0;

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
  await page.route(NOTIFICATIONS, async (route) => {
    dataCalls += 1;
    await route.fulfill(unauthorized());
  });
  await mockLogout(page);

  await page.goto('/affiliate');
  await expect(page).toHaveURL(/\/login$/);

  // Bir marta asl so'rov + bir marta refreshdan keyingi qayta urinish.
  expect(dataCalls).toBe(2);
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

  await page.goto('/affiliate');

  await expect(page).toHaveURL(/\/login$/);
});

test('refresh paytida profil so‘rovi vaqtincha ishlamasa avtomatik tiklanadi', async ({
  page,
}) => {
  await seedAccessToken(page);
  let profileCalls = 0;

  await page.route('**/api/v1/auth/me', async (route) => {
    profileCalls += 1;

    if (profileCalls === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Vaqtincha ishlamayapti' }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: authenticatedUser }),
    });
  });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Bosh sahifa' }),
  ).toBeVisible();
  expect(profileCalls).toBe(2);
});

test('deploydan keyin eski lazy chunk topilmasa sahifa bir marta yangilanib tiklanadi', async ({
  page,
}) => {
  await installAuthenticatedSession(page);
  let chunkRequests = 0;

  await page.route('**/src/pages/PlaceholderPage/PlaceholderPage.tsx*', async (route) => {
    chunkRequests += 1;

    if (chunkRequests === 1) {
      await route.abort('failed');
      return;
    }

    await route.continue();
  });

  await page.goto('/affiliate');

  await expect(page.getByRole('heading', { level: 1, name: 'Bosh sahifa' })).toBeVisible();
  expect(chunkRequests).toBe(2);
  await expect(page.getByText('Nimadir noto‘g‘ri ketdi')).toHaveCount(0);
});
