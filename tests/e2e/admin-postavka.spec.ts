import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-16 (admin-postavka): Optoviklar → «Postavkalar» — optovik nomidan e'lon (TC1 ning birinchi qadami),
 * shartnomasiz optovik va tasdiqlanmagan mahsulot, forma xatolari, ro'yxat (holat tablari, qidiruv),
 * bekor qilish (faqat «E'lon qilindi»), postavka tafsiloti va telefon kartalari.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function openShipments(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await page.goto('/admin/wholesalers');
  await expect(page.getByTestId('declare-form')).toBeVisible();
}

const row = (page: Page, id: string) => page.locator(`tr[data-shipment-id="${id}"]`);
const form = (page: Page) => page.getByTestId('declare-form');

async function pickProduct(page: Page, name: string) {
  await form(page).getByRole('combobox', { name: /Mahsulot/ }).last().click();
  await page.locator('[role="option"]:visible', { hasText: name }).click();
  // Ro'yxat yopilishini kutamiz: keyingi qatorning ro'yxati bilan bir vaqtda ko'rinmasin.
  await expect(page.locator('[role="listbox"]:visible')).toHaveCount(0);
}

test('TC1 (admin): optovik nomidan 100 dona e’lon — ro‘yxat tepasida «E’lon qilindi», omborchi ko‘radi', async ({ page }) => {
  await openShipments(page);
  await expect(page.getByTestId('wholesaler-summary')).toContainText('3 postavka · 210 dona');
  await pickProduct(page, 'Simsiz quloqchinlar');
  await expect(form(page)).toContainText('4780012345677 · omborda 128, sotuvga tayyor 120 · yaroqlilik muddati kuzatilmaydi');
  await form(page).getByLabel(/Miqdor/).fill('100');
  await form(page).getByRole('button', { name: 'Arizani saqlash' }).click();

  await expect(page.getByText('P-0114 e’lon qilindi')).toBeVisible();
  await expect(row(page, '114')).toHaveAttribute('data-new', 'true');
  await expect(row(page, '114')).toContainText('Simsiz quloqchinlar');
  await expect(row(page, '114')).toContainText('E’lon qilindi');
  await expect(row(page, '114')).toContainText('admin, nomidan');
  await expect(page.getByTestId('wholesaler-summary')).toContainText('4 postavka · 310 dona');
  const created = db.inbound.shipments.find((item) => item.id === '114');
  expect(created).toMatchObject({ status: 'DECLARED', declared: 100, createdBy: { role: 'ADMIN' } });
});

test('ikki qator — ikki postavka; xatolar: mahsulot, miqdor, takror mahsulot', async ({ page }) => {
  await openShipments(page);
  await form(page).getByRole('button', { name: 'Arizani saqlash' }).click();
  await expect(form(page)).toContainText('Mahsulotni tanlang');
  await expect(form(page)).toContainText('Miqdor 1 dan 100 000 gacha');

  await pickProduct(page, 'Oshxona tarozisi');
  await form(page).getByLabel(/Miqdor/).first().fill('10');
  await form(page).getByRole('button', { name: 'Yana mahsulot qo‘shish' }).click();
  await pickProduct(page, 'Oshxona tarozisi');
  await form(page).getByLabel(/Miqdor/).last().fill('5');
  await form(page).getByRole('button', { name: 'Arizani saqlash' }).click();
  await expect(form(page)).toContainText('Bu mahsulot arizada bor');

  await pickProduct(page, 'Elektr choynak');
  await form(page).getByRole('button', { name: 'Arizani saqlash' }).click();
  await expect(page.getByText('P-0114, P-0115 e’lon qilindi')).toBeVisible();
  await expect(row(page, '114')).toContainText('Oshxona tarozisi');
  await expect(row(page, '115')).toContainText('Elektr choynak');
});

