import { expect, test, type Page } from '@playwright/test';
import { authenticatedUser, installAuthenticatedSession, TEST_ACCESS_TOKEN } from './support/auth';

async function mockProfileUpdate(page: Page) {
  let requestBody: Record<string, unknown> | undefined;
  let authorization = '';
  await page.route('**/api/v1/auth/profile', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    authorization = route.request().headers().authorization ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...authenticatedUser, ...requestBody, isBlocked: false } }),
    });
  });
  return { body: () => requestBody, authorization: () => authorization };
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

for (const role of ['SELLER', 'ADMIN', 'SUPERADMIN', 'OPERATOR'] as const) {
  test(`${role} roli profil sahifasiga kira oladi`, async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...authenticatedUser, role } }),
    }));
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Mening profilim' })).toBeVisible();
    await expect(page.locator('main').getByText(role, { exact: true })).toBeVisible();
  });
}

test('profil ma’lumotlarini PATCH /auth/profile orqali yangilaydi', async ({ page }) => {
  const api = await mockProfileUpdate(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Ism').fill('Ali Valiyev');
  await dialog.getByLabel('Email').fill('ali@example.com');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByText('Profil muvaffaqiyatli yangilandi')).toBeVisible();
  expect(api.body()).toEqual({ name: 'Ali Valiyev', email: 'ali@example.com' });
  expect(api.authorization()).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Ali Valiyev' })).toBeVisible();
});

test('parolsiz update requestida password yuborilmaydi', async ({ page }) => {
  const api = await mockProfileUpdate(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Telefon').fill('+998991234567');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Profil muvaffaqiyatli yangilandi')).toBeVisible();
  expect(api.body()).toEqual({ phone: '+998991234567' });
  expect(api.body()).not.toHaveProperty('password');
});

test('formada eski parol maydoni mavjud emas', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await expect(dialog.getByLabel(/eski parol|joriy parol/i)).toHaveCount(0);
  await expect(dialog.getByLabel('Yangi parol', { exact: true })).toBeVisible();
});

test('password confirmation bir xil bo‘lishini validatsiya qiladi', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Yangi parol', { exact: true }).fill('1234');
  await dialog.getByLabel('Yangi parolni tasdiqlash').fill('OtherSecret456');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Parollar bir xil emas')).toBeVisible();
});

test('password update muvaffaqiyatidan keyin logout qilib login sahifasiga o‘tadi', async ({ page }) => {
  const api = await mockProfileUpdate(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Yangi parol', { exact: true }).fill('1234');
  await dialog.getByLabel('Yangi parolni tasdiqlash').fill('1234');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Parol yangilandi, qayta tizimga kiring')).toBeVisible();
  expect(api.body()).toEqual({ password: '1234' });
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('elchi_access_token'))).toBeNull();
});

test('backend field xatosini mos formada ko‘rsatadi', async ({ page }) => {
  await page.route('**/api/v1/auth/profile', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({
      message: ['email must be an email'],
      errorCode: 'VALIDATION_ERROR',
      details: [{ field: 'email', error: 'Bu email allaqachon ishlatilgan' }],
    }),
  }));
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Email').fill('taken@example.com');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Bu email allaqachon ishlatilgan')).toBeVisible();
});
