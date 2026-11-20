import { expect, test, type Page } from '@playwright/test';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { installMockApi } from './support/mockApi';
import { pageTitle } from './support/shell';

/**
 * FE-04 dizayn taxtalari bo'yicha qo'shimcha holatlar: sotuvchi-bosh (holat yozuvi, daromad
 * bo'linishi, bugungi lidlar, bannerlar, alohida xato bloklari), sotuvchi-jshshir (yo'riqnoma,
 * hujjat yuklash, ochish, telefonda pastki panel), sotuvchi-oferta (PDF, yangi versiya),
 * planshet va telefon, sessiya tugaganda SMS bilan qayta kirish.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function loginSeller(page: Page, phone = '900000001') {
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
}

async function registerSeller(page: Page, phone: string) {
  await page.goto('/register');
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Ofertani o‘qidim va qabul qilaman' }).check();
  await page.getByRole('checkbox', { name: /Shaxsiy ma’lumotlarim/ }).check();
  await page.getByRole('button', { name: 'Ro‘yxatdan o‘tish' }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
}

const digits = (text: string | null) => (text ?? '').replace(/\D/g, '');

test('bosh sahifa: yuqori qatorda holat, daromad sahifalar bo‘yicha, bugungi lidlar holati, legenda', async ({ page }) => {
  await loginSeller(page);
  await expect(page.locator('header').getByRole('status')).toContainText(/Statistika har soatda yangilanadi · \d{2}:\d{2}/);

  const today = page.getByRole('region', { name: 'Bugun', exact: true });
  const leadsKpi = digits(await today.getByTestId('today-kpi').nth(1).textContent());
  // «Bugun kelgan N lid» — «Lidlar» ko'rsatkichi bilan bir xil son; holatlar chiplarda.
  await expect(today.getByText(`Bugun kelgan ${leadsKpi} lid:`)).toBeVisible();
  await expect(today.getByRole('link', { name: 'Lidlar' })).toHaveAttribute('href', '/affiliate/leads');
  // Daromad ostida sahifa kodi bo'yicha bo'linish («k7m2qa 65 000»).
  await expect(today.locator('li').last()).toContainText(/k7m2qa|p3v9tx|faqat mijoz to‘lagan/);

  const revenue = page.getByRole('region', { name: 'Daromad kunlar bo‘yicha' });
  await expect(revenue.getByRole('radiogroup', { name: 'Ko‘rinish' }).getByRole('radio', { name: 'Grafik' })).toHaveAttribute('aria-checked', 'true');
  await expect(revenue.getByTestId('income-bar')).toHaveCount(7);
  await expect(revenue.getByRole('img', { name: /^Kunlik daromad, so‘m: / })).toBeVisible();
  await expect(revenue.getByText('Mavjud', { exact: true })).toBeVisible();
  await expect(revenue.getByText('Ushlab turilgan', { exact: true })).toBeVisible();
  await expect(revenue.locator('figure')).toContainText('bugun');
  // Tasdiqlangan JShShIR — ogohlantirish yo'q.
  await expect(page.getByText('JShShIR tasdiqlanmagan')).toHaveCount(0);
});

test('bosh sahifa telefonda: holat yozuvi mazmun tepasida, yuqori qator 56 px, gorizontal scroll yo‘q', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginSeller(page);
  await expect(page.locator('[data-app-main]').getByRole('status').first()).toContainText('Statistika har soatda yangilanadi');
  expect((await page.locator('[data-app-main]').locator('xpath=preceding-sibling::header').boundingBox())?.height).toBe(56);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('oferta yangi versiyasi: banner → «Oferta va roziliklar» → o‘qib qabul qilish → banner yo‘qoladi', async ({ page }) => {
  // Platforma 1.1-versiyani e'lon qildi; sotuvchi 1.0 ni qabul qilgan.
  await page.route('**/api/v1/legal/documents/affiliate-offer', (route) => route.fulfill({
    json: {
      statusCode: 200,
      message: 'OK',
      data: {
        type: 'affiliate-offer', version: '1.1', effectiveAt: null,
        summary: [{ term: 'Haq', text: 'faqat mijoz to‘lagan buyurtma uchun, so‘mda yoziladi.' }],
        sections: [{ id: 's1', title: '1. Umumiy qoidalar', body: '[oferta matni — EQ-10]' }],
      },
    },
  }));
  await loginSeller(page);
  const banner = page.getByRole('status').filter({ hasText: 'Sotuvchi ofertasi yangilandi' });
  await expect(banner).toContainText('Yangi versiya: 1.1-versiya.');
  await banner.getByRole('link', { name: 'Ofertani o‘qish' }).click();

  await expect(pageTitle(page)).toHaveText('Oferta va roziliklar');
  await expect(page.getByText('Siz 1.0-versiyani qabul qilgansiz. Yangisini o‘qib, qabul qiling.')).toBeVisible();
  await page.getByRole('button', { name: 'O‘qish va qabul qilish' }).click();
  const accept = page.waitForRequest('**/api/v1/affiliate/agreements');
  await page.getByRole('dialog').getByRole('button', { name: 'Qabul qilaman' }).click();
  expect((await accept).postDataJSON()).toEqual({ type: 'affiliate-offer', version: '1.1' });
  await expect(page.getByText('1.1-versiya qabul qilindi')).toBeVisible();
  // Tarixda ikki versiya: yangisi joriy, eskisi «Eski».
  const history = page.getByRole('region', { name: 'Versiyalar tarixi' });
  await expect(history.locator('tbody tr')).toHaveCount(2);
  await expect(history).toContainText('Eski');

  await page.getByRole('link', { name: 'Bosh sahifa' }).click();
  await expect(page.getByText('Sotuvchi ofertasi yangilandi')).toHaveCount(0);
});

