import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { addDays, tashkentDate } from '../../src/shared/lib/tashkentTime';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-16 (ombor-qabul, hujjat-qabul-akti; BE-17): omborchi postavkani skaner bilan qabul qiladi. Sanoq brauzerda,
 * «Qabulni yakunlash» bitta `receive` so'rovi bilan yuboriladi.
 * TC1 — admin e'lon qilgan 100 dona: 98 qabul + 2 brak → farq akti (PDF), sonlar tizim bilan mos;
 * TC2 — noma'lum shtrix-kod → ogohlantirish; TC3 — bir xil skan tez 2 marta → bitta;
 * TC4 — muddatiga 50 kun qolgan partiya «Sotuvdan chiqarilgan», qoldiqda, lekin «mavjud»ga qo'shilmaydi.
 * Skaner klaviatura emulyatsiyasi: kod maydonga yoziladi va Enter.
 */
const QUL = '4780012345677';
const VITAMIN = '4780012345714';

async function login(page: Page, phone: string, home: RegExp) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(home);
}

const openWarehouse = (page: Page) => login(page, '900000005', /\/warehouse/);
const accepted = (page: Page) => page.locator('[data-count="accepted"] dd');

/** Bir xil kodni ketma-ket sanash uchun vaqt oldinga suriladi (takror oralig'i 1 s). */
async function scanMany(page: Page, code: string, times: number, clock: { now: number }) {
  const field = page.getByTestId('scan-field');
  for (let index = 0; index < times; index += 1) {
    clock.now += 1_100;
    await page.clock.setFixedTime(clock.now);
    await field.fill(code);
    await field.press('Enter');
  }
}

async function scan(page: Page, code: string) {
  await page.getByTestId('scan-field').fill(code);
  await page.getByTestId('scan-field').press('Enter');
}

/** Shu qurilmada boshlangan P-0112 qabuli (ombor-qabul namunasi): 98 qabul, 2 brak, jurnal — 102 ta skan. */
async function seedP0112(context: BrowserContext) {
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const entry = (key: string, minutes: number, kind: string, total: number | null, barcode = QUL) => ({
    key, at: at(minutes), barcode, kind, itemId: kind === 'UNKNOWN' ? null : '1121', total, productName: kind === 'UNKNOWN' ? null : 'Simsiz quloqchinlar', otherShipment: null,
  });
  const draft = {
    shipmentId: '112', startedAt: at(45), counts: { 1121: { accepted: 98, defect: 2 } }, lots: {}, cells: {}, note: '', journalTotal: 102,
    journal: [entry('s5', 0.4, 'ACCEPTED', 98), entry('s4', 1.2, 'UNKNOWN', null, '4600000017822'), entry('s3', 1.5, 'ACCEPTED', 97), entry('s2', 3, 'DEFECT', 2), entry('s1', 32, 'DEFECT', 1)],
  };
  await context.addInitScript(({ key, value }) => {
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
  }, { key: 'elchi.inbound.receiving.112', value: JSON.stringify(draft) });
}

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

