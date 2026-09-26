import { expect, test } from '@playwright/test';
import {
  ACCESS_TOKEN_KEY,
  TEST_ACCESS_TOKEN,
  authenticatedUser,
} from './support/auth';

test('login sahifasida faqat telefon va parol orqali kirish mavjud', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByLabel('Telefon raqami')).toBeVisible();
  await expect(page.getByLabel('Parol')).toBeVisible();
  await expect(page.getByRole('link', { name: /parolni unutdingizmi/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /ro‘yxatdan o‘tish/i })).toHaveCount(0);
});

test('TC1: BUYER login qilganda kabinetga kirishi taqiqlanadi', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ accessToken: TEST_ACCESS_TOKEN }),
  }));
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { ...authenticatedUser, role: 'BUYER' } }),
  }));

  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'PLATFORMAGA KIRISH' }).click();

  await expect(page.getByText('Seller akkaunti talab qilinadi')).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toHaveCount(0);
});

for (const path of ['/register', '/register/account', '/forgot-password', '/reset-password', '/verify-phone']) {
  test(`${path} kabinetda mavjud emas`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText('Sahifa topilmadi')).toBeVisible();
  });
}

test('SELLER login token oladi, saqlaydi va dashboardga yo‘naltiradi', async ({
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

test('noto‘g‘ri parol server xatosini ko‘rsatadi va token saqlamaydi', async ({
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

test('login formasi bo‘sh va noto‘g‘ri qiymatlarni serverga yubormaydi', async ({ page }) => {
  let loginRequests = 0;
  await page.route('**/api/v1/auth/login', (route) => { loginRequests++; return route.abort(); });
  await page.goto('/login');
  const phone = page.getByLabel('Telefon raqami');
  const password = page.getByLabel('Parol');
  const submit = page.getByRole('button', { name: /platformaga kirish/i });

  await submit.click();
  await expect(page.getByText('Telefon raqamini kiriting')).toBeVisible();
  await expect(page.getByText('Parolni kiriting')).toBeVisible();

  // Harf va belgilar tashlanadi, 9 raqamdan ortig'i kesiladi.
  await phone.fill('90-abc 12');
  await expect(phone).toHaveValue('9012');
  await phone.fill('9012345678901');
  await expect(phone).toHaveValue('901234567');
  // Joylangan to'liq raqamda 998 prefiksi tashlanadi.
  await phone.fill('+998 90 123 45 67');
  await expect(phone).toHaveValue('901234567');
  await phone.fill('998931112233');
  await expect(phone).toHaveValue('931112233');

  await phone.fill('90123456');
  await password.fill('x'.repeat(300));
  await expect(password).toHaveValue('x'.repeat(128));
  await submit.click();
  await expect(page.getByText('9 xonali telefon raqamini kiriting')).toBeVisible();
  expect(loginRequests).toBe(0);
});
