import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-17 (ombor-yigish, ombor-qadoq, ombor-topshirish, hujjat-yigish-varaqasi; BE-19): omborchi bugungi to'lqinni
 * skaner bilan yig'adi, yorliqni chop etib qadoqlaydi va posilkalarni QR bilan Elchi aktiga topshiradi.
 * TC1 — boshqa SKU → qizil ogohlantirish, keyingi qadam yopiq; TC2 — yorliq trek, QR, tasdiqlangan manzil bilan;
 * TC3 — aktdagi son = ekrandagi son; TC4 — 14:00 dan keyin tasdiqlangan buyurtma ertangi ro'yxatda.
 * Mock: L-1240 (Simsiz quloqchinlar, 4780012345677; Xorazm) — navbat boshida (vazifa ID tartibida); 7 ta posilka bugun qadoqlangan.
 */
const HEADPHONES = '4780012345677';
const KETTLE = '4780012345691';

async function openWarehouse(page: Page, path: string) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000005');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/warehouse/);
  await page.goto(path);
}

async function scan(page: Page, code: string) {
  await page.getByTestId('scan-field').fill(code);
  await page.getByTestId('scan-field').press('Enter');
}

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

test('TC1: boshqa tovar — qizil ogohlantirish, «Qadoqqa o‘tish» yopiq; to‘g‘ri tovar — ochiladi', async ({ page }) => {
  await openWarehouse(page, '/warehouse/picking');
  const parcel = page.getByTestId('pick-parcel');
  await expect(parcel).toContainText('L-1240');
  const toPack = page.getByRole('button', { name: 'Qadoqqa o‘tish' });
  await expect(toPack).toBeDisabled();

  await scan(page, KETTLE);
  const wrong = page.getByTestId('wrong-item');
  await expect(wrong).toContainText('Boshqa tovar skanerlandi — bu posilkada yo‘q');
  await expect(wrong).toContainText('Elektr choynakni B-02-2 ga qaytaring va B-02-1 dan Simsiz quloqchinlarni oling.');
  await expect(wrong).toContainText(KETTLE);
  await expect(wrong).toContainText('Elektr choynak');
  await expect(wrong).toContainText('Simsiz quloqchinlar');
  await expect(page.getByTestId('scan-field')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('scan-field')).toHaveAttribute('placeholder', 'To‘g‘ri tovarni skanerlang');
  await expect(toPack).toBeDisabled();
  await expect(parcel).toHaveAttribute('data-status', 'TO_PICK');

  await scan(page, HEADPHONES);
  await expect(page.getByTestId('wrong-item')).toHaveCount(0);
  await expect(page.getByTestId('right-item')).toContainText('To‘g‘ri tovar — Simsiz quloqchinlar');
  await expect(parcel).toHaveAttribute('data-status', 'PICKED');
  await expect(toPack).toBeEnabled();
  await toPack.click();
  await expect(page).toHaveURL(/tab=pack/);
  await expect(page.getByTestId('pack-parcel')).toContainText('L-1240');
});

test('TC2: yorliq — trek, QR va tasdiqlangan manzil; chop etilmaguncha «Qadoqlandi» yopiq', async ({ page }) => {
  await openWarehouse(page, '/warehouse/picking');
  await scan(page, HEADPHONES);
  await page.getByRole('button', { name: 'Qadoqqa o‘tish' }).click();

  const parcel = page.getByTestId('pack-parcel');
  await expect(parcel).toContainText('Xorazm viloyati, Urganch shahri');
  // Yorliq ko'rinishi: trek, QR va tasdiqlangan manzil — chop etiladigan PDF bilan bir xil ma'lumot.
  const preview = page.getByTestId('label-preview');
  await expect(preview).toContainText('6240');
  await expect(preview).toContainText('Xorazm viloyati, Urganch shahri — tuman markazidan oladi');
  await expect(preview.locator('svg').first()).toBeVisible();
  const packed = parcel.getByRole('button', { name: 'Qadoqlandi' });
  await expect(packed).toBeDisabled();

  await parcel.getByRole('button', { name: 'Yorliqni chop etish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yorliqni chop etish — L-1240' });
  await expect(dialog.getByTestId('print-preview')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'PDF yuklab olish' }).click()]);
  expect(download.suggestedFilename()).toBe('yorliq-L-1240.pdf');
  const pdf = await readFile(await download.path(), 'latin1');
  expect(pdf).toContain('Trek: 6240');
  expect(pdf).toContain('QR: QR-1240');
  expect(pdf).toContain('Xorazm viloyati, Urganch shahri');
  await dialog.getByRole('button', { name: 'Yopish' }).click();

  await expect(packed).toBeEnabled();
  await packed.click();
  await expect(page.getByText('L-1240 qadoqlandi')).toBeVisible();
  await expect(page.getByTestId('packed-today')).toContainText('Bugun qadoqlangan · 8');
});