test('TC1: admin 100 dona e’lon qildi → omborchi 98 qabul, 2 brak → farq akti PDF, sonlar mos', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await login(page, '900000007', /\/admin\/moderation$/);
  await page.goto('/admin/wholesalers');
  const form = page.getByTestId('declare-form');
  await form.getByRole('combobox', { name: /Mahsulot/ }).click();
  await page.locator('[role="option"]:visible', { hasText: 'Simsiz quloqchinlar' }).click();
  await form.getByLabel(/Miqdor/).fill('100');
  await form.getByRole('button', { name: 'Arizani saqlash' }).click();
  await expect(page.getByText('P-0114 e’lon qilindi')).toBeVisible();

  // Omborchi — alohida brauzer konteksti, mock baza o'sha.
  const warehouse: BrowserContext = await browser.newContext({ acceptDownloads: true });
  await installMockApi(warehouse, { reset: false });
  const wh = await warehouse.newPage();
  const clock = { now: Date.now() };
  await wh.clock.setFixedTime(clock.now);
  await openWarehouse(wh);
  await expect(wh.getByTestId('inbound-page')).toHaveAttribute('data-view', 'list');
  await wh.getByTestId('awaiting-list').getByRole('button', { name: 'P-0114 qabulini boshlash' }).click();
  await expect(wh.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '114');

  await scanMany(wh, QUL, 98, clock);
  for (let index = 0; index < 2; index += 1) {
    await wh.getByRole('radio', { name: 'Brak' }).click();
    await expect(wh.getByRole('radio', { name: 'Brak' })).toHaveAttribute('aria-checked', 'true');
    await scanMany(wh, QUL, 1, clock);
    // Brakdan keyin keyingi skan yana «Qabul».
    await expect(wh.getByRole('radio', { name: 'Qabul' })).toHaveAttribute('aria-checked', 'true');
  }
  await expect(wh.getByTestId('receiving-counted')).toHaveText('100 / 100');
  await expect(accepted(wh)).toHaveText('98');
  await expect(wh.locator('[data-count="defect"] dd')).toHaveText('2');
  await expect(wh.getByTestId('act-card')).toContainText('−2');
  // Hali serverga yuborilmagan — sanoq brauzerda.
  expect(db.inbound.shipments.find((item) => item.id === '114')?.status).toBe('DECLARED');

  await wh.getByTestId('act-card').getByLabel('Aktga izoh').fill('2 ta qutida quloqchin korpusi singan');
  await wh.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' }).click();
  const finish = wh.getByTestId('finish-dialog');
  await expect(finish).toContainText('98 dona → B-02-1');
  await expect(finish).toContainText('Farq bor');
  await finish.getByRole('button', { name: 'Yakunlash va akt tuzish' }).click();
  await expect(wh.getByText('P-0114 yakunlandi')).toBeVisible();
  await expect(wh.getByTestId('inbound-page')).toHaveAttribute('data-view', 'list');
  await expect(wh.getByTestId('done-list').locator('tr[data-shipment-id="114"]')).toContainText('100 · 98 · 2');

  // BE-17 `receive`: kelgan 100 (brak bilan), brak 2, yacheyka; holat — «Farq bor».
  const saved = db.inbound.shipments.find((item) => item.id === '114');
  expect(saved).toMatchObject({ status: 'DISCREPANCY', receiveComment: '2 ta qutida quloqchin korpusi singan', items: [{ receivedQty: 100, defectiveQty: 2, cell: 'B-02-1' }] });
  expect(await wh.evaluate(() => window.localStorage.getItem('elchi.inbound.receiving.114'))).toBeNull();
  await expect(wh.getByTestId('done-list').locator('tr[data-shipment-id="114"]').getByRole('link', { name: 'PDF' })).toHaveAttribute('href', '/inbound-acts/114');

  // Akt: toastdagi «Aktni ochish» — yangi tabda A4 sahifa; sonlar postavkadagi bilan bir xil; PDF — serverdan.
  const [act] = await Promise.all([warehouse.waitForEvent('page'), wh.getByRole('button', { name: 'Aktni ochish' }).click()]);
  await expect(act).toHaveURL(/\/inbound-acts\/114$/);
  const sheet = act.getByTestId('inbound-act');
  await expect(sheet).toContainText('P-0114');
  await expect(act.getByTestId('act-status')).toHaveText('FARQ BOR');
  await expect(sheet.locator('tfoot td')).toHaveText(['Jami', '100', '98', '2', '−2']);
  await expect(sheet).toContainText('Farq: −2 dona — hammasi brak');
  await expect(sheet).toContainText('Yuz dona e’lon qilingan, to‘qson sakkiz dona qabul qilingan, ikki dona brak.');
  await expect(sheet).toContainText('«2 ta qutida quloqchin korpusi singan»');
  await expect(act.getByRole('button', { name: 'Chop etish' })).toBeVisible();
  const [download] = await Promise.all([act.waitForEvent('download'), act.getByRole('button', { name: 'PDF yuklab olish' }).click()]);
  expect(download.suggestedFilename()).toBe('qabul-akti-P-0114.pdf');
  await warehouse.close();
});

test('TC2: noma’lum shtrix-kod — maydon qizil, ogohlantirish, jurnalda «Yozilmadi», son o‘zgarmaydi', async ({ page, context }) => {
  await seedP0112(context);
  await openWarehouse(page);
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '112');
  await expect(accepted(page)).toHaveText('98');
  await scan(page, '4600000017899');
  const problem = page.getByTestId('scan-problem');
  await expect(problem).toContainText('Noma’lum kod — yozilmadi');
  await expect(problem).toContainText('4600000017899 bu postavkada ham, kutilayotgan postavkalarda ham yo‘q. Qabul soni o‘zgarmadi: 98.');
  await expect(page.getByTestId('scan-field')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('scan-journal').locator('li').first()).toContainText('Yozilmadi');
  await expect(accepted(page)).toHaveText('98');

  // Boshqa kutilayotgan postavkaning mahsuloti — qaysi postavka ekani aytiladi.
  await scan(page, '4780012345684');
  await expect(problem).toContainText('Boshqa mahsulot — yozilmadi');
  await expect(problem).toContainText('Oshxona tarozisi, P-0111 postavkasiniki, bu postavkada yo‘q');

  // Keyingi to'g'ri skan — ogohlantirish yo'qoladi, son ortadi.
  await page.waitForTimeout(1_050);
  await scan(page, QUL);
  await expect(problem).toBeHidden();
  await expect(accepted(page)).toHaveText('99');
});