test('oferta PDF yuklab olinadi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/profile/offer');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF yuklab olish' }).click();
  expect((await download).suggestedFilename()).toBe('sotuvchi-ofertasi-1.0.pdf');
});

test('JShShIR: yo‘riqnoma oynasi, hujjat yuklanishi va to‘xtatish, xato va qayta urinish', async ({ page }) => {
  await registerSeller(page, '977771140');
  await page.getByTestId('user-menu-button').click();
  await page.getByRole('menuitem', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  await page.getByRole('dialog').getByLabel('Ism').fill('Madina');
  await page.getByRole('dialog').getByLabel('Familiya').fill('Xasanova');
  await page.getByRole('dialog').getByRole('button', { name: 'Saqlash' }).click();
  await page.getByRole('link', { name: 'JShShIR va soliq maqomi' }).first().click();

  // Yo'riqnoma: 4 qadam, soliq misoli; oynadan «JShShIR kiritish».
  await page.getByRole('button', { name: 'Yo‘riqnoma', exact: true }).click();
  const guide = page.getByRole('dialog', { name: /O‘zini o‘zi band qilganlik — yo‘riqnoma/ });
  await expect(guide.locator('ol > li')).toHaveCount(4);
  await expect(guide).toContainText('Soliq misoli: 50 000 so‘m yechsangiz — soliq 500 so‘m, kartaga 49 500 so‘m.');
  await guide.getByRole('button', { name: 'JShShIR kiritish' }).click();

  const modal = page.getByRole('dialog', { name: 'JShShIR kiritish' });
  await modal.getByLabel(/^JShShIR/).fill('30101195600018');
  // Aloqa uzildi — «Yuklanmadi», «Qayta urinish»; yuborish yopiq.
  await page.route('**/api/v1/affiliate/self-employed/document', (route) => route.abort('internetdisconnected'));
  await modal.locator('input[type=file]').setInputFiles({ name: 'maqom.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(modal.getByRole('alert')).toHaveText('Yuklanmadi — aloqa uzildi');
  await expect(modal.getByRole('button', { name: 'Tekshiruvga yuborish' })).toBeDisabled();
  await page.unroute('**/api/v1/affiliate/self-employed/document');
  await modal.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(modal.getByText('Hujjat yuklanmoqda — yuborish yopiq.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Tekshiruvga yuborish' })).toBeDisabled();
  await expect(modal.getByText('PDF, JPG yoki PNG, 10 MB gacha')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Tekshiruvga yuborish' })).toBeEnabled();

  const submit = page.waitForRequest((request) => request.url().endsWith('/affiliate/self-employed') && request.method() === 'POST');
  await modal.getByRole('button', { name: 'Tekshiruvga yuborish' }).click();
  expect((await submit).postDataJSON()).toMatchObject({ pinfl: '30101195600018', documentId: expect.stringMatching(/^doc-/) });
  const status = page.getByRole('region', { name: 'Maqomingiz tekshirilmoqda' });
  await expect(status).toBeVisible();
  // Ma'lumotnoma alohida «Hujjat» kartasida (sotuvchi-jshshir), qulf belgisi — yopiq fayl.
  const document = page.getByRole('region', { name: 'Hujjat' });
  await expect(document).toContainText('maqom.pdf');
  await expect(document.getByLabel('yopiq fayl')).toBeVisible();
});

test('JShShIR: yuklashni to‘xtatish faylni olib tashlaydi', async ({ page }) => {
  await registerSeller(page, '977771141');
  await page.goto('/profile/self-employed');
  await page.getByRole('button', { name: 'JShShIR kiritish' }).click();
  const modal = page.getByRole('dialog', { name: 'JShShIR kiritish' });
  await page.route('**/api/v1/affiliate/self-employed/document', () => new Promise(() => undefined));
  await modal.locator('input[type=file]').setInputFiles({ name: 'katta.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(1024, 1) });
  await expect(modal.getByText('Hujjat yuklanmoqda — yuborish yopiq.')).toBeVisible();
  await modal.getByRole('button', { name: 'Yuklashni to‘xtatish' }).click();
  await expect(modal.getByText('Faylni shu yerga tashlang yoki kompyuterdan tanlang')).toBeVisible();
});

test('JShShIR: tasdiqlangan hujjat «Ochish» — yopiq fayl yangi oynada', async ({ page, context }) => {
  await loginSeller(page);
  await page.goto('/profile/self-employed');
  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Ochish' }).click();
  const opened = await popup;
  await expect.poll(() => opened.url()).toMatch(/^blob:/);
});

test('JShShIR telefonda: «Yo‘riqnoma» va «JShShIR kiritish» pastki panelda; oyna pastdan chiqadi', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerSeller(page, '977771142');
  await page.goto('/profile/self-employed');
  const buttons = page.locator('[data-app-main] button').filter({ hasText: /^(Yo‘riqnoma|JShShIR kiritish)$/ });
  await expect(buttons).toHaveCount(2);
  const bar = await buttons.last().boundingBox();
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeGreaterThan(844 - 80);
  await buttons.last().click();
  const sheet = page.locator('.ant-modal').filter({ hasText: 'JShShIR kiritish' });
  await expect(sheet).toBeVisible();
  // Ochilish animatsiyasi tugagach: pastga yopishgan, to'liq kenglikda.
  await expect.poll(async () => {
    const box = await sheet.boundingBox();
    return [Math.round((box?.y ?? 0) + (box?.height ?? 0)), Math.round(box?.width ?? 0)];
  }).toEqual([844, 390]);
});

test('ro‘yxat planshetda (768 px): navy qator 64, forma markazda, faktlar ikki ustunda', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto('/register');
  await expect(page.locator('[data-auth-layout]')).toHaveAttribute('data-auth-layout', 'tablet');
  expect((await page.locator('[data-auth-layout] > header').boundingBox())?.height).toBe(64);
  const items = page.getByRole('complementary').getByRole('listitem');
  const first = await items.nth(0).boundingBox();
  const second = await items.nth(1).boundingBox();
  expect(Math.round(first?.y ?? 0)).toBe(Math.round(second?.y ?? 1));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('raqamni o‘zgartirish oynasi telefonda pastdan chiqadi', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await page.getByLabel('Telefon raqami').fill('977771143');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByRole('button', { name: 'Raqamni o‘zgartirish' }).click();
  const sheet = page.locator('.ant-modal').filter({ hasText: 'Bu kod bekor bo‘ladi.' });
  await expect(sheet).toBeVisible();
  await expect.poll(async () => { const box = await sheet.boundingBox(); return Math.round((box?.y ?? 0) + (box?.height ?? 0)); }).toBe(844);
});

test('sessiya tugadi → sotuvchi joyida SMS kod bilan qayta kiradi, sahifa saqlanadi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/profile');
  await expect(pageTitle(page)).toHaveText('Profil');
  // Profil yuklanib bo'lgach sessiya tugaydi (aks holda profil so'rovining o'zi 401 olib, sahifa xato bilan qoladi).
  await expect(page.getByRole('button', { name: 'Tahrirlash' })).toBeVisible();

  const expire = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 401, json: { statusCode: 401, errorCode: 'UNAUTHENTICATED', message: 'Sessiya tugagan' } });
  await page.route('**/api/v1/affiliate/**', expire);
  await page.route('**/api/v1/auth/refresh', expire);
  await page.route('**/api/v1/auth/sessions', expire);
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  await page.getByRole('dialog').getByLabel('Ism').fill('Jasur');
  await page.getByRole('dialog').getByRole('button', { name: 'Saqlash' }).click();

  const dialog = page.getByTestId('session-expired');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toContainText('Kod +998 90 000 00 01 raqamiga yuboriladi.');
  await expect(dialog.getByLabel('Parol')).toHaveCount(0);
  await page.unroute('**/api/v1/affiliate/**', expire);
  await page.unroute('**/api/v1/auth/refresh', expire);
  await page.unroute('**/api/v1/auth/sessions', expire);

  await dialog.getByRole('button', { name: 'Kod olish' }).click();
  await dialog.getByLabel('SMS kod', { exact: true }).fill('000000');
  await dialog.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(dialog).toContainText('Kod noto‘g‘ri. Yana 2 ta urinish qoldi');
  await dialog.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await dialog.getByRole('button', { name: 'Kirish', exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Qayta kirdingiz. Sahifa va kiritganlaringiz joyida.')).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
});
