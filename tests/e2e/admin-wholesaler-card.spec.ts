import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-25: optovik kartasi va «Yangi optovik» (admin-optovik-karta). Mock: Namuna Savdo MChJ (7) — shartnoma, kabinet
 * faol, 206 dona; Namuna Farm MChJ (8) — kabinetsiz; Barakat Uy Jihozlari MChJ (9) — shartnomasiz (TC3).
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const toast = (page: Page) => page.locator('.ant-notification-notice').last();
const head = (page: Page) => page.getByTestId('wholesaler-head');

async function signIn(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
}

async function openCard(page: Page, id: string, query = '') {
  await signIn(page);
  await page.goto(`/admin/wholesalers/${id}${query}`);
  await expect(head(page)).toBeVisible();
}

test('karta: belgilar, rekvizitlar, shartnoma fayllari, kabinet, tovar holati, pul, mahsulotlar va postavkalar', async ({ page }) => {
  await openCard(page, '7');
  await expect(page.getByRole('heading', { level: 1, name: 'Namuna Savdo MChJ' })).toBeVisible();
  await expect(head(page)).toContainText('Shartnoma imzolangan');
  await expect(head(page)).toContainText('Kabinet faol');
  await expect(head(page).getByRole('button', { name: 'Postavka arizasi' })).toBeEnabled();
  const requisites = page.getByRole('region', { name: 'Rekvizitlar' });
  await expect(requisites).toContainText('307418562');
  await expect(requisites).toContainText('2020 8000 4051 2873 9001');
  const contract = page.getByRole('region', { name: 'Komissiya shartnomasi' });
  await expect(contract).toContainText('shartnoma-skan.pdf');
  await expect(contract).toContainText('Elektron shartnoma');
  const goods = page.getByRole('region', { name: 'Tovar holati' });
  await expect(goods).toContainText('Omborda206 dona');
  await expect(goods).toContainText('Yo‘lda27 dona');
  await expect(goods).toContainText('Sotilgan187 dona');
  const money = page.getByRole('region', { name: 'Pul va aktlar' });
  await expect(money).toContainText('20 080 000');
  await expect(money).toContainText('141 × 140 000 + 46 × 60 000 = 22 500 000');
  await expect(money).toContainText('AS-0001 · 04.01–10.01.2027');
  await expect(page.getByTestId('wholesaler-products').locator('tfoot')).toContainText('206');
  await expect(page.getByTestId('wholesaler-shipments').locator('tbody tr')).toHaveCount(5);
  await page.getByRole('tab', { name: /^Postavkalar/ }).click();
  await expect(page.getByTestId('wholesaler-shipments').locator('tbody tr')).toHaveCount(9);
});