test('TC3: bir xil skan ikki marta tez — bitta hisoblanadi, jurnalda «Takroriy skan»', async ({ page }) => {
  const clock = { now: Date.now() };
  await page.clock.setFixedTime(clock.now);
  await openWarehouse(page);
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-view', 'list');
  // Birinchi skan — mos postavka (P-0112) qabuli o'zi ochiladi va shu skan yoziladi.
  await scan(page, QUL);
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '112');
  await expect(accepted(page)).toHaveText('1');
  // 300 ms dan keyin xuddi shu kod — takror.
  clock.now += 300;
  await page.clock.setFixedTime(clock.now);
  await scan(page, QUL);
  await expect(page.getByTestId('scan-duplicate')).toContainText('Takroriy skan — bitta hisoblandi');
  await expect(accepted(page)).toHaveText('1');
  await expect(page.getByTestId('scan-journal').locator('li').first()).toContainText('Takroriy skan');
  // Oraliqdan keyin — yangi tovar. Sanoq shu qurilmada saqlanadi.
  await scanMany(page, QUL, 1, clock);
  await expect(accepted(page)).toHaveText('2');
  const draft = await page.evaluate(() => JSON.parse(window.localStorage.getItem('elchi.inbound.receiving.112') ?? '{}') as { counts?: unknown; journalTotal?: number });
  expect(draft).toMatchObject({ counts: { 1121: { accepted: 2, defect: 0 } }, journalTotal: 3 });
});

test('TC4: muddatiga 50 kun qolgan partiya — «Sotuvdan chiqarilgan», qoldiqqa kiradi, «mavjud»ga kirmaydi', async ({ page }) => {
  test.setTimeout(90_000);
  const today = tashkentDate();
  await openWarehouse(page);
  // Arizasiz yuk: omborchi optovik nomidan ochadi (karta: WAREHOUSE ham DECLARED ochadi).
  await page.getByTestId('awaiting-list').getByRole('button', { name: 'Arizasiz postavka' }).click();
  const undeclared = page.getByTestId('undeclared-dialog');
  await undeclared.getByRole('combobox', { name: /Optovik/ }).selectOption({ label: 'Namuna Farm MChJ' });
  await undeclared.getByRole('combobox', { name: /Mahsulot/ }).selectOption({ label: 'Vitamin kompleksi' });
  await undeclared.getByLabel(/Taxminiy miqdor/).fill('4');
  await undeclared.getByLabel('Yuk xati raqami').fill('YX-118');
  await undeclared.getByRole('button', { name: 'Arizani saqlash' }).click();
  await expect(page.getByText('P-0114 e’lon qilindi')).toBeVisible();
  expect(db.inbound.shipments.find((item) => item.id === '114')).toMatchObject({ wholesalerId: '8', declaredByRole: 'WAREHOUSE', note: 'Yuk xati: YX-118.' });
  await page.getByTestId('awaiting-list').getByRole('button', { name: 'P-0114 qabulini boshlash' }).click();
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '114');

  // Birinchi skan — partiya va muddat so'raladi.
  const clock = { now: Date.now() };
  await page.clock.setFixedTime(clock.now);
  await scan(page, VITAMIN);
  const lot = page.getByTestId('lot-dialog');
  await expect(lot).toContainText('Vitamin kompleksi · birinchi skan');
  await lot.getByRole('button', { name: 'Saqlash' }).click();
  await expect(lot).toContainText('Muddatni kiriting: bu toifadagi tovar faqat muddat bilan qabul qilinadi.');
  await lot.getByLabel(/Yaroqlilik muddati/).fill(addDays(today, 50).split('-').reverse().join('.'));
  await expect(lot).toContainText('50 kun qoladi — partiya sotuvga chiqmaydi');
  await expect(lot).toContainText('Qoldiqqa kiradi, sotuvga chiqmaydi');
  await lot.getByRole('button', { name: 'Saqlash' }).click();
  await expect(lot).toBeHidden();
  await expect(accepted(page)).toHaveText('1');
  await scanMany(page, VITAMIN, 3, clock);
  await expect(page.getByTestId('receiving-counted')).toHaveText('4 / 4');
  const facts = page.getByTestId('receiving-facts');
  await expect(facts).toContainText('P-0114-1');
  await expect(facts).toContainText('50 kun · Sotuvdan chiqarilgan');
  await expect(page.getByTestId('lot-blocked')).toContainText('P-0114-1 sotuvga chiqmaydi');

  // Yangi SKU — yacheyka qoldiqda yo'q: yakunlashda so'raladi.
  await page.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' }).click();
  const finish = page.getByTestId('finish-dialog');
  await expect(finish).toContainText('Farq yo‘q');
  await finish.getByRole('button', { name: 'Yakunlash', exact: true }).click();
  await expect(finish).toContainText('Yacheykani kiriting');
  await finish.getByLabel('Vitamin kompleksi — yacheyka').fill('c-03-2');
  await finish.getByRole('button', { name: 'Yakunlash', exact: true }).click();
  await expect(page.getByText('P-0114 yakunlandi')).toBeVisible();

  // Qoldiq: 4 dona omborda, partiya sotuvdan chiqarilgan — «mavjud» 0.
  expect(db.inbound.shipments.find((item) => item.id === '114')?.items[0]).toMatchObject({ receivedQty: 4, defectiveQty: 0, batch: 'P-0114-1', expiryDate: addDays(today, 50), cell: 'C-03-2' });
  expect(db.inbound.skus.find((item) => item.variantId === '51101')).toMatchObject({ onHand: 4, cell: 'C-03-2' });
  expect(db.inbound.lots).toEqual([expect.objectContaining({ variantId: '51101', quantity: 4, expiryDate: addDays(today, 50) })]);
});

