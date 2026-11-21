import { expect, test, type Browser, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-12 (admin-skript, admin-landing-mazmuni): suhbat skripti operator lid kartasida ko'rinadi (TC3, OPR-2),
 * sotuvchi sahifasi matnlari — afzalliklar va «Qutida»; saqlanmagan o'zgarish bilan chiqishda so'raydi.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function signIn(page: Page, phone: string, home: RegExp) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(home);
}

async function operatorCard(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  await installMockApi(context, { reset: false });
  const page = await context.newPage();
  await signIn(page, '900000003', /\/operator$/);
  await page.getByRole('radio', { name: 'Onlayn' }).click();
  await page.getByRole('button', { name: /Keyingi lid/ }).click();
  const card = page.getByTestId('lead-card');
  await expect(card.getByRole('heading', { level: 2 })).toContainText('Sarvar');
  return { card, close: () => context.close() };
}

const step = (page: Page, index: number) => page.getByLabel(`${index}-qator matni`);

test('TC3: offerga skript yozildi → operator lid kartasida ko‘rindi', async ({ page, browser, baseURL }) => {
  await signIn(page, '900000007', /\/admin\/moderation$/);
  await page.goto('/admin/products/503?tab=script');
  await expect(page.getByText('Skript hali yozilmagan')).toBeVisible();
  await page.getByRole('button', { name: 'Namuna bilan boshlash' }).click();
  await expect(page.getByTestId('script-editor').getByRole('listitem')).toHaveCount(5);
  await step(page, 2).fill('Elektr choynak uchun arizangiz keldi. Bugun rasmiylashtiramizmi?');
  await expect(page.getByTestId('script-preview')).toContainText('Elektr choynak uchun arizangiz keldi.');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Saqlandi', { exact: true })).toBeVisible();
  expect(db.offerContents['503']?.callScript?.split('\n')).toHaveLength(5);

  const operator = await operatorCard(browser, baseURL);
  await expect(operator.card.getByRole('heading', { name: 'Suhbat skripti' })).toBeVisible();
  await expect(operator.card).toContainText('Elektr choynak uchun arizangiz keldi. Bugun rasmiylashtiramizmi?');
  await expect(operator.card).toContainText('Suhbat sifat nazorati uchun yozib olinadi.');
  await operator.close();
});

test('skript qoidalari: ogohlantirish gapi birinchi qatorda, summa matnga yozilmaydi', async ({ page }) => {
  await signIn(page, '900000007', /\/admin\/moderation$/);
  await page.goto('/admin/products/503?tab=script');
  await page.getByRole('button', { name: 'Namuna bilan boshlash' }).click();
  await step(page, 1).fill('Assalomu alaykum!');
  await step(page, 3).fill('Narxi 245 000 so‘m, to‘lov olganda.');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Birinchi qatorda «Suhbat sifat nazorati uchun yozib olinadi.» gapi bo‘lishi shart.')).toBeVisible();
  await expect(page.getByText(/Summani matnga yozmang/)).toBeVisible();
  expect(db.offerContents['503']?.callScript).toBeNull();
});

test('landing: afzalliklar va «Qutida» saqlanadi, oldindan ko‘rishda chiqadi; saqlanmagan o‘zgarishda so‘raydi', async ({ page }) => {
  await signIn(page, '900000007', /\/admin\/moderation$/);
  await page.goto('/admin/products/501?tab=landing');
  await page.getByRole('textbox', { name: '3-afzallik' }).fill('Bir quvvatlashda 6 soat ishlaydi.');
  await page.getByTestId('box-editor').getByRole('button', { name: 'Qo‘shish' }).click();
  await page.getByRole('textbox', { name: '4-band' }).fill('foydalanish yo‘riqnomasi');

  await page.getByRole('tab', { name: 'Offer' }).click();
  const leave = page.getByRole('dialog', { name: 'Saqlanmagan o‘zgarish bor' });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Qolish' }).click();
  await expect(page.getByRole('tab', { name: 'Landing' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Saqlandi', { exact: true })).toBeVisible();
  expect(db.offerContents['501']).toMatchObject({
    highlights: ['Telefonga Bluetooth orqali ulanadi.', 'Ixcham g‘ilofda saqlanadi va quvvatlanadi.', 'Bir quvvatlashda 6 soat ishlaydi.'],
    boxContents: ['quloqchinlar (juft)', 'quvvatlovchi g‘ilof', 'quvvat kabeli', 'foydalanish yo‘riqnomasi'],
  });

  await page.getByTestId('content-save-bar').getByRole('button', { name: 'Oldindan ko‘rish' }).click();
  await expect(page.getByTestId('landing-preview-s1')).toContainText('Bir quvvatlashda 6 soat ishlaydi.');
  await page.getByRole('dialog').getByRole('button', { name: 'Yopish' }).click();

  await page.getByRole('textbox', { name: '1-afzallik' }).fill('');
  await page.getByRole('textbox', { name: '2-afzallik' }).fill('');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Kamida 2 ta afzallik yozing.')).toBeVisible();
});