test('TC3: shartnomasiz optovik — «Mahsulot qo‘shish» yopiq (sababi bilan); skan yuklangach ochiladi', async ({ page }) => {
  await openCard(page, '9');
  await expect(page.getByTestId('no-contract-banner')).toContainText('Shartnoma yuklanmagan — mahsulot va postavka yopiq');
  const add = head(page).getByRole('button', { name: /Mahsulot qo‘shish/ });
  await expect(add).toBeDisabled();
  await expect(add).toHaveAccessibleDescription('Shartnoma yuklanmagan — mahsulot va postavka yopiq');
  await expect(head(page).getByRole('button', { name: /Postavka arizasi/ })).toBeDisabled();

  await head(page).getByRole('button', { name: 'Shartnomani yuklash' }).click();
  const dialog = page.getByTestId('contract-dialog');
  await dialog.getByRole('button', { name: 'Shartnomani saqlash' }).click();
  await expect(dialog).toContainText('Shartnoma nusxasini tanlang');
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'barakat-shartnoma.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(dialog).toContainText('barakat-shartnoma.pdf');
  await dialog.getByLabel(/Shartnoma raqami/).fill('K-2027/031');
  await dialog.getByLabel(/Imzolangan sana/).fill('14.01.2027');
  await dialog.getByLabel(/Imzolangan sana/).press('Enter');
  await dialog.getByRole('button', { name: 'Shartnomani saqlash' }).click();
  await expect(toast(page)).toContainText('Shartnoma saqlandi');
  await expect(head(page)).toContainText('Shartnoma imzolangan');
  await expect(head(page).getByRole('button', { name: /Mahsulot qo‘shish/ })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Komissiya shartnomasi' })).toContainText('barakat-shartnoma.pdf');
});

test('TC4: yangi optovik — STIR takror xatosi; saqlangach karta qayta ochilsa STIR va bank rekvizitlari saqlangan', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/wholesalers/new');
  const form = page.getByTestId('wholesaler-form');
  await form.getByRole('button', { name: 'Optovikni saqlash' }).click();
  await expect(form.getByText('Majburiy maydon').first()).toBeVisible();

  await form.getByLabel(/Kompaniya nomi/).fill('Gadget Trade MChJ');
  await form.getByLabel(/^STIR/).fill('307418562');
  await expect(form).toContainText('Bu STIR bilan optovik bor — Namuna Savdo MChJ. Bitta kompaniya ikki marta qo‘shilmaydi.');
  await expect(form.getByRole('link', { name: 'Namuna Savdo MChJ kartasi' })).toHaveAttribute('href', '/admin/wholesalers/7');
  await form.getByLabel(/^STIR/).fill('30512345');
  await form.getByLabel(/Rahbar/).fill('Karimov Akmal');
  await form.getByLabel(/Yuridik manzil/).fill('Toshkent shahri, Mirobod tumani');
  await form.getByLabel(/^Telefon/).fill('901234567');
  await form.getByLabel(/^Bank/).fill('Kapitalbank');
  await form.getByLabel(/^MFO/).fill('011');
  await form.getByLabel(/Hisob raqami/).fill('20208000900123456001');
  await form.getByRole('button', { name: 'Optovikni saqlash' }).click();
  await expect(form).toContainText('STIR 9 ta raqamdan iborat — 8 ta kiritildi.');
  await expect(form).toContainText('MFO 5 ta raqamdan iborat');
  await form.getByLabel(/^STIR/).fill('305123456');
  await form.getByLabel(/^MFO/).fill('01158');
  await form.getByRole('button', { name: 'Optovikni saqlash' }).click();

  await expect(page).toHaveURL(/\/admin\/wholesalers\/10$/);
  await expect(toast(page)).toContainText('Gadget Trade MChJ qo‘shildi');
  await expect(head(page)).toContainText('Shartnoma yo‘q');
  await page.reload();
  const requisites = page.getByRole('region', { name: 'Rekvizitlar' });
  await expect(requisites).toContainText('305123456');
  await expect(requisites).toContainText('Kapitalbank');
  await expect(requisites).toContainText('01158');
  await expect(requisites).toContainText('2020 8000 9001 2345 6001');
  await expect(requisites).toContainText('+998 90 123 45 67');
});

test('rekvizitlarni tahrirlash: faqat o‘zgargan maydon; ro‘yxatda ham yangilanadi', async ({ page }) => {
  await openCard(page, '8');
  await page.getByRole('region', { name: 'Rekvizitlar' }).getByRole('button', { name: 'Tahrirlash' }).click();
  await expect(page).toHaveURL(/\/admin\/wholesalers\/8\/edit$/);
  const form = page.getByTestId('wholesaler-form');
  await form.getByLabel(/^Bank/).fill('Asaka bank');
  await form.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();
  await expect(page).toHaveURL(/\/admin\/wholesalers\/8$/);
  await expect(page.getByRole('region', { name: 'Rekvizitlar' })).toContainText('Asaka bank');
});

test('to‘xtatish: sabab majburiy → banner sabab bilan; faollashtirish', async ({ page }) => {
  await openCard(page, '7', '?dialog=suspend');
  const dialog = page.getByTestId('suspend-dialog');
  await expect(dialog).toContainText('Omborda 206 dona');
  await dialog.getByRole('button', { name: 'To‘xtatish' }).click();
  await expect(dialog).toContainText('Sababni yozing');
  await dialog.getByLabel('Sabab (majburiy)').fill('Optovik iltimosi bilan shartnoma bekor qilindi');
  await dialog.getByRole('button', { name: 'To‘xtatish' }).click();
  await expect(toast(page)).toContainText('Namuna Savdo MChJ to‘xtatildi');
  await expect(page.getByTestId('suspended-banner')).toContainText('Sabab: «Optovik iltimosi bilan shartnoma bekor qilindi»');
  await expect(head(page)).toContainText('Kabinet yopiq');
  await head(page).getByRole('button', { name: 'Faollashtirish' }).click();
  await page.getByTestId('resume-dialog').getByRole('button', { name: 'Faollashtirish' }).click();
  await expect(head(page)).toContainText('Faol');
  await expect(page.getByTestId('suspended-banner')).toHaveCount(0);
});

