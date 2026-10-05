import { expect, test, type Page } from '@playwright/test';
import { ACCESS_TOKEN_KEY, authenticatedUser, mockDashboard, mockLogout, mockProducts, mockSellerShop, seedAccessToken } from './support/auth';

/**
 * Backend `AUTH_TOKENS_IN_BODY=false` rejimida tokenni javob tanasida bermaydi —
 * sessiya faqat HttpOnly cookie'da. Brauzer cookie'ni o'zi yuboradi, shuning
 * uchun bu yerda cookie emas, frontend xatti-harakati tekshiriladi:
 * token saqlanmaydi, `Authorization` yuborilmaydi, sessiya tiklanadi.
 */
const COOKIE_SESSION_KEY = 'elchi_cookie_session';
const unauthorized = { status: 401, contentType: 'application/json', body: JSON.stringify({ statusCode: 401, message: 'Sessiya tugagan', errorCode: 'UNAUTHENTICATED' }) };

async function mockCabinet(page: Page) {
  // Mock qilinmagan so'rov dev proxy orqali haqiqiy backendga chiqmasin.
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'mock yo‘q' }) }));
  await mockLogout(page);
  await mockProducts(page);
  await mockDashboard(page);
  await mockSellerShop(page);
}

test('token tanada kelmasa sessiya cookie bilan ochiladi va token saqlanmaydi', async ({ page }) => {
  await mockCabinet(page);
  const meAuthorizations: string[] = [];
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, data: {} }) }));
  await page.route('**/api/v1/auth/me', (route) => {
    meAuthorizations.push(route.request().headers().authorization ?? '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: authenticatedUser }) });
  });

  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'PLATFORMAGA KIRISH' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  const storage = await page.evaluate(([tokenKey, cookieKey]) => [sessionStorage.getItem(tokenKey), localStorage.getItem(tokenKey), sessionStorage.getItem(cookieKey)], [ACCESS_TOKEN_KEY, COOKIE_SESSION_KEY]);
  expect(storage).toEqual([null, null, '1']);

  // Sahifa yangilanganda sessiya cookie orqali `/auth/me` bilan tiklanadi.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  expect(meAuthorizations.length).toBeGreaterThanOrEqual(2);
  expect(meAuthorizations.every((value) => value === '')).toBe(true);
});

test('cookie sessiyada 401 bo‘lsa refresh qilinadi va so‘rov tokensiz qayta yuboriladi', async ({ page }) => {
  await mockCabinet(page);
  await page.addInitScript((key) => sessionStorage.setItem(key, '1'), COOKIE_SESSION_KEY);
  let meCalls = 0;
  let refreshCalls = 0;
  const meAuthorizations: string[] = [];
  await page.route('**/api/v1/auth/me', (route) => {
    meCalls += 1;
    meAuthorizations.push(route.request().headers().authorization ?? '');
    return meCalls === 1 ? route.fulfill(unauthorized) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: authenticatedUser }) });
  });
  await page.route('**/api/v1/auth/refresh', (route) => {
    refreshCalls += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, data: { user: authenticatedUser } }) });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  expect(refreshCalls).toBe(1);
  expect(meAuthorizations).toEqual(['', '']);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY)).toBeNull();
});

test('cookie sessiyada o‘zgartiruvchi so‘rovlar CSRF sarlavhasi bilan ketadi', async ({ page }) => {
  await mockCabinet(page);
  await page.addInitScript((key) => sessionStorage.setItem(key, '1'), COOKIE_SESSION_KEY);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: authenticatedUser }) }));
  // Backend cookie bilan kelgan POST/PATCH/DELETE ni `X-Requested-With`siz 403 bilan rad etadi.
  const logoutHeaders: Array<string | undefined> = [];
  await page.route('**/api/v1/auth/logout', (route) => {
    logoutHeaders.push(route.request().headers()['x-requested-with']);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, data: {} }) });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  await page.getByRole('button', { name: 'Tizimdan chiqish' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(logoutHeaders).toEqual(['XMLHttpRequest']);
});

test('cookie sessiya tugagan bo‘lsa login sahifasiga qaytaradi va belgini tozalaydi', async ({ page }) => {
  await mockCabinet(page);
  await page.addInitScript((key) => { if (!sessionStorage.getItem('e2e-seeded')) { sessionStorage.setItem(key, '1'); sessionStorage.setItem('e2e-seeded', '1'); } }, COOKIE_SESSION_KEY);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill(unauthorized));
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill(unauthorized));

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), COOKIE_SESSION_KEY)).toBeNull();
});

test('backend cookie rejimiga o‘tganda tokenli sessiya uzilmaydi: refresh token qaytarmasa cookie’ga o‘tadi', async ({ page }) => {
  await mockCabinet(page);
  await seedAccessToken(page, 'expired.body.token');
  const meAuthorizations: string[] = [];
  await page.route('**/api/v1/auth/me', (route) => {
    const authorization = route.request().headers().authorization ?? '';
    meAuthorizations.push(authorization);
    // Eski token muddati o'tgan: u bilan kelgan so'rov 401 oladi, cookie bilan kelgani o'tadi.
    return authorization ? route.fulfill(unauthorized) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: authenticatedUser }) });
  });
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, data: { user: authenticatedUser } }) }));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  expect(meAuthorizations).toEqual(['Bearer expired.body.token', '']);
  const storage = await page.evaluate(([tokenKey, cookieKey]) => [sessionStorage.getItem(tokenKey), sessionStorage.getItem(cookieKey)], [ACCESS_TOKEN_KEY, COOKIE_SESSION_KEY]);
  expect(storage).toEqual([null, '1']);
});
