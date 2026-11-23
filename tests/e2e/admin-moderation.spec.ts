import { expect, test, type Browser, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-12 (admin-moderatsiya): mahsulot navbati, tekshiruv bandlari, tasdiqlash va sabab bilan rad etish.
 * Sotuvchi katalogi admin qaroriga bog'liq: tasdiqlanmagan mahsulot ko'rinmaydi (qabul mezoni 1),
 * tasdiqlangani chiqadi (TC1), rad etilgani chiqmaydi (TC2). Mock bazasi ikki kontekstga umumiy.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const RULES = [
  'Taqiqlangan tovarlar ro‘yxatida yo‘q',
  'Kasallikni davolash va’dasi yo‘q',
  'Mijoz sharhlari ishlatilmagan',
  'Soxta chegirma yo‘q',
  'Sertifikat shu mahsulotga tegishli',
];

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
}

/** Sotuvchi alohida kontekstda (o'z sessiyasi), lekin o'sha mock bazasi bilan. */
async function sellerCatalog(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  await installMockApi(context, { reset: false });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('900000001');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
  await page.goto('/affiliate/offers');
  await expect(page.getByTestId('offer-card').first()).toBeVisible();
  return { page, close: () => context.close() };
}

const offerCard = (page: Page, name: string) => page.getByTestId('offer-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
const queue = (page: Page) => page.getByTestId('moderation-queue');
const decision = (page: Page) => page.getByTestId('moderation-decision');

async function tickAll(page: Page) {
  for (const rule of RULES) await decision(page).getByRole('checkbox', { name: new RegExp(rule) }).check();
}

test('navbat: eng eskisi tepada, birinchi mahsulot ochiq, BAD va muddat bandlari qo‘llanmaydi', async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByRole('tab', { name: /Mahsulot\s*2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(queue(page).getByRole('link')).toHaveText([/^Bug‘li dazmol/, /^Soch quritgich/]);
  await expect(page.getByRole('heading', { level: 2, name: /Bug‘li dazmol — yangi mahsulot/ })).toBeVisible();
  await expect(page.getByText('Video yo‘q', { exact: true })).toBeVisible();
  await expect(page.getByText('tavsiya narx 210 000 so‘m, mijoz ko‘radi 221 000 so‘m (qisman rejim)')).toBeVisible();
  await expect(page.getByText('3 kg gacha: Elchi tarifi markazgacha 40 000 so‘m')).toBeVisible();
  await expect(decision(page).getByRole('checkbox')).toHaveCount(5);
  await expect(decision(page).getByText('Faqat BAD uchun majburiy. Bu mahsulot BAD emas — talab qilinmaydi.')).toBeVisible();
  await expect(page.getByTestId('product-audit').getByRole('row')).toHaveCount(4);
  await expect(page.getByTestId('product-audit')).toContainText('Mahsulot moderatsiyaga yuborildi · holat: Qoralama → Ko‘rib chiqilmoqda');
});

test('TC1 va qabul mezoni 1: tasdiqlanmagan mahsulot sotuvchiga ko‘rinmaydi, tasdiqlangach katalogda', async ({ page, browser, baseURL }) => {
  const seller = await sellerCatalog(browser, baseURL);
  await expect(offerCard(seller.page, 'Soch quritgich')).toHaveCount(0);
  await expect(offerCard(seller.page, 'Bug‘li dazmol')).toHaveCount(0);

  await loginAdmin(page);
  await queue(page).getByRole('link', { name: /Soch quritgich/ }).click();
  await expect(page).toHaveURL(/product=509/);
  const approve = decision(page).getByRole('button', { name: /Mahsulotni tasdiqlash/ });
  await expect(approve).toBeDisabled();
  await tickAll(page);
  await expect(decision(page).getByText('Qo‘llanadigan 5 bandning 5 tasi belgilandi')).toBeVisible();
  await approve.click();

  const dialog = page.getByRole('dialog', { name: 'Mahsulotni tasdiqlaysizmi?' });
  await expect(dialog).toContainText('Soch quritgich · Namuna Savdo MChJ');
  await expect(dialog).toContainText('Narx, video va qoldiq bor — sotuvchilar katalogida darhol chiqadi.');
  await dialog.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(page.getByText('Mahsulot tasdiqlandi', { exact: true })).toBeVisible();
  await expect(queue(page).getByRole('link')).toHaveText([/^Bug‘li dazmol/]);
  await expect(page.getByRole('tab', { name: /Mahsulot\s*1/ })).toBeVisible();

  await seller.page.reload();
  await expect(offerCard(seller.page, 'Soch quritgich')).toHaveCount(1);
  await seller.close();
});

test('TC2: sabab bilan rad etish — belgilanmagan band ko‘rsatiladi, sabab majburiy, katalogda yo‘q', async ({ page, browser, baseURL }) => {
  await loginAdmin(page);
  for (const rule of RULES.slice(0, 4)) await decision(page).getByRole('checkbox', { name: new RegExp(rule) }).check();
  await decision(page).getByLabel('Sabab').fill('Sertifikat boshqa modelga berilgan');
  await decision(page).getByRole('button', { name: 'Rad etish' }).click();

  const dialog = page.getByRole('dialog', { name: 'Mahsulotni rad etish' });
  await expect(dialog.getByText('Belgilanmagan band')).toBeVisible();
  await expect(dialog.getByRole('listitem')).toHaveText(['Sertifikat shu mahsulotga tegishli']);
  const reason = dialog.getByLabel(/Sabab/);
  await expect(reason).toHaveValue('Sertifikat boshqa modelga berilgan');
  await reason.fill('');
  await dialog.getByRole('button', { name: 'Rad etish' }).click();
  await expect(reason).toHaveAttribute('aria-invalid', 'true');
  await reason.fill('Sertifikat boshqa modelga berilgan: nom mos emas. Shu mahsulot sertifikatini yuklab, qayta yuboring.');
  await dialog.getByRole('button', { name: 'Rad etish' }).click();
  await expect(page.getByText('Mahsulot rad etildi', { exact: true })).toBeVisible();
  await expect(page.getByText('Bug‘li dazmol — sabab Namuna Savdo MChJ kabinetida ko‘rinadi.')).toBeVisible();
  await expect(queue(page).getByRole('link')).toHaveText([/^Soch quritgich/]);
  expect(db.adminProducts.find((product) => product.id === '506')).toMatchObject({ status: 'REJECTED', moderationNote: expect.stringContaining('nom mos emas') });
  await page.goto('/admin/products/506');
  await expect(page.getByTestId('product-header')).toContainText('Rad etildi');
  await expect(page.getByRole('note').filter({ hasText: 'Rad etildi' })).toContainText('Sertifikat boshqa modelga berilgan: nom mos emas.');

  const seller = await sellerCatalog(browser, baseURL);
  await expect(offerCard(seller.page, 'Bug‘li dazmol')).toHaveCount(0);
  await seller.close();
});

test('8.1: boshqa admin qaror qilgan — belgilar o‘chadi, «Navbatni yangilash»', async ({ page }) => {
  await loginAdmin(page);
  await tickAll(page);
  // Shu orada boshqa admin «Bug‘li dazmol» ni tasdiqladi.
  const product = db.adminProducts.find((item) => item.id === '506');
  if (product) product.status = 'ACTIVE';
  await decision(page).getByRole('button', { name: /Mahsulotni tasdiqlash/ }).click();
  await page.getByRole('dialog', { name: 'Mahsulotni tasdiqlaysizmi?' }).getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(decision(page).getByText('Bu mahsulot bo‘yicha boshqa admin qaror qildi')).toBeVisible();
  await expect(decision(page).getByRole('checkbox').first()).toBeDisabled();
  await decision(page).getByRole('button', { name: 'Navbatni yangilash' }).click();
  await expect(queue(page).getByRole('link')).toHaveText([/^Soch quritgich/]);
});

test('Ctrl+Enter: bandlar belgilangach tasdiqlash oynasini ochadi; «Bekor qilish» belgilarni tozalaydi', async ({ page }) => {
  await loginAdmin(page);
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tickAll(page);
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('dialog', { name: 'Mahsulotni tasdiqlaysizmi?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish' }).click();
  await decision(page).getByRole('button', { name: 'Bekor qilish' }).click();
  await expect(decision(page).getByText('Qo‘llanadigan 5 bandning 0 tasi belgilandi')).toBeVisible();
});

test('telefon: navbat ro‘yxati → mahsulot sahifasi, pastki panelda tasdiqlash', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);
  await queue(page).getByRole('link', { name: /Soch quritgich/ }).click();
  await expect(page).toHaveURL(/\/admin\/moderation\/509$/);
  await expect(page.getByText('Mahsulot navbati · 2 / 2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Orqaga: Moderatsiya' })).toBeVisible();
  const approve = page.getByRole('button', { name: 'Mahsulotni tasdiqlash' });
  await expect(approve).toBeDisabled();
  await tickAll(page);
  await approve.click();
  await page.getByRole('dialog', { name: 'Mahsulotni tasdiqlaysizmi?' }).getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await expect(queue(page).getByRole('link')).toHaveText([/Bug‘li dazmol/]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('mahsulot navbati bo‘sh holati; «Narx» tabida narx navbati (FE-13)', async ({ page }) => {
  db.adminProducts.forEach((product) => {
    if (product.status === 'PENDING_REVIEW') product.status = 'ACTIVE';
  });
  await loginAdmin(page);
  await expect(page.getByTestId('moderation-empty')).toContainText('Mahsulot navbati bo‘sh');
  await page.getByRole('tab', { name: /Narx/ }).click();
  await expect(page).toHaveURL(/tab=prices/);
  await expect(page.getByTestId('price-queue')).toContainText('Narx navbati');
});
