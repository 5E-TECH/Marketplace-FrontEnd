import { expect, test, type Browser, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-12 (admin-offer): offer holati va ochilish shartlari, kreativ yuklash (BE-08), haqni o'zgartirish,
 * «Qayerda sotiladi», S1/S3 oldindan ko'rish (TC4), videosiz offer sotuvchiga chiqmaydi (TC5, qabul mezoni 2).
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function openOffer(page: Page, productId: string, tab = 'offer') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await page.goto(`/admin/products/${productId}?tab=${tab}`);
}

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
const status = (page: Page) => page.getByTestId('offer-status');

test('TC5 va qabul mezoni 2: videosiz offer sotuvchiga chiqmaydi, admin sababini ko‘radi; video qo‘shilgach ochiladi', async ({ page, browser, baseURL }) => {
  const seller = await sellerCatalog(browser, baseURL);
  await expect(offerCard(seller.page, 'Elektr ustara')).toHaveCount(0);

  await openOffer(page, '510');
  await expect(status(page)).toContainText('Ochilmaydi');
  await expect(status(page)).toContainText('Sotuvchilarga ko‘rinmaydi');
  await expect(status(page)).toContainText('Shartlar bajarilmaguncha offer katalogga chiqmaydi: video.');
  await expect(status(page).getByText('Video yo‘q')).toBeVisible();

  await page.getByRole('button', { name: 'Kreativ yuklash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kreativ yuklash' });
  await expect(dialog.getByRole('radio', { name: 'Video' })).toHaveAttribute('aria-checked', 'true');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'ustara.mp4', mimeType: 'video/mp4', buffer: Buffer.from('ftypmp42-mock-video') });
  await expect(dialog.getByText('Yuklandi')).toBeVisible();
  const add = dialog.getByRole('button', { name: 'Kutubxonaga qo‘shish' });
  await expect(add).toBeDisabled();
  for (const rule of ['Kasallikni davolash va’dasi yo‘q', 'Mijoz sharhlari ishlatilmagan', 'Soxta chegirma yo‘q']) await dialog.getByLabel(rule).check();
  await add.click();
  await expect(page.getByText('Kreativ qo‘shildi')).toBeVisible();
  await expect(status(page)).toContainText('Sotuvchilar katalogida ochiq');

  await seller.page.reload();
  await expect(offerCard(seller.page, 'Elektr ustara')).toHaveCount(1);
  await seller.close();
});

test('kreativ yuklash: noto‘g‘ri tur va katta hajm qabul qilinmaydi', async ({ page }) => {
  await openOffer(page, '510');
  await page.getByRole('button', { name: 'Kreativ yuklash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kreativ yuklash' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'reklama.mov', mimeType: 'video/quicktime', buffer: Buffer.from('mov') });
  await expect(dialog.getByText('Bu turdagi fayl qabul qilinmaydi')).toBeVisible();
  await dialog.getByRole('radio', { name: 'Rasm' }).click();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'katta.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(dialog.getByText('Hajmi chegaradan katta — chegara 10 MB')).toBeVisible();
});

test('TC4: oldindan ko‘rish S1 va S3 da ochiladi', async ({ page }) => {
  await openOffer(page, '501');
  await page.getByTestId('landing-view').getByRole('button', { name: 'Oldindan ko‘rish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sotuvchi sahifasini oldindan ko‘rish' });
  await expect(dialog.getByTestId('landing-preview-s1')).toBeVisible();
  await expect(dialog.getByTestId('landing-preview-s1')).toContainText('Simsiz quloqchinlar haqida');
  await expect(dialog.getByTestId('landing-preview-s1')).toContainText('Telefonga Bluetooth orqali ulanadi.');
  await expect(dialog.getByLabel('Ismingiz')).toBeVisible();
  await expect(dialog.getByTestId('landing-preview-s1')).toContainText('262 000 so‘m');

  await dialog.getByRole('radio', { name: /S3/ }).click();
  const s3 = dialog.getByTestId('landing-preview-s3');
  await expect(s3).toContainText('Hozir hech narsa to‘lamaysiz');
  await expect(s3).toContainText('Qutida nima bor');
  await expect(dialog.getByLabel('Ismingiz')).toHaveCount(0);
  await s3.getByRole('button', { name: 'Buyurtma berish' }).click();
  await expect(s3).toContainText('Buyurtma — 2-qadam');
  await expect(dialog.getByLabel('Ismingiz')).toBeVisible();
  await dialog.getByRole('radio', { name: 'Kompyuter' }).click();
  await expect(dialog.getByTestId('landing-preview-s3')).toHaveAttribute('data-device', 'desktop');
});

test('haqni o‘zgartirish: qayta hisob, sabab majburiy, sotuvchi yangi haqni ko‘radi', async ({ page, browser, baseURL }) => {
  await openOffer(page, '501');
  await page.getByRole('button', { name: 'Haqni o‘zgartirish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sotuvchi haqini o‘zgartirish' });
  await expect(dialog).toContainText('10 185 so‘m');
  await dialog.getByLabel('Yangi haq').fill('70000');
  await expect(dialog).toContainText('5 385 so‘m');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByLabel(/Sabab/)).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel(/Sabab/).fill('Reklama xarajati oshdi');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Sotuvchi haqi o‘zgardi')).toBeVisible();
  await expect(page.getByTestId('offer-fee')).toContainText('70 000 so‘m');
  expect(db.priceDecisions['501']?.[0]).toMatchObject({ affiliateFee: 70_000, reason: 'Reklama xarajati oshdi' });

  const seller = await sellerCatalog(browser, baseURL);
  await expect(offerCard(seller.page, 'Simsiz quloqchinlar')).toContainText('70 000 so‘m');
  await seller.close();
});

test('«Faqat sayt»: tasdiq oynasi, offer sotuvchilarga yopiladi', async ({ page }) => {
  await openOffer(page, '503');
  await page.getByRole('radio', { name: 'Faqat sayt' }).click();
  await page.getByRole('dialog', { name: 'Faqat saytda sotilsinmi?' }).getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect(status(page)).toContainText('Sotuvchilarga yopiq');
  await expect(page.getByRole('radio', { name: 'Faqat sayt' })).toHaveAttribute('aria-checked', 'true');
  expect(db.adminProducts.find((product) => product.id === '503')?.cpaEnabled).toBe(false);
});

test('yagona videoni o‘chirish — ogohlantirish, offer yopiladi; «Kreativlar» yorlig‘ida ro‘yxat', async ({ page }) => {
  await openOffer(page, '505', 'creatives');
  await expect(page.getByTestId('creatives-table').getByRole('row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Video: amallar' }).click();
  await page.getByRole('menuitem', { name: 'O‘chirish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kreativni o‘chirasizmi?' });
  await expect(dialog.getByRole('note')).toContainText('Bu offerdagi yagona video');
  await expect(dialog).toContainText('yagona video');
  await dialog.getByRole('button', { name: 'O‘chirish' }).click();
  await expect(dialog.getByLabel(/Sabab/)).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel(/Sabab/).fill('Video eskirgan');
  await dialog.getByRole('button', { name: 'O‘chirish' }).click();
  await expect(page.getByText('Kreativ o‘chirildi')).toBeVisible();
  expect(db.productAudit.find((entry) => entry.entityId === '505' && entry.action === 'creative.delete')?.meta).toMatchObject({ reason: 'Video eskirgan' });
  await page.getByRole('tab', { name: 'Offer' }).click();
  await expect(status(page)).toContainText('Ochilmaydi');
});
