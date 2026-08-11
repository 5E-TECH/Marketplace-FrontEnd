import { expect, test } from '@playwright/test';
import {
  authenticatedUser,
  installAuthenticatedSession,
  TEST_ACCESS_TOKEN,
} from './support/auth';

test('profilni ism va telefon bilan tahrirlaydi', async ({ page }) => {
  await installAuthenticatedSession(page);

  let updated = false;
  let requestBody: unknown;
  let authorization = '';
  const updatedUser = {
    ...authenticatedUser,
    name: 'Bahodir Nabijanov',
    phone: '+998942325567',
  };

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: updated ? updatedUser : authenticatedUser,
      }),
    });
  });
  await page.route('**/api/v1/sellers/me', async (route) => {
    requestBody = route.request().postDataJSON();
    authorization = route.request().headers().authorization ?? '';
    updated = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 200, message: 'OK', data: null }),
    });
  });

  await page.goto('/profile');

  await expect(page.getByRole('button', { name: 'Sozlamalar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  await expect(page.getByRole('dialog', { name: 'Profilni tahrirlash' })).toBeVisible();
  await expect(page.locator('.ant-modal-container')).toHaveCSS('background-color', 'rgb(21, 22, 25)');
  await page.getByLabel('Ism').fill(updatedUser.name);
  await page.getByLabel('Telefon').fill(updatedUser.phone);
  await page.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByText('Profil yangilandi')).toBeVisible();
  await expect(page.getByRole('heading', { name: updatedUser.name })).toBeVisible();
  await expect(page.getByText(updatedUser.phone)).toBeVisible();
  expect(requestBody).toEqual({ name: updatedUser.name, phone: updatedUser.phone });
  expect(authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
});
