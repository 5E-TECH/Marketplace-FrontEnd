import { expect, test, type Browser, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-25 (OPT-2): mahsulot formasi — «Yangi mahsulot» (optovik nomidan), «Asosiy» tahrir, qoralama va moderatsiyaga
 * yuborish (admin-mahsulot-karta va …holatlar). Mock: Namuna Savdo MChJ (7) — shartnomali, Barakat Uy Jihozlari (9) —
 * shartnomasiz; 501 — faol, 507 — rad etilgan, 508 — qoralama.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const IMAGE = { name: 'kolonka.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]) };
const toast = (page: Page) => page.locator('.ant-notification-notice').last();
const status = (page: Page) => page.getByTestId('card-status');
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

async function signIn(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
}

/** Sotuvchi alohida kontekstda (o'z sessiyasi), o'sha mock bazasi bilan. */
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

/** Majburiy maydonlar (og'irliksiz) — TC1 da og'irlik qo'shiladi, TC2 da bo'sh qoladi. */
async function fillRequired(page: Page, name: string) {
  await field(page, 'Nomi').fill(name);
  await page.getByRole('combobox', { name: 'Kategoriya' }).selectOption({ label: 'Elektronika' });
  await field(page, 'Tavsif').fill('Bluetooth kolonka: 12 soat quvvat, suvdan himoyalangan korpus.');
  await page.getByLabel('Rasm yoki video').setInputFiles(IMAGE);
  const media = page.getByTestId('media-dialog');
  await expect(media.getByRole('status')).toHaveText('Yuklandi');
  await media.getByRole('button', { name: 'Qo‘shish', exact: true }).click();
  await expect(media).toBeHidden();
  await expect(page.getByTestId('product-media')).toContainText('Rasm 1/1');
  await field(page, 'Uzunlik').fill('20');
  await field(page, 'Eni').fill('10');
  await field(page, 'Balandlik').fill('9.5');
  await field(page, 'Optovik narxi (bazaviy), bitta dona').fill('150000');
}

test('TC1: optovik kartasidan → yangi mahsulot → moderatsiya navbatida, sotuvchi katalogida yo‘q', async ({ page, browser, baseURL }) => {
  await signIn(page);
  await page.goto('/admin/wholesalers/7');
  await page.getByTestId('wholesaler-head').getByRole('button', { name: 'Mahsulot qo‘shish' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new\?wholesaler=7$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Yangi mahsulot' })).toBeVisible();
  await expect(page.getByTestId('product-header')).toContainText('Yangi mahsulot · hali saqlanmagan · kiritadi: Nodira K. (optovik nomidan)');
  // Faqat «Asosiy» ochiq.
  await expect(page.getByRole('tab', { name: 'Narx' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('combobox', { name: 'Optovik' })).toHaveValue('7');
  await expect(page.getByRole('region', { name: 'Optovik' })).toContainText('Imzolangan');
  await expect(status(page)).toContainText('Kutilmoqda: Majburiy maydonlar');
  const submit = status(page).getByRole('button', { name: 'Moderatsiyaga yuborish' });
  await expect(submit).toBeDisabled();

  await fillRequired(page, 'Simsiz kolonka');
  await expect(field(page, 'Slug')).toHaveValue('simsiz-kolonka');
  await expect(page.getByTestId('category-inherit')).toContainText('ustama +10% · yetkazish qisman · BAD yo‘q · muddat kuzatilmaydi');
  await expect(submit).toBeDisabled();
  await field(page, 'Og‘irlik').fill('0,8');
  await expect(status(page)).toContainText('Majburiy maydonlarto‘ldirilgan');
  await expect(submit).toBeEnabled();

  const created = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/v1/admin/products'));
  await submit.click();
  const body = (await created).postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({ wholesalerId: '7', name: 'Simsiz kolonka', slug: 'simsiz-kolonka', weightGrams: 800, lengthMm: 200, widthMm: 100, heightMm: 95, basePrice: 150_000 });
  expect(body.draft).toBeUndefined();
  await expect(toast(page)).toContainText('Moderatsiyaga yuborildi: Simsiz kolonka');
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
  await expect(page.getByTestId('product-header')).toContainText('Ko‘rib chiqilmoqda');
  await expect(page.getByRole('note').filter({ hasText: 'Moderatsiyada' })).toBeVisible();
  await expect(status(page)).toContainText('Kutilmoqda: Mahsulotmoderatsiyada');

  await page.goto('/admin/moderation');
  await expect(page.getByTestId('moderation-queue').getByRole('link', { name: /Simsiz kolonka/ })).toBeVisible();
  const seller = await sellerCatalog(browser, baseURL);
  await expect(seller.page.getByTestId('offer-card').filter({ hasText: 'Simsiz kolonka' })).toHaveCount(0);
  await seller.close();
});

test('TC1 (to‘liq zanjir): admin optovik qo‘shdi (shartnoma bilan) → unga mahsulot qo‘shdi → moderatsiya navbatida, offerlarda yo‘q', async ({ page, browser, baseURL }) => {
  await signIn(page);
  await page.goto('/admin/wholesalers/new');
  const form = page.getByTestId('wholesaler-form');
  await form.getByLabel(/Kompaniya nomi/).fill('Gadget Trade MChJ');
  await form.getByLabel(/^STIR/).fill('305123456');
  await form.getByLabel(/Rahbar/).fill('Karimov Akmal');
  await form.getByLabel(/Yuridik manzil/).fill('Toshkent shahri, Mirobod tumani');
  await form.getByLabel(/^Telefon/).fill('901234567');
  await form.getByLabel(/^Bank/).fill('Kapitalbank');
  await form.getByLabel(/^MFO/).fill('01158');
  await form.getByLabel(/Hisob raqami/).fill('20208000900123456001');
  await form.locator('input[type="file"]').setInputFiles({ name: 'gadget-shartnoma.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await form.getByLabel(/Shartnoma raqami/).fill('K-2027/040');
  await form.getByLabel(/Imzolangan sana/).fill('20.11.2026');
  await form.getByLabel(/Imzolangan sana/).press('Enter');
  await form.getByRole('button', { name: 'Optovikni saqlash' }).click();
  await expect(page).toHaveURL(/\/admin\/wholesalers\/(\d+)$/);
  const wholesalerId = /\/admin\/wholesalers\/(\d+)$/.exec(page.url())?.[1] ?? '';
  await expect(page.getByTestId('wholesaler-head')).toContainText('Shartnoma imzolangan');

  await page.getByTestId('wholesaler-head').getByRole('button', { name: 'Mahsulot qo‘shish' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/products/new\\?wholesaler=${wholesalerId}$`));
  await expect(page.getByRole('combobox', { name: 'Optovik' })).toHaveValue(wholesalerId);
  await expect(page.getByRole('region', { name: 'Optovik' })).toContainText('Imzolangan');
  await fillRequired(page, 'Gadget kolonka');
  await field(page, 'Og‘irlik').fill('0.6');
  await status(page).getByRole('button', { name: 'Moderatsiyaga yuborish' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
  await expect(page.getByTestId('product-header')).toContainText('Ko‘rib chiqilmoqda');
  await expect(page.getByTestId('product-header')).toContainText('Gadget Trade MChJ');

  await page.goto('/admin/moderation');
  await expect(page.getByTestId('moderation-queue').getByRole('link', { name: /Gadget kolonka/ })).toBeVisible();
  const seller = await sellerCatalog(browser, baseURL);
  await expect(seller.page.getByTestId('offer-card').filter({ hasText: 'Gadget kolonka' })).toHaveCount(0);
  await seller.close();
});

test('TC2: og‘irliksiz — saqlanmaydi, xato maydon ostida va xulosada', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/new?wholesaler=7');
  await fillRequired(page, 'Simsiz kolonka');
  let posted = 0;
  page.on('request', (request) => {
    if (['POST', 'PATCH'].includes(request.method()) && /\/api\/v1\/admin\/products(\/\d+)?$/.test(request.url())) posted += 1;
  });
  await status(page).getByRole('button', { name: 'Qoralamani saqlash' }).click();
  await expect(page.getByTestId('product-form-errors')).toContainText('Saqlanmadi: 1 ta maydonda xato');
  await expect(page.getByTestId('product-form-errors')).toContainText('Og‘irlik — majburiy. Xato maydon ostida yozilgan.');
  const weight = field(page, 'Og‘irlik');
  await expect(weight).toHaveAttribute('aria-invalid', 'true');
  await expect(weight).toBeFocused();
  await expect(page.getByText('Og‘irlikni kiriting: usiz yetkazish narxi hisoblanmaydi. Og‘irliksiz mahsulot saqlanmaydi.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/new/);
  expect(posted).toBe(0);
});

test('TC2 (tahrir): sotuvdagi mahsulotda og‘irlikni o‘chirib saqlab bo‘lmaydi', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  let posted = 0;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith('/api/v1/admin/products/501')) posted += 1;
  });
  await field(page, 'Og‘irlik').fill('');
  await page.getByTestId('product-form-footer').getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByTestId('product-form-errors')).toContainText('Saqlanmadi: 1 ta maydonda xato');
  await expect(field(page, 'Og‘irlik')).toHaveAttribute('aria-invalid', 'true');
  expect(posted).toBe(0);
});

test('TC3: shartnomasiz optovik — xato, kartaga havola, yuborish yopiq, qoralama ham saqlanmaydi', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/new?wholesaler=9');
  const wholesaler = page.getByRole('region', { name: 'Optovik' });
  await expect(wholesaler).toContainText('Bu optovik bilan shartnoma imzolanmagan — mahsulot qo‘shib bo‘lmaydi.');
  await expect(wholesaler).toContainText('Imzolanmagan');
  await expect(wholesaler.getByRole('link', { name: 'Optovik kartasida shartnoma yuklash' })).toHaveAttribute('href', '/admin/wholesalers/9?dialog=contract');
  await fillRequired(page, 'Elektr pech');
  await field(page, 'Og‘irlik').fill('4');
  await expect(status(page).getByRole('button', { name: 'Moderatsiyaga yuborish' })).toBeDisabled();
  await status(page).getByRole('button', { name: 'Qoralamani saqlash' }).click();
  await expect(page.getByTestId('product-form-errors')).toContainText('Optovik — tekshiring.');
  await expect(page.getByRole('combobox', { name: 'Optovik' })).toBeFocused();
});

test('slug takror (BE-07 TC4) — 409, band qilgan mahsulot nomi bilan; qoralama va «Moderatsiyaga yuborish» oynasi', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/new?wholesaler=7');
  await fillRequired(page, 'Simsiz quloqchinlar');
  await field(page, 'Og‘irlik').fill('0.3');
  await status(page).getByRole('button', { name: 'Qoralamani saqlash' }).click();
  await expect(page.getByText('Bu slug band: «Simsiz quloqchinlar» mahsulotida. Boshqa slug yozing, masalan simsiz-quloqchinlar-2.')).toBeVisible();
  await expect(field(page, 'Slug')).toBeFocused();
  // Qo'lda yozilgan slug nom o'zgarsa ham saqlanadi.
  await field(page, 'Slug').fill('simsiz-quloqchinlar-2');
  await field(page, 'Nomi').fill('Simsiz quloqchinlar Pro');
  await expect(field(page, 'Slug')).toHaveValue('simsiz-quloqchinlar-2');

  const created = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/v1/admin/products'));
  await status(page).getByRole('button', { name: 'Qoralamani saqlash' }).click();
  expect((await created).postDataJSON()).toMatchObject({ draft: true, slug: 'simsiz-quloqchinlar-2' });
  await expect(toast(page)).toContainText('Qoralama saqlandi: Simsiz quloqchinlar Pro');
  await expect(page.getByTestId('product-header')).toContainText('Qoralama');
  await expect(page.getByRole('note').filter({ hasText: 'Qoralama — moderatsiyaga yuborilmagan' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Optovik' })).toContainText('Kiritgan: Nodira K.');

  await status(page).getByRole('button', { name: 'Moderatsiyaga yuborish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Simsiz quloqchinlar Proni moderatsiyaga yuborasizmi?' });
  await expect(dialog).toContainText('Og‘irlik 0.3 kg');
  await expect(dialog).toContainText('Video yo‘q');
  await dialog.getByRole('button', { name: 'Yuborish', exact: true }).click();
  await expect(toast(page)).toContainText('Moderatsiyaga yuborildi: Simsiz quloqchinlar Pro');
  await expect(page.getByTestId('product-header')).toContainText('Ko‘rib chiqilmoqda');
});

test('tahrir: faqat o‘zgargan maydon PATCH, «Saqlash» o‘zgarishdan keyin yonadi, «Bekor qilish» qaytaradi', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  const footer = page.getByTestId('product-form-footer');
  await expect(footer).toContainText('Hech bir maydon o‘zgarmagan — «Saqlash» o‘zgarishdan keyin yonadi.');
  await expect(footer.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Optovik' })).toContainText('Kiritgan: Nodira K.');
  await expect(page.getByRole('region', { name: 'Bazaviy narx' })).toContainText('Yashil');

  await field(page, 'Qisqa tavsif').fill('Ovozni pasaytiradi');
  await expect(footer).toContainText('O‘zgarishlar saqlanmagan');
  await footer.getByRole('button', { name: 'Bekor qilish' }).click();
  await expect(field(page, 'Qisqa tavsif')).toHaveValue('Bluetooth orqali ulanadi, quvvatlovchi g‘ilof bilan');

  await field(page, 'Uzunlik').fill('13');
  const patched = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/api/v1/admin/products/501'));
  await footer.getByRole('button', { name: 'Saqlash' }).click();
  expect((await patched).postDataJSON()).toEqual({ lengthMm: 130 });
  await expect(toast(page)).toContainText('Saqlandi: Simsiz quloqchinlar');
  await expect(footer.getByRole('button', { name: 'Saqlash' })).toBeDisabled();

  // BE-41: sotuvdagi CPA mahsulotida MXIK kodini o'chirib bo'lmaydi.
  await field(page, 'MXIK kodi').fill('');
  await footer.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('«MXIK kodi» — majburiy maydon.')).toBeVisible();
});

test('rad etilgan: sabab, «Qayta yuborish» tuzatish saqlangach yonadi', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/507');
  await expect(page.getByRole('note').filter({ hasText: /^Rad etildi — Nodira K\./ })).toBeVisible();
  const resubmit = status(page).getByRole('button', { name: 'Qayta yuborish' });
  await expect(resubmit).toBeDisabled();
  await expect(status(page)).toContainText('Xato maydon tuzatilib saqlangach faollashadi.');
  await field(page, 'Tavsif').fill('Magniy va B6 vitamini: kuniga 2 kapsula, ovqat bilan.');
  await expect(status(page)).toContainText('Avval o‘zgarishlarni saqlang.');
  await page.getByTestId('product-form-footer').getByRole('button', { name: 'Saqlash' }).click();
  await expect(toast(page)).toContainText('Saqlandi');
  await expect(resubmit).toBeEnabled();
  await resubmit.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yuborish', exact: true }).click();
  await expect(page.getByTestId('product-header')).toContainText('Ko‘rib chiqilmoqda');
});

test('rasm va video oynasi: noto‘g‘ri tur, katta hajm, yuklandi; saqlangan mahsulotga kreativ va asosiy rasm', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  const section = page.getByRole('region', { name: 'Rasm va video' });
  await expect(section).toContainText('1 video, 4 rasm');
  await section.getByRole('button', { name: 'Rasm va video qo‘shish' }).click();
  const dialog = page.getByTestId('media-dialog');
  await expect(dialog).toContainText('Simsiz quloqchinlar · hozir 1 video, 4 rasm');
  await expect(dialog.getByRole('button', { name: 'Qo‘shish', exact: true })).toBeDisabled();
  await dialog.getByLabel('Fayl tanlash').setInputFiles([
    { name: 'quloqchin-6.heic', mimeType: 'image/heic', buffer: Buffer.alloc(1000) },
    { name: 'katta-rasm.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024, 1) },
    { name: 'quloqchin-5.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(200_000, 1) },
  ]);
  await expect(dialog).toContainText('Bu turdagi fayl qabul qilinmaydi');
  await expect(dialog).toContainText('Hajmi chegaradan katta — chegara 10 MB');
  await expect(dialog.getByRole('status').filter({ hasText: 'Yuklandi' })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'quloqchin-6.heic ni olib tashlash' }).click();
  await expect(dialog).not.toContainText('quloqchin-6.heic');
  await dialog.getByLabel('Yuklangan rasmni asosiy qilish').check();
  const patched = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/api/v1/admin/products/501'));
  await dialog.getByRole('button', { name: 'Qo‘shish', exact: true }).click();
  const body = (await patched).postDataJSON() as { imageUrl: string; images: string[] };
  expect(body.images[0]).toBe(body.imageUrl);
  await expect(toast(page)).toContainText('Qo‘shildi: 1 ta fayl');
  await expect(section).toContainText('1 video, 5 rasm');
});

test('sertifikat: yopiq fayl va izoh bilan yuklash, olib tashlash', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  const section = page.getByRole('region', { name: 'Sertifikat va toifa' });
  await expect(section).toContainText('Sertifikat yuklanmagan');
  await section.getByRole('button', { name: 'Sertifikat qo‘shish' }).click();
  const dialog = page.getByTestId('certificate-dialog');
  await expect(dialog.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  await dialog.getByLabel('Fayl tanlash').setInputFiles({ name: 'eslatma.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.alloc(100) });
  await expect(dialog).toContainText('Bu turdagi fayl qabul qilinmaydi');
  await expect(dialog.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  await dialog.getByLabel('Fayl tanlash').setInputFiles({ name: 'Muvofiqlik sertifikati.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(300_000, 1) });
  await expect(dialog).toContainText('Muvofiqlik sertifikati.pdf— yopiq fayl');
  await dialog.getByLabel('Izoh').fill('P-0112 partiyasi');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(toast(page)).toContainText('Sertifikat yuklandi: Muvofiqlik sertifikati.pdf');
  await expect(section).toContainText('Yuklandi — admin moderatsiyada ko‘radi');
  await section.getByRole('button', { name: 'Muvofiqlik sertifikati.pdf ni olib tashlash' }).click();
  await expect(section).toContainText('Sertifikat yuklanmagan');
});

test('arxivlash: sotuvdagi mahsulot — avval to‘xtatish kerak; rad etilgan — arxivga', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  await status(page).getByRole('button', { name: 'Arxivlash' }).click();
  let dialog = page.getByTestId('archive-dialog');
  await expect(dialog).toContainText('Mahsulot sotuvda — avval to‘xtating, keyin arxivlang.');
  await expect(dialog.getByRole('button', { name: 'Arxivlash' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Bekor qilish' }).click();

  await page.goto('/admin/products/507');
  await page.getByRole('button', { name: 'Boshqa amallar: to‘xtatish, arxivlash' }).click();
  await page.getByRole('menuitem', { name: 'Arxivlash' }).click();
  dialog = page.getByTestId('archive-dialog');
  await expect(dialog).toContainText('Magniy B6 kapsulalarini arxivlaysizmi?');
  await expect(dialog).toContainText('Kerak emas: Qoldig‘i yoki ochiq buyurtmasi bor mahsulot');
  await expect(dialog).toContainText('Bu mahsulot rad etilgan: qoldig‘i va buyurtmasi yo‘q.');
  await dialog.getByRole('button', { name: 'Arxivlash' }).click();
  await expect(toast(page)).toContainText('Arxivlandi: Magniy B6 kapsulalari');
  await expect(page.getByTestId('product-header')).toContainText('Arxivda');
  await expect(page.getByTestId('product-header')).toContainText('arxivlangan');
});

test('TC5: CPA mahsuloti — «Variant qo‘shish» yo‘q, bitta SKU (shtrix-kod va yacheyka)', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  await expect(status(page)).toBeVisible();
  await expect(page.getByText(/Variant qo‘shish/)).toHaveCount(0);
  const stock = page.getByTestId('card-stock');
  await expect(stock).toContainText('Shtrix-kod');
  await expect(stock).toContainText('Yacheyka');
  await page.getByRole('tab', { name: 'Qoldiq' }).click();
  await expect(page.getByText(/Variant qo‘shish/)).toHaveCount(0);

  // Yangi mahsulot formasida ham variant yo'q — backend bitta SKU ni o'zi yaratadi (BE-07).
  await page.goto('/admin/products/new?wholesaler=7');
  await expect(page.getByRole('region', { name: 'Mahsulot' })).toBeVisible();
  await expect(page.getByText(/Variant/)).toHaveCount(0);
});

test('telefon: «⋯» — varaq (sotuvchi sifatida ko‘rish, to‘xtatish, arxivlash), forma paneli pastda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/admin/products/501');
  await page.getByRole('button', { name: 'Boshqa amallar: sotuvchi sifatida ko‘rish, to‘xtatish, arxivlash' }).click();
  const sheet = page.getByTestId('product-sheet');
  await expect(sheet).toContainText('Faol · sotuvda');
  await expect(sheet.getByRole('menuitem')).toHaveText(['Sotuvchi sifatida ko‘rish', 'To‘xtatish', 'Arxivlash']);
  await sheet.getByRole('button', { name: 'Yopish' }).click();
  await expect(page.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  await expect(page.getByText('Hech bir maydon o‘zgarmagan', { exact: true })).toBeVisible();
  await field(page, 'Uzunlik').fill('13');
  await expect(page.getByText('O‘zgarishlar saqlanmagan', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saqlash' })).toBeEnabled();
});

test('mahsulotlar ro‘yxati: «Mahsulot qo‘shish» → yangi mahsulot; «Arxiv» yorlig‘i — arxivlangan «Hammasi» da yo‘q', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products');
  await page.getByRole('link', { name: 'Mahsulot qo‘shish' }).first().click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Yangi mahsulot' })).toBeVisible();

  await page.goto('/admin/products?tab=ARCHIVED');
  await expect(page.getByRole('tab', { name: /^Arxiv/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Arxiv bo‘sh', { exact: true })).toBeVisible();

  await page.goto('/admin/products/507');
  await page.getByRole('button', { name: 'Boshqa amallar: to‘xtatish, arxivlash' }).click();
  await page.getByRole('menuitem', { name: 'Arxivlash' }).click();
  await page.getByTestId('archive-dialog').getByRole('button', { name: 'Arxivlash' }).click();
  await expect(page.getByRole('note').filter({ hasText: /^Arxivda — / })).toBeVisible();

  await page.goto('/admin/products');
  await expect(page.getByRole('tab', { name: /^Arxiv/ })).toContainText('1');
  await expect(page.getByText('Magniy B6 kapsulalari', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: /^Arxiv/ }).click();
  await expect(page).toHaveURL(/tab=ARCHIVED/);
  await expect(page.getByText('Magniy B6 kapsulalari', { exact: true }).first()).toBeVisible();
});

test('BE-41: kodsiz CPA mahsuloti moderatsiyada tasdiqlanmaydi — kartada kodlar kiritilgach tasdiqlanadi', async ({ page }) => {
  const RULES = ['Taqiqlangan tovarlar ro‘yxatida yo‘q', 'Kasallikni davolash va’dasi yo‘q', 'Mijoz sharhlari ishlatilmagan', 'Soxta chegirma yo‘q', 'Sertifikat shu mahsulotga tegishli'];
  await signIn(page);
  await page.goto('/admin/products/new?wholesaler=7');
  await fillRequired(page, 'Simsiz kolonka');
  await field(page, 'Og‘irlik').fill('0.8');
  await status(page).getByRole('button', { name: 'Moderatsiyaga yuborish' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
  const productUrl = page.url();

  await page.goto('/admin/moderation');
  await page.getByTestId('moderation-queue').getByRole('link', { name: /Simsiz kolonka/ }).click();
  const decision = page.getByTestId('moderation-decision');
  await expect(decision).toContainText('CPA: MXIK va qadoq kodi kiritilmagan — fiskal chek chiqmaydi');
  for (const rule of RULES) await decision.getByRole('checkbox', { name: new RegExp(rule) }).check();
  const approve = decision.getByRole('button', { name: /Mahsulotni tasdiqlash/ });
  await expect(approve).toBeDisabled();
  await expect(decision).toContainText('Tizim tekshiruvi o‘tmagan — tasdiqlab bo‘lmaydi.');
  await expect(page.getByText('MXIK kodi', { exact: true })).toBeVisible();
  await expect(page.getByText('CPA mahsulotida majburiy — fiskal chekda chiqadi')).toBeVisible();

  await decision.getByRole('link', { name: 'Mahsulot kartasida kiritish' }).click();
  await expect(page).toHaveURL(productUrl);
  await field(page, 'MXIK kodi').fill('03304001001000000');
  await field(page, 'Qadoq kodi').fill('1500012');
  await page.getByTestId('product-form-footer').getByRole('button', { name: 'Saqlash' }).click();
  await expect(toast(page)).toContainText('Saqlandi');

  await page.goto('/admin/moderation');
  await page.getByTestId('moderation-queue').getByRole('link', { name: /Simsiz kolonka/ }).click();
  await expect(decision).toContainText('MXIK va qadoq kodi kiritilgan (fiskal chek)');
  for (const rule of RULES) await decision.getByRole('checkbox', { name: new RegExp(rule) }).check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await page.getByRole('dialog', { name: 'Mahsulotni tasdiqlaysizmi?' }).getByRole('button', { name: 'Tasdiqlash', exact: true }).click();
  await expect(page.getByText('Mahsulot tasdiqlandi', { exact: true })).toBeVisible();
});

test('saqlangan mahsulot nomi tuzatilsa slug (saytdagi manzil) o‘zgarmaydi', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/products/501');
  await field(page, 'Nomi').fill('Simsiz quloqchinlar Pro');
  await expect(field(page, 'Slug')).toHaveValue('simsiz-quloqchinlar');
  const patched = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/api/v1/admin/products/501'));
  await page.getByTestId('product-form-footer').getByRole('button', { name: 'Saqlash' }).click();
  expect((await patched).postDataJSON()).toEqual({ name: 'Simsiz quloqchinlar Pro' });
});

test('to‘xtatilgan optovik (havola bilan tanlangan) — mahsulot qo‘shilmaydi', async ({ page }) => {
  const wholesaler = db.inbound.wholesalers.find((item) => item.id === '7');
  if (wholesaler) wholesaler.status = 'SUSPENDED';
  await signIn(page);
  await page.goto('/admin/products/new?wholesaler=7');
  await expect(page.getByRole('region', { name: 'Optovik' })).toContainText('Optovik to‘xtatilgan — unga mahsulot qo‘shib bo‘lmaydi.');
  await expect(status(page)).toContainText('Bajarilmagan: Optovik va shartnomato‘xtatilgan');
  await fillRequired(page, 'Simsiz kolonka');
  await field(page, 'Og‘irlik').fill('0.8');
  await expect(status(page).getByRole('button', { name: 'Moderatsiyaga yuborish' })).toBeDisabled();
  let posted = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/admin/products')) posted += 1;
  });
  await status(page).getByRole('button', { name: 'Qoralamani saqlash' }).click();
  await expect(page.getByTestId('product-form-errors')).toContainText('Optovik — tekshiring.');
  expect(posted).toBe(0);
});