test('TC3: topshirish — takror va qadoqlanmagan aktga kirmaydi; aktdagi son = ekrandagi son', async ({ page }) => {
  await openWarehouse(page, '/warehouse/handover');
  await expect(page.getByTestId('act-count')).toContainText('0');
  const finish = page.getByRole('button', { name: /^Aktni yakunlash/ });
  await expect(finish).toBeDisabled();

  for (const code of ['QR-1188', 'QR-1209', 'L-1217']) await scan(page, code);
  await expect(page.getByTestId('handover-notice')).toContainText('Aktga qo‘shildi — 3-posilka');
  await scan(page, 'QR-1188');
  await expect(page.getByTestId('handover-notice')).toContainText('Takroriy skan');
  await scan(page, 'QR-1276');
  await expect(page.getByTestId('handover-notice')).toContainText('Posilka qadoqlanmagan');
  await scan(page, KETTLE);
  await expect(page.getByTestId('handover-notice')).toContainText('Elektr choynak');
  // Jurnalda oxirgi 5 ta; jami — sarlavhada.
  await expect(page.getByTestId('handover-journal').locator('li')).toHaveCount(5);
  await expect(page.getByText('6 ta skan')).toBeVisible();

  await expect(page.getByTestId('act-count')).toContainText('3');
  await expect(finish).toHaveAccessibleName('Aktni yakunlash: 3 posilka');
  // Sahifa yangilansa ham ochiq akt saqlanadi.
  await page.reload();
  await expect(page.getByTestId('act-count')).toContainText('3');

  await page.getByRole('button', { name: /^Aktni yakunlash/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Topshirish akti № 231 — chop etish' });
  await expect(dialog).toContainText('3 posilka');
  await expect(dialog.getByTestId('print-preview')).toBeVisible();
  await expect(page.getByText('Akt № 231 yakunlandi — 3 posilka')).toBeVisible();
  await dialog.getByRole('button', { name: 'Yopish' }).click();
  await expect(page.getByTestId('act-card')).toContainText('№ 231');
  await expect(page.getByTestId('previous-acts')).toContainText('231');
});

test('TC4: 14:00 dan keyin tasdiqlangan — bugungi to‘lqinda yo‘q, «Ertaga» ro‘yxatida bor', async ({ page }) => {
  await openWarehouse(page, '/warehouse/picking');
  const list = page.getByTestId('parcel-list');
  await expect(list).toContainText('L-1276');
  await expect(list).not.toContainText('L-1245');
  await expect(page.getByTestId('wave-packed')).toContainText('7 / 12');

  await page.getByRole('tab', { name: /Ertaga/ }).click();
  await expect(page).toHaveURL(/day=tomorrow/);
  await expect(page.getByTestId('picking-page')).toHaveAttribute('data-day', 'tomorrow');
  // Ertangi to'lqin faqat ko'rinadi: «yig'ilmoqda» posilka yo'q.
  await expect(page.getByTestId('wave-packed')).toContainText('0 / 3');
  await expect(page.getByTestId('wave-card')).toContainText('Navbatda 3');
  for (const order of ['L-1232', 'L-1245', 'L-1284']) await expect(list).toContainText(order);
  await expect(list).not.toContainText('L-1276');
  await expect(page.getByTestId('pick-parcel')).toHaveCount(0);
});

test('yig‘ish varaqasi: yacheyka tartibida hali yig‘ilmagan dona, posilkalarga taqsimlab', async ({ page }) => {
  await openWarehouse(page, '/warehouse/picking');
  const [sheetPage] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('link', { name: 'Chop etish' }).click()]);
  await expect(sheetPage).toHaveURL(/\/warehouse\/pick-sheet\?date=\d{4}-\d{2}-\d{2}/);
  const sheet = sheetPage.getByTestId('pick-sheet');
  await expect(sheet).toContainText('Yig‘ish varaqasi');
  await expect(sheet).toContainText('Bugungi to‘lqin · yacheyka tartibida · 3 yacheyka, 5 posilka');
  await expect(sheetPage.getByTestId('sheet-totals')).toHaveText('5 / 5');
  await expect(sheetPage.getByTestId('sheet-take').locator('tbody tr')).toHaveText([/A-01-3.*Oshxona tarozisi.*1 dona/, /B-02-1.*Simsiz quloqchinlar.*3 dona/, /B-02-2.*Elektr choynak.*1 dona/]);
  await expect(sheetPage.getByTestId('sheet-split')).toContainText('Simsiz quloqchinlar · 3 posilka');
  await expect(sheet).toHaveAttribute('data-pages', '1');
  await expect(sheet).toContainText('1 / 1 bet');
});

test('telefon: skan bloki tepada, «Qadoqqa o‘tish» pastki panelda, gorizontal aylantirish yo‘q', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWarehouse(page, '/warehouse/picking');
  await scan(page, KETTLE);
  await expect(page.getByTestId('wrong-item')).toBeVisible();
  // Kartadagi tugma telefonda yashirin — ko'rinadigani pastki paneldagi bitta tugma.
  const toPack = page.getByRole('button', { name: 'Qadoqqa o‘tish' });
  await expect(toPack).toHaveCount(1);
  await expect(toPack).toBeDisabled();
  const scanBox = await page.getByTestId('scan-field').boundingBox();
  const parcelBox = await page.getByTestId('pick-parcel').boundingBox();
  expect(scanBox?.y ?? Infinity).toBeLessThan(parcelBox?.y ?? 0);
  await scan(page, HEADPHONES);
  await expect(toPack).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
