import { expect, test } from '@playwright/test';
import {
  ACCESS_TOKEN_KEY,
  TEST_ACCESS_TOKEN,
  authenticatedUser,
} from './support/auth';

test('TC1: bo‘sh register submit majburiy maydonlarni validatsiya qiladi', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'RO‘YXATDAN O‘TISH' }).click();

  await expect(page.getByText('Ism va familiyangizni kiriting')).toBeVisible();
  await expect(page.getByText('Telefon raqamini kiriting')).toBeVisible();
  await expect(page.getByText('Do‘kon nomini kiriting')).toBeVisible();
  await expect(page.getByText('Parolni kiriting')).toBeVisible();
  await expect(page.getByText('Parolni qayta kiriting')).toBeVisible();
});

test('TC2: to‘g‘ri register so‘rovi muvaffaqiyatdan keyin login sahifasiga o‘tadi', async ({
  page,
}) => {
  let requestBody: unknown;
  await page.route('**/api/v1/sellers/register', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Created' }),
    });
  });

  await page.goto('/register');
  await page.getByLabel('Ism va familiya').fill('Ali Valiyev');
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Email').fill('seller@example.com');
  await page.getByLabel('Do‘kon nomi').fill('Ali Market');
  await page.getByLabel('Do‘kon tavsifi').fill('Maishiy texnika do‘koni');
  await page.getByLabel('Manzil').fill('Toshkent shahri');
  await page.getByLabel('Parol', { exact: true }).fill('Secure123');
  await page.getByLabel('Parolni tasdiqlash').fill('Secure123');
  await page.getByRole('button', { name: 'RO‘YXATDAN O‘TISH' }).click();

  await expect(page).toHaveURL(/\/login$/);
  expect(requestBody).toEqual({
    name: 'Ali Valiyev',
    phone: '+998901234567',
    password: 'Secure123',
    email: 'seller@example.com',
    shopName: 'Ali Market',
    shopDescription: 'Maishiy texnika do‘koni',
    address: 'Toshkent shahri',
  });
});

test('TC3: login token oladi, saqlaydi va dashboardga yo‘naltiradi', async ({
  page,
}) => {
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
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: TEST_ACCESS_TOKEN }),
    });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    expect(route.request().headers().authorization).toBe(
      `Bearer ${TEST_ACCESS_TOKEN}`,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: authenticatedUser }),
    });
  });

  await page.goto('/login');
  const phoneInput = page.getByLabel('Telefon raqami');
  const passwordInput = page.getByLabel('Parol');
  await phoneInput.fill('901234567');
  await passwordInput.fill('Secure123');
  const phoneHeight = await phoneInput.locator('..').evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const passwordHeight = await passwordInput.locator('..').evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(passwordHeight).toBe(phoneHeight);
  await page.locator('[title="Parolni ko‘rsatish"]').click();
  await expect(passwordInput).toHaveAttribute('type', 'text');
  await page.locator('[title="Parolni yashirish"]').click();
  await expect(passwordInput).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'PLATFORMAGA KIRISH' }).click();

  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY),
  ).toBe(TEST_ACCESS_TOKEN);
});

test('TC4: noto‘g‘ri parol server xatosini ko‘rsatadi va token saqlamaydi', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid credentials' }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Wrong123');
  await page.getByRole('button', { name: 'PLATFORMAGA KIRISH' }).click();

  await expect(page.getByText('Telefon yoki parol noto‘g‘ri')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY),
  ).toBeNull();
});
