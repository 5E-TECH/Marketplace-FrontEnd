import { expect, test } from '@playwright/test';
import {
  authenticatedUser,
  installAuthenticatedSession,
  TEST_ACCESS_TOKEN,
} from './support/auth';

/**
 * `/profile` — akkaunt sahifasi (`PATCH /auth/profile`).
 * Do'kon profilini tahrirlash alohida sahifada: `shop-profile.spec.ts` → `/shop`.
 */
test('akkaunt ma’lumotlarini tahrirlaydi va PATCH /auth/profile yuboradi', async ({
  page,
}) => {
  await installAuthenticatedSession(page);
  let requestBody: Record<string, unknown> | undefined;
  let authorization = '';

  await page.route('**/api/v1/auth/profile', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    authorization = route.request().headers().authorization ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: { ...authenticatedUser, ...requestBody },
      }),
    });
  });

  await page.goto('/profile');
  await expect(
    page.getByRole('heading', { name: 'Mening profilim' }),
  ).toBeVisible();
  await expect(page.getByText('Shaxsiy ma’lumotlar')).toBeVisible();
  // Do'kon ma'lumotlari bu sahifada ko'rsatilmaydi.
  await expect(page.getByText('Do‘kon ma’lumotlari')).toHaveCount(0);

  await page.getByRole('button', { name: 'Tahrirlash' }).click();

  const dialog = page.getByRole('dialog', { name: 'Akkauntni tahrirlash' });
  await expect(dialog.getByLabel('Ism')).toHaveValue(authenticatedUser.name);
  await expect(dialog.getByLabel('Telefon')).toHaveValue(
    authenticatedUser.phone,
  );

  await dialog.getByLabel('Ism').fill('Yangi Sotuvchi');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByText('Profil yangilandi')).toBeVisible();
  expect(requestBody).toEqual({
    name: 'Yangi Sotuvchi',
    phone: authenticatedUser.phone,
  });
  expect(authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
  await expect(
    page.getByRole('heading', { name: 'Yangi Sotuvchi' }),
  ).toBeVisible();
});

test('parolni o‘zgartirish formasi PATCH /auth/profile ga parol yuboradi', async ({
  page,
}) => {
  await installAuthenticatedSession(page);
  let requestBody: Record<string, unknown> | undefined;

  await page.route('**/api/v1/auth/profile', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
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

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Parolni o‘zgartirish' }).click();

  const dialog = page.getByRole('dialog', { name: 'Parolni o‘zgartirish' });
  await dialog.getByLabel('Yangi parol').fill('YangiParol123');
  await dialog.getByLabel('Parolni tasdiqlang').fill('YangiParol123');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByText('Parol yangilandi')).toBeVisible();
  expect(requestBody).toEqual({ password: 'YangiParol123' });
});

test('tasdiqlash paroli mos kelmasa forma yuborilmaydi', async ({ page }) => {
  await installAuthenticatedSession(page);
  let called = false;
  await page.route('**/api/v1/auth/profile', async (route) => {
    called = true;
    await route.fulfill({ status: 200, body: '{}' });
  });

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Parolni o‘zgartirish' }).click();

  const dialog = page.getByRole('dialog', { name: 'Parolni o‘zgartirish' });
  await dialog.getByLabel('Yangi parol').fill('YangiParol123');
  await dialog.getByLabel('Parolni tasdiqlang').fill('BoshqaParol');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(dialog.getByText('Parollar mos kelmadi')).toBeVisible();
  expect(called).toBe(false);
});
