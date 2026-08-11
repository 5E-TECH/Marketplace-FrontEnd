import type { Page } from '@playwright/test';

export const ACCESS_TOKEN_KEY = 'elchi_access_token';
export const TEST_ACCESS_TOKEN = 'e2e.access.token';

export const authenticatedUser = {
  id: 'seller-e2e',
  role: 'SELLER',
  name: 'E2E Sotuvchi',
  phone: '+998901234567',
  email: 'seller@example.com',
  avatarUrl: null,
  isActive: true,
  isDeleted: false,
} as const;

export async function seedAccessToken(
  page: Page,
  accessToken = TEST_ACCESS_TOKEN,
): Promise<void> {
  await page.addInitScript(
    ({ key, token }) => sessionStorage.setItem(key, token),
    { key: ACCESS_TOKEN_KEY, token: accessToken },
  );
}

export async function mockCurrentUser(page: Page): Promise<void> {
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
}

export async function mockLogout(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: null,
      }),
    });
  });
}

export async function mockProducts(page: Page): Promise<void> {
  await page.route('**/api/v1/products/my**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
}

export async function installAuthenticatedSession(page: Page): Promise<void> {
  await seedAccessToken(page);
  await mockCurrentUser(page);
  await mockLogout(page);
  await mockProducts(page);
}
