import { expect, test } from '@playwright/test';
import {
  ACCESS_TOKEN_KEY,
  TEST_ACCESS_TOKEN,
  authenticatedUser,
  installAuthenticatedSession,
  mockNotifications,
} from './support/auth';

test('login sahifasi (umumiy-kirish): xodim formasi va «Kirish usuli rolingizga bog‘liq»', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { level: 1, name: 'Tizimga kirish' })).toBeVisible();
  await expect(page.getByLabel('Telefon raqami')).toBeVisible();
  await expect(page.getByText('+998', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Parol')).toBeVisible();
  await expect(page.getByText('Hisob va parolni admin ochib beradi. Admin, superadmin va moliya keyingi qadamda ilovadagi kodni kiritadi.')).toBeVisible();
  // Sotuvchi SMS kodi va ro'yxatdan o'tish — FE-04; hozir yo'q.
  await expect(page.getByRole('link', { name: /ro‘yxatdan o‘tish/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kod olish' })).toHaveCount(0);

  const methods = page.getByRole('complementary', { name: 'Kirish usuli rolingizga bog‘liq' });
  await expect(methods.locator('dt')).toHaveText(['Sotuvchi, optovik', 'Operator, nazoratchi, omborchi', 'Admin, superadmin, moliya']);
  // Xodim formasi ochiq — 2- va 3-qator faol.
  await expect(methods.locator('[aria-current="true"] dt')).toHaveText(['Operator, nazoratchi, omborchi', 'Admin, superadmin, moliya']);
  expect((await page.getByRole('button', { name: 'Kirish', exact: true }).boundingBox())?.height).toBe(52);
});

test('login telefonda: navy sarlavha, forma, ostida usullar, gorizontal scroll yo‘q', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Til: o‘zbekcha' })).toHaveText('UZ');
  await expect(page.getByRole('complementary', { name: 'Kirish usuli rolingizga bog‘liq' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('FE-01 TC3: noma’lum rol (eski BUYER) bilan login → menyusiz karkas va sabab, oq ekran emas', async ({ page }) => {
  await mockNotifications(page);
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
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  await expect(page.getByTestId('unknown-role')).toContainText('Akkauntingizga ish joyi biriktirilmagan');
  await expect(page.getByRole('heading', { level: 1, name: 'Ish joyi topilmadi' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Asosiy menyu' }).getByRole('link')).toHaveCount(0);
  // Parol to'g'ri — sessiya ochiq, admin rolni to'g'rilagach «Qayta tekshirish» yetarli.
  expect(await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY)).toBe(TEST_ACCESS_TOKEN);
});

for (const path of ['/register', '/register/account', '/forgot-password', '/reset-password', '/verify-phone']) {
  test(`${path} kabinetda mavjud emas: kirmagan login’ga, kirgan 404 ga tushadi`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Tizimga kirish' })).toBeVisible();

    await installAuthenticatedSession(page);
    await page.goto(path);
    await expect(page.getByTestId('not-found-page')).toBeVisible();
  });
}

test('sotuvchi (AFFILIATE) login token oladi, saqlaydi va o‘z bosh sahifasiga yo‘naltiradi', async ({
  page,
}) => {
  await mockNotifications(page);
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
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bosh sahifa' }),
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
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  await expect(page.getByText('Telefon raqami yoki parol noto‘g‘ri. Tekshirib, qayta kiriting.')).toBeVisible();
  await expect(page.getByLabel('Parol')).toHaveAttribute('aria-invalid', 'true');
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
  const submit = page.getByRole('button', { name: 'Kirish', exact: true });

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

for (const [status, title] of [[429, 'Urinishlar juda ko‘p'], [500, 'Tizim javob bermadi']] as const) {
  test(`login ${status} → «${title}» bloki, raqam saqlanadi`, async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status, json: { statusCode: status, message: 'x' } }));
    await page.goto('/login');
    await page.getByLabel('Telefon raqami').fill('901234567');
    await page.getByLabel('Parol').fill('Secure123');
    await page.getByRole('button', { name: 'Kirish', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(title);
    await expect(page.getByLabel('Telefon raqami')).toHaveValue('901234567');
    // Maydon o'zgarsa blok yo'qoladi.
    await page.getByLabel('Parol').fill('Secure1234');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