test('kabinetga taklif (M2) va aktni yuborish', async ({ page }) => {
  await openCard(page, '8');
  await page.getByRole('region', { name: 'Kabinet' }).getByRole('button', { name: 'Kabinetga taklif' }).click();
  const invite = page.getByTestId('invite-dialog');
  await expect(invite).toContainText('+998 90 111 22 33');
  await invite.getByRole('button', { name: 'Taklif yuborish' }).click();
  await expect(toast(page)).toContainText('SMS +998 90 111 22 33 raqamiga ketdi.');
  await expect(page.getByRole('region', { name: 'Kabinet' })).toContainText('Taklif yuborildi');

  await page.goto('/admin/wholesalers/7');
  await head(page).getByRole('button', { name: 'Aktni yuborish' }).click();
  const act = page.getByTestId('act-dialog');
  await act.getByText('Qabul akti P-0098').click();
  await act.getByRole('button', { name: 'Yuborish' }).click();
  await expect(toast(page)).toContainText('P-0098 Namuna Savdo MChJ kabinetida.');
});

test('yorliqlar: qoldiq, qaytgan va brak (akt yuborish), pul va aktlar, hujjatlar, tarix', async ({ page }) => {
  await openCard(page, '7', '?tab=stock');
  const stock = page.getByTestId('wholesaler-stock');
  await expect(stock.locator('tbody tr')).toHaveCount(4);
  await expect(stock.locator('tfoot')).toContainText('206');
  await expect(stock.locator('tfoot')).toContainText('191');

  await page.getByRole('tab', { name: 'Qaytgan va brak' }).click();
  const acts = page.getByTestId('wholesaler-acts');
  await expect(acts.locator('tbody tr')).toHaveCount(3);
  await acts.locator('tr', { hasText: 'Brak akti BA-0041' }).getByRole('button', { name: 'Yuborish' }).click();
  const dialog = page.getByTestId('act-dialog');
  await expect(dialog.getByRole('radio', { name: /Brak akti BA-0041/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Yuborish' }).click();
  await expect(toast(page)).toContainText('BA-0041 Namuna Savdo MChJ kabinetida.');
  await expect(acts.locator('tr', { hasText: 'Brak akti BA-0041' })).toContainText('yuborildi');

  await page.getByRole('tab', { name: 'Pul va aktlar' }).click();
  await expect(page.getByTestId('wholesaler-settlements')).toContainText('AS-0001');
  await expect(page.getByTestId('wholesaler-settlements')).toContainText('Tayyor');

  await page.getByRole('tab', { name: 'Hujjatlar' }).click();
  const documents = page.getByTestId('wholesaler-documents');
  await expect(documents).toContainText('shartnoma-skan.pdf');
  await expect(documents).toContainText('Elektron shartnoma');
  await expect(documents).toContainText('Muvofiqlik sertifikati.pdf');

  await page.getByRole('tab', { name: 'Tarix' }).click();
  const history = page.getByTestId('wholesaler-history');
  await expect(history).toContainText('Akt yuborildi: BA-0041');
  await expect(history).toContainText('Shartnoma yuklandi: № K-2027/014');
  await expect(history).toContainText('Kabinetga taklif yuborildi: +998 99 214 36 58');
  await expect(history).toContainText('Optovik kiritildi');
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shartnomasiz: «⋮» varag‘ida o‘chiq bandlar sababi bilan; asosiy amal pastki panelda', async ({ page }) => {
    await openCard(page, '9');
    await expect(page.getByRole('button', { name: 'Shartnomani yuklash' }).last()).toBeVisible();
    await head(page).getByRole('button', { name: 'Boshqa amallar' }).click();
    const sheet = page.getByRole('dialog', { name: 'Barakat Uy Jihozlari MChJ' });
    await expect(sheet.getByRole('menuitem', { name: 'Mahsulot qo‘shish' })).toHaveAttribute('aria-disabled', 'true');
    await expect(sheet).toContainText('Shartnoma yuklanmagan — mahsulot va postavka yopiq');
  });
});
