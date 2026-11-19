import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';
import { pageTitle } from './support/shell';

/**
 * FE-02: API klient, sessiya va umumiy mock'lar. Barcha javoblar `src/mocks` dagi MSW
 * handler'laridan — `npm run dev` (backendsiz) bilan bir xil.
 */
async function signIn(page: Page, phone: string, password = 'Secure123') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill(password);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
}

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

test('TC1: operator ish joyi mock ma’lumot bilan ochiladi — bronlar, rejalashtirilgan qo‘ng‘iroqlar, statistika, holat', async ({ page }) => {
  await signIn(page, '900000003');
  await expect(page).toHaveURL(/\/operator$/);
  await expect(pageTitle(page)).toHaveText('Ish joyi');

  await expect(page.getByRole('heading', { name: 'Bronlarim (1/5)' })).toBeVisible();
  await expect(page.getByText('Aziza', { exact: true })).toBeVisible();
  // Qo'ng'iroqlar vaqti «hozir»ga nisbatan — yarim tunda ertangi kunga o'tadi, shuning uchun faqat blok.
  await expect(page.getByRole('heading', { name: 'Rejalashtirilgan qo‘ng‘iroqlar — bugun' })).toBeVisible();
  await expect(page.getByTestId('operator-bookings')).toHaveText('1/5');
  await expect(page.locator('dd').first()).toHaveText('38');

  const online = page.getByRole('radio', { name: 'Onlayn' });
  await expect(page.getByRole('radio', { name: 'Oflayn' })).toHaveAttribute('aria-checked', 'true');
  await online.click();
  await expect(online).toHaveAttribute('aria-checked', 'true');
});

