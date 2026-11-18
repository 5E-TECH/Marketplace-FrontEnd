import { expect, test, type Page } from '@playwright/test';
import { authenticatedUser, installAuthenticatedSession, roleUsers, TEST_ACCESS_TOKEN } from './support/auth';
import { collectUnconnectedFormWarnings } from './support/console';

/** Umumiy profil (parol, telefon) — xodimlar uchun; sotuvchida `/profile` — sotuvchi-profil (FE-04). */
const staffUser = roleUsers.OPERATOR_LEAD;

async function mockProfileUpdate(page: Page) {
  let requestBody: Record<string, unknown> | undefined;
  let authorization = '';
  await page.route('**/api/v1/auth/profile', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    authorization = route.request().headers().authorization ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...staffUser, ...requestBody, isBlocked: false } }),
    });
  });
  return { body: () => requestBody, authorization: () => authorization };
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page, staffUser);
});

for (const role of ['WHOLESALER', 'OPERATOR_LEAD', 'SUPERVISOR', 'WAREHOUSE', 'FINANCE', 'ADMIN', 'SUPERADMIN'] as const) {
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
  const formWarnings = collectUnconnectedFormWarnings(page);
  const api = await mockProfileUpdate(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await expect(dialog.getByLabel('Ism')).toHaveValue(staffUser.name);
  // `UpdateProfileDto` da email yo'q — backend qo'shmaguncha tahrirlanmaydi, faqat ko'rsatiladi.
  await expect(dialog.getByLabel('Email')).toHaveCount(0);
  await dialog.getByLabel('Ism').fill('Ali Valiyev');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByText('Profil muvaffaqiyatli yangilandi')).toBeVisible();
  expect(api.body()).toEqual({ name: 'Ali Valiyev' });
  expect(api.authorization()).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Ali Valiyev' })).toBeVisible();
  expect(formWarnings).toEqual([]);
});

test('bekor qilingan tahrir qayta ochilganda asl qiymatlar ko‘rinadi', async ({ page }) => {
  const formWarnings = collectUnconnectedFormWarnings(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Ism').fill('Saqlanmagan ism');
  await dialog.getByRole('button', { name: 'Bekor' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  await expect(page.getByRole('dialog', { name: 'Profilni tahrirlash' }).getByLabel('Ism')).toHaveValue(staffUser.name);
  expect(formWarnings).toEqual([]);
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
      message: ['phone already exists'],
      errorCode: 'VALIDATION_ERROR',
      details: [{ field: 'phone', error: 'Bu telefon raqami allaqachon ishlatilgan' }],
    }),
  }));
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await dialog.getByLabel('Telefon').fill('+998991234567');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Bu telefon raqami allaqachon ishlatilgan')).toBeVisible();
});

test('sotuvchi (AFFILIATE) /profile da sotuvchi profilini ko‘radi: ism, JShShIR holati, oferta', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: authenticatedUser } }));
  await page.route('**/api/v1/auth/sessions', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/affiliate/profile', (route) => route.fulfill({
    json: {
      data: {
        id: 'seller-e2e', firstName: '', lastName: '', phone: '+998901234567', registeredAt: '2026-11-18T04:12:00.000Z', lastLoginAt: null,
        agreements: [
          { type: 'affiliate-offer', version: '1.0', acceptedAt: '2026-11-18T04:12:00.000Z', current: true },
          { type: 'personal-data-consent', version: '1.0', acceptedAt: '2026-11-18T04:12:00.000Z', current: true },
        ],
        selfEmployed: { status: 'NOT_SUBMITTED', pinflLast4: null, activity: null, submittedAt: null, checkedAt: null, reason: null, comment: null, documentName: null },
        card: null,
      },
    },
  }));
  await page.goto('/profile');

  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pul yechishga tayyorlik' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Pul yechishga tayyorlik' }).getByRole('listitem')).toHaveCount(4);
  await expect(page.getByText('Oferta — bajarildi')).toBeVisible();
  await expect(page.getByText('JShShIR — qilinmagan')).toBeVisible();
  await expect(page.getByText('1.0-versiya · qabul qilingan 18.11.2026, 09:12')).toBeVisible();
  // Ism hali kiritilmagan — sarlavhada telefon raqami.
  await expect(page.getByText('+998 90 123 45 67').first()).toBeVisible();
});