test('oxirgi skanni bekor qilish; arizasiz postavka — kutilayotgan postavka taklifi', async ({ page, context }) => {
  await seedP0112(context);
  await openWarehouse(page);
  await page.getByRole('button', { name: 'Oxirgi skanni bekor qilish' }).click();
  const undo = page.getByTestId('undo-scan');
  await expect(undo).toContainText('98 → 97');
  await expect(undo).toContainText('100 / 100 → 99 / 100');
  await undo.getByRole('button', { name: 'Skanni bekor qilish' }).click();
  await expect(page.getByText('Skan bekor qilindi')).toBeVisible();
  await expect(accepted(page)).toHaveText('97');
  await expect(page.getByTestId('receiving-counted')).toHaveText('99 / 100');
  // Keyingi bekor qilish — noma'lum kod emas, undan oldingi hisoblangan skan («Qabul 97»).
  await page.getByRole('button', { name: 'Oxirgi skanni bekor qilish' }).click();
  await expect(undo).toContainText('97 → 96');
  await undo.getByRole('button', { name: 'Ortga' }).click();

  await page.getByTestId('queue-card').getByRole('button', { name: 'Arizasiz postavka' }).click();
  const undeclared = page.getByTestId('undeclared-dialog');
  await undeclared.getByRole('combobox', { name: /Mahsulot/ }).selectOption({ label: 'Bolalar termos shishasi' });
  await expect(undeclared.getByTestId('undeclared-expected')).toContainText('Bu mahsulot kutilmoqda: P-0113 · 60 dona · Yo‘lda');
  await undeclared.getByRole('button', { name: 'P-0113 qabulini boshlash' }).click();
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '113');
});

test('aloqa uzildi: sanoq shu qurilmada davom etadi, yakunlash yopiq; sahifa yangilansa ham saqlanadi', async ({ page, context }) => {
  await seedP0112(context);
  await openWarehouse(page);
  await expect(accepted(page)).toHaveText('98');

  await context.setOffline(true);
  const clock = { now: Date.now() };
  await page.clock.setFixedTime(clock.now);
  await scanMany(page, QUL, 1, clock);
  await scan(page, '4600000017822');
  await expect(page.getByTestId('connection-banner')).toHaveAttribute('data-state', 'offline');
  await expect(accepted(page)).toHaveText('99');
  await expect(page.getByTestId('act-card')).toContainText('Aloqa yo‘q: sanoq shu qurilmada saqlanmoqda.');
  await expect(page.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' })).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' })).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '112');
  await expect(accepted(page)).toHaveText('99');
  await expect(page.getByTestId('scan-journal')).toContainText('P-0112 · 104 ta skan');
});

test('telefon: skan kartasida skaner holati, sanoq qatorlarda, «Qabulni yakunlash» pastki panelda', async ({ page, context }) => {
  await seedP0112(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWarehouse(page);
  await expect(page.getByTestId('scan-card').getByTestId('scanner-status')).toContainText('Skaner: tayyor');
  await expect(page.locator('[data-count="declared"]')).toContainText('optovik arizasida');
  await expect(page.getByRole('button', { name: 'Qabulni yakunlash' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('arizasiz postavka: omborchiga optoviklar ro‘yxati yopiq bo‘lsa (BE-17, 403) — oynada xato, jim bo‘sh emas', async ({ page }) => {
  await page.route('**/api/v1/admin/wholesalers*', (route) => route.fulfill({
    status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: 403, code: 'FORBIDDEN', message: 'Ruxsat yo‘q' }),
  }));
  await openWarehouse(page);
  await page.getByTestId('awaiting-list').getByRole('button', { name: 'Arizasiz postavka' }).click();
  await expect(page.getByTestId('undeclared-dialog').getByRole('alert')).toContainText('Optovik va mahsulotlar ro‘yxati yuklanmadi');
});