test('TC1: sotuvchi bosh sahifasi mock ma’lumot bilan — bugungi ko‘rsatkichlar va 7 kun', async ({ page }) => {
  await signIn(page, '900000001');
  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(page.getByRole('heading', { name: 'Bugun', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Bugun' }).getByRole('listitem')).toHaveCount(5);
  // Sukut — grafik (7 ustun); «Jadval»da 7 kun + «Jami» qatori (FE-04: sotuvchi-bosh).
  const revenue = page.getByRole('region', { name: 'Daromad kunlar bo‘yicha' });
  await expect(revenue.getByTestId('income-bar')).toHaveCount(7);
  await revenue.getByRole('radio', { name: 'Jadval' }).click();
  await expect(revenue.locator('tbody tr.ant-table-row')).toHaveCount(7);
  await expect(revenue.locator('.ant-table-summary')).toContainText('Jami');
});

test('TC2: ikkinchi tab ochildi → qayta login so‘ralmaydi; chiqish hamma tabda', async ({ context, page }) => {
  await signIn(page, '900000003');
  await expect(page).toHaveURL(/\/operator$/);

  // Birinchi tab ochiq: sessiya undan olinadi, refresh ham kerak emas.
  const refreshCalls: string[] = [];
  context.on('request', (request) => { if (request.url().endsWith('/auth/refresh')) refreshCalls.push(request.url()); });
  const second = await context.newPage();
  await second.goto('/operator/calls');
  await expect(pageTitle(second)).toHaveText('Mening qo‘ng‘iroqlarim');
  expect(refreshCalls).toEqual([]);

  // Ochiq tab qolmasa — refresh cookie orqali jim tiklanadi.
  await page.close();
  await second.close();
  const third = await context.newPage();
  await third.goto('/operator');
  await expect(pageTitle(third)).toHaveText('Ish joyi');
  expect(refreshCalls.length).toBe(1);

  // Bir tabda «Chiqish» — ikkinchisi ham login'ga.
  const fourth = await context.newPage();
  await fourth.goto('/operator');
  await expect(pageTitle(fourth)).toHaveText('Ish joyi');
  await third.getByTestId('user-menu-button').click();
  await third.getByRole('menuitem', { name: 'Chiqish' }).click();
  await expect(third).toHaveURL(/\/login$/);
  await expect(fourth).toHaveURL(/\/login$/);
});

test('TC3: CSV yuklab olish — fayl nomi, UTF-8 BOM, «;» ajratgich va toast', async ({ page }) => {
  await signIn(page, '900000001');
  await expect(page.getByRole('list', { name: 'Bugun' }).getByRole('listitem')).toHaveCount(5);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Yuklab olish (CSV)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^statistika_\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{4}\.csv$/);

  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.subarray(3).toString('utf8').trimEnd().split('\r\n');
  expect(lines[0]).toBe('Sana;Kliklar;Lidlar;Yaroqli;Tasdiqlangan;Yetkazilgan;Rad etilgan;Daromad;Ushlab turilgan;Mavjud');
  expect(lines).toHaveLength(9);
  expect(lines[1]).toMatch(/^\d{2}\.\d{2}\.\d{4};\d+;/);
  expect(lines[8]).toMatch(/^Jami;\d+;/);
  await expect(page.getByText(`Fayl yuklab olindi: ${download.suggestedFilename()} · 8 ta qator`)).toBeVisible();
});

test('sessiya tugadi → sahifa joyida, oynada parol bilan qayta kirish', async ({ page }) => {
  await signIn(page, '900000003');
  await expect(page).toHaveURL(/\/operator$/);

  // Server sessiyani bekor qildi: har so'rov va refresh 401.
  const expire = (route: import('@playwright/test').Route) => route.fulfill({ status: 401, json: { statusCode: 401, errorCode: 'UNAUTHENTICATED', message: 'Sessiya tugagan' } });
  await page.route('**/api/v1/operator/**', expire);
  await page.route('**/api/v1/auth/refresh', expire);
  const dialog = page.getByTestId('session-expired');
  // Har qanday keyingi so'rov (holatni almashtirish yoki jonli yangilanish) 401 → oyna.
  // Jonli so'rov bizdan oldin yetib kelsa, oyna tugmani yopib qo'yadi — bu ham to'g'ri.
  await page.getByRole('radio', { name: 'Onlayn' }).click({ timeout: 3_000 }).catch(() => undefined);
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toContainText('Dilnoza R. · Operator');
  await expect(dialog).toContainText('Panel: Ish joyi');
  await expect(pageTitle(page)).toHaveText('Ish joyi');

  await page.unroute('**/api/v1/operator/**', expire);
  await page.unroute('**/api/v1/auth/refresh', expire);
  await dialog.getByLabel('Parol').fill('xato');
  await dialog.getByRole('button', { name: 'Kirish' }).click();
  await expect(dialog).toContainText('Telefon raqami yoki parol noto‘g‘ri');
  await dialog.getByLabel('Parol').fill('Secure123');
  await dialog.getByRole('button', { name: 'Kirish' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Qayta kirdingiz. Sahifa va kiritganlaringiz joyida.')).toBeVisible();
  await expect(page).toHaveURL(/\/operator$/);
});

test('aloqa uzildi → banner «… dan beri», tiklanganda «Aloqa tiklandi» va 4 s da yopiladi', async ({ context, page }) => {
  await signIn(page, '900000001');
  await expect(pageTitle(page)).toHaveText('Bosh sahifa');

  await context.setOffline(true);
  const banner = page.getByTestId('connection-banner');
  await expect(banner).toHaveAttribute('data-state', 'offline');
  await expect(banner).toContainText('Internet aloqasi yo‘q');
  await expect(banner).toContainText('dan beri');

  await context.setOffline(false);
  await expect(banner).toHaveAttribute('data-state', 'restored');
  await expect(banner).toContainText('Aloqa tiklandi');
  await expect(banner).toBeHidden({ timeout: 6_000 });
});

test('blok yuklanmadi → «Xato raqami» va 429 da kutish sanog‘i', async ({ page }) => {
  let status = 500;
  await page.route('**/api/v1/affiliate/stats**', (route) => route.fulfill({
    status,
    headers: status === 429 ? { 'Retry-After': '30' } : {},
    json: { statusCode: status, errorCode: status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR', message: 'xato', requestId: 'req-7f3a' },
  }));
  await signIn(page, '900000001');

  // Bloklar alohida yuklanadi (sotuvchi-bosh 1-bo'lim): statistika ochilmasa ham xabarlar ko'rinadi.
  await expect(page.getByRole('region', { name: 'Bugungi xabarlar' })).toBeVisible();
  const error = page.getByRole('region', { name: 'Bugun', exact: true }).getByTestId('load-error');
  await expect(error).toContainText('Ma’lumotni yuklab bo‘lmadi');
  await expect(error).toContainText('Xato raqami: req-7f3a');
  await expect(error).toContainText('60 soniyadan keyin o‘zi qayta urinadi');

  status = 429;
  await page.reload();
  await expect(error).toContainText('So‘rovlar juda tez yuborildi');
  await expect(error.getByRole('button', { name: /^Qayta urinish · \d+$/ })).toBeDisabled();
});