test('shartnomasiz optovik — xato, mahsulot qatori o‘chiq; tasdiqlanmagan mahsulot tanlanmaydi', async ({ page }) => {
  await openShipments(page);
  await form(page).getByRole('combobox', { name: /Mahsulot/ }).click();
  const dazmol = page.getByRole('option', { name: /Bug‘li dazmol/ });
  await expect(dazmol).toHaveAttribute('aria-disabled', 'true');
  await expect(dazmol).toContainText('Ko‘rib chiqilmoqda');
  await page.keyboard.press('Escape');

  await form(page).getByRole('combobox', { name: /Optovik/ }).selectOption({ label: 'Barakat Uy Jihozlari MChJ · STIR 305112847' });
  await expect(form(page)).toContainText('Shartnoma yuklanmagan — bu optovik uchun ariza kiritib bo‘lmaydi.');
  await expect(form(page).getByRole('combobox', { name: /Mahsulot/ })).toBeDisabled();
  await expect(form(page).getByRole('button', { name: 'Arizani saqlash' })).toBeDisabled();
});

test('ro‘yxat: holat tablari, qidiruv, kiritdi filtri; bekor qilish faqat «E’lon qilindi»', async ({ page }) => {
  await openShipments(page);
  const list = page.getByTestId('shipment-list');
  await expect(list.getByRole('tab', { name: /Hammasi/ })).toContainText('9');
  await list.getByRole('tab', { name: /Farq bor/ }).click();
  await expect(list.locator('tbody tr')).toHaveCount(1);
  await expect(row(page, '98')).toContainText('63');
  await list.getByRole('tab', { name: /Hammasi/ }).click();
  await list.getByRole('searchbox').fill('P-0110');
  await expect(list.locator('tbody tr')).toHaveCount(1);
  await list.getByRole('searchbox').fill('');
  await list.getByLabel('Kiritdi:').selectOption({ label: 'Xodim (nomidan)' });
  await expect(list.locator('tbody tr')).toHaveCount(5);
  await list.getByLabel('Kiritdi:').selectOption({ label: 'Barchasi' });

  // Qabuli boshlangan P-0112 — bekor qilinmaydi.
  await page.getByRole('button', { name: 'P-0112 amallari' }).click();
  await expect(page.locator('li[role="menuitem"]:visible', { hasText: 'Arizani bekor qilish' })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('li[role="menuitem"]:visible')).toHaveCount(0);

  await page.getByRole('button', { name: 'P-0111 amallari' }).click();
  await page.locator('li[role="menuitem"]:visible', { hasText: 'Arizani bekor qilish' }).click();
  const dialog = page.getByTestId('cancel-shipment');
  await expect(dialog).toContainText('Oshxona tarozisi · 50 dona');
  await expect(dialog.getByRole('button', { name: 'Arizani bekor qilish' })).toBeDisabled();
  await dialog.getByRole('combobox', { name: /Sabab/ }).selectOption({ label: 'Xato kiritildi' });
  await dialog.getByRole('button', { name: 'Arizani bekor qilish' }).click();
  await expect(page.getByText('P-0111 bekor qilindi')).toBeVisible();
  await expect(row(page, '111')).toContainText('Bekor qilindi');
  await expect(list.getByRole('tab', { name: /Bekor qilindi/ })).toContainText('1');
});

test('tafsilot: qabul akti — yo‘l, sonlar, omborchi izohi va PDF', async ({ page }) => {
  await openShipments(page);
  await row(page, '98').click();
  await expect(page).toHaveURL(/\/admin\/wholesalers\/shipments\/98$/);
  const detail = page.getByTestId('admin-shipment');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('P-0098');
  await expect(detail).toContainText('Qabul akti · P-0098');
  await expect(detail).toContainText('farq bor');
  await expect(detail).toContainText('Ariza kiritildi');
  await expect(detail).toContainText('«2 ta shishaning qopqog‘i singan»');
  await expect(detail.getByRole('link', { name: 'PDF' })).toHaveAttribute('href', '/inbound-acts/98');
});

test('telefon: kartalar va filtr varag‘i', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openShipments(page);
  const list = page.getByTestId('shipment-list');
  await expect(list).toContainText('9 ta · hamma optovik');
  await expect(list.getByRole('link', { name: /P-0113, Bolalar termos shishasi, Yo‘lda/ })).toContainText('60 dona');
  await expect(list.getByRole('link', { name: /P-0098/ })).toContainText('Qabul 61 · brak 2 · qabul akti PDF');
  await list.getByRole('button', { name: 'Filtrlar' }).click();
  await page.getByRole('combobox', { name: /Kiritdi/ }).selectOption({ label: 'Optovik (kabinetda)' });
  await page.getByRole('button', { name: /tasini ko‘rsatish/ }).click();
  await expect(list.getByRole('link')).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
