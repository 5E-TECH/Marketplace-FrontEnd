import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { addDays, tashkentDate } from '../../src/shared/lib/tashkentTime';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-16 (ombor-qabul, hujjat-qabul-akti): omborchi postavkani skaner bilan qabul qiladi.
 * TC1 — admin e'lon qilgan 100 dona: 98 qabul + 2 brak → farq akti (PDF sahifa), sonlar tizim bilan mos;
 * TC2 — noma'lum shtrix-kod → ogohlantirish; TC3 — bir xil skan tez 2 marta → bitta;
 * TC4 — muddatiga 50 kun qolgan partiya «Sotuvdan chiqarilgan», «mavjud»ga qo'shilmaydi.
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

const openWarehouse = (page: Page) => login(page, '900000005', /\/warehouse$/);

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

/** P-0112 qabulda emas: sahifa ro'yxat ko'rinishida ochiladi. */
function resetP0112() {
  const p112 = db.inbound.shipments.find((item) => item.id === '112');
  if (p112) Object.assign(p112, { receivingStartedAt: null, accepted: 0, defect: 0, lots: [] });
  db.inbound.scans['112'] = [];
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
  const warehouse: BrowserContext = await browser.newContext();
  await installMockApi(warehouse, { reset: false });
  const wh = await warehouse.newPage();
  const clock = { now: Date.now() };
  await wh.clock.setFixedTime(clock.now);
  await openWarehouse(wh);
  // P-0112 qabulda — o'ng ustundagi navbatdan P-0114 ochiladi.
  await wh.getByRole('button', { name: 'P-0114 qabulini ochish' }).click();
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
  await expect(wh.locator('[data-count="accepted"] dd')).toHaveText('98');
  await expect(wh.locator('[data-count="defect"] dd')).toHaveText('2');
  await expect(wh.getByTestId('act-card')).toContainText('−2');
  await expect(wh.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' })).toBeEnabled();

  await wh.getByTestId('act-card').getByLabel('Aktga izoh').fill('2 ta qutida quloqchin korpusi singan');
  await wh.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' }).click();
  const finish = wh.getByTestId('finish-dialog');
  await expect(finish).toContainText('98 dona → B-02-1');
  await expect(finish).toContainText('Farq bor');
  await finish.getByRole('button', { name: 'Yakunlash va akt tuzish' }).click();
  await expect(wh.getByText('P-0114 yakunlandi')).toBeVisible();
  await expect(wh.getByTestId('inbound-page')).toHaveAttribute('data-view', 'list');
  await expect(wh.getByTestId('done-list').locator('tr[data-shipment-id="114"]')).toContainText('100 · 98 · 2');

  const saved = db.inbound.shipments.find((item) => item.id === '114');
  expect(saved).toMatchObject({ status: 'DISCREPANCY', declared: 100, accepted: 98, defect: 2, actNote: '2 ta qutida quloqchin korpusi singan' });

  await expect(wh.getByTestId('done-list').locator('tr[data-shipment-id="114"]').getByRole('link', { name: 'PDF' })).toHaveAttribute('href', '/inbound-acts/114');

  // Akt: toastdagi «Aktni ochish» — yangi tabda A4 sahifa; sonlar postavkadagi bilan bir xil.
  const [act] = await Promise.all([warehouse.waitForEvent('page'), wh.getByRole('button', { name: 'Aktni ochish' }).click()]);
  await expect(act).toHaveURL(/\/inbound-acts\/114$/);
  const sheet = act.getByTestId('inbound-act');
  await expect(sheet).toContainText('P-0114');
  await expect(act.getByTestId('act-status')).toHaveText('FARQ BOR');
  await expect(sheet.locator('tfoot td')).toHaveText(['Jami', '100', '98', '2', '−2']);
  await expect(sheet).toContainText('Farq: −2 dona — hammasi brak');
  await expect(sheet).toContainText('Yuz dona e’lon qilingan, to‘qson sakkiz dona qabul qilingan, ikki dona brak.');
  await expect(sheet).toContainText('«2 ta qutida quloqchin korpusi singan»');
  await expect(act.getByRole('button', { name: 'PDF yuklab olish' })).toBeVisible();
  await warehouse.close();
});

test('TC2: noma’lum shtrix-kod — maydon qizil, ogohlantirish, jurnalda «Yozilmadi», son o‘zgarmaydi', async ({ page }) => {
  await openWarehouse(page);
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '112');
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('98');
  await scan(page, '4600000017899');
  const problem = page.getByTestId('scan-problem');
  await expect(problem).toContainText('Noma’lum kod — yozilmadi');
  await expect(problem).toContainText('4600000017899 hech bir SKUda yo‘q. Qabul soni o‘zgarmadi: 98.');
  await expect(page.getByTestId('scan-field')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('scan-journal').locator('li').first()).toContainText('Yozilmadi');
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('98');

  // Boshqa mahsulot kodi — bu postavkada yo'q.
  await scan(page, '4780012345684');
  await expect(problem).toContainText('Boshqa mahsulot — yozilmadi');
  await expect(problem).toContainText('Oshxona tarozisi, bu postavkada yo‘q');

  // Keyingi to'g'ri skan — ogohlantirish yo'qoladi, son ortadi.
  await page.waitForTimeout(1_050);
  await scan(page, QUL);
  await expect(problem).toBeHidden();
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('99');
});

test('TC3: bir xil skan ikki marta tez — bitta hisoblanadi, jurnalda «Takroriy skan»', async ({ page }) => {
  resetP0112();
  const clock = { now: Date.now() };
  await page.clock.setFixedTime(clock.now);
  await openWarehouse(page);
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-view', 'list');
  // Birinchi skan — mos postavka (P-0112) qabuli o'zi ochiladi va shu skan yoziladi.
  await scan(page, QUL);
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '112');
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('1');
  // 300 ms dan keyin xuddi shu kod — takror.
  clock.now += 300;
  await page.clock.setFixedTime(clock.now);
  await scan(page, QUL);
  await expect(page.getByTestId('scan-duplicate')).toContainText('Takroriy skan — bitta hisoblandi');
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('1');
  await expect(page.getByTestId('scan-journal').locator('li').first()).toContainText('Takroriy skan');
  await expect.poll(() => db.inbound.shipments.find((item) => item.id === '112')?.accepted).toBe(1);
  // Oraliqdan keyin — yangi tovar.
  await scanMany(page, QUL, 1, clock);
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('2');
  await expect.poll(() => db.inbound.scans['112'].filter((item) => item.result === 'ACCEPTED').length).toBe(2);
});

test('TC4: muddatiga 50 kun qolgan partiya — «Sotuvdan chiqarilgan», qoldiqqa kiradi, «mavjud»ga kirmaydi', async ({ page }) => {
  test.setTimeout(90_000);
  const today = tashkentDate();
  await openWarehouse(page);
  // Arizasiz yuk: omborchi optovik nomidan ochadi (karta: WAREHOUSE ham DECLARED ochadi).
  await page.getByTestId('queue-card').getByRole('button', { name: 'Arizasiz postavka' }).click();
  const undeclared = page.getByTestId('undeclared-dialog');
  await undeclared.getByRole('combobox', { name: /Optovik/ }).selectOption({ label: 'Namuna Farm MChJ' });
  await undeclared.getByRole('combobox', { name: /Mahsulot/ }).selectOption({ label: 'Vitamin kompleksi' });
  await undeclared.getByLabel(/Taxminiy miqdor/).fill('4');
  await undeclared.getByRole('button', { name: 'Arizani saqlash' }).click();
  await expect(page.getByText('P-0114 e’lon qilindi')).toBeVisible();
  await page.getByRole('button', { name: 'P-0114 qabulini ochish' }).click();
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '114');

  // Birinchi skan — partiya va muddat so'raladi.
  const clock = { now: Date.now() };
  await page.clock.setFixedTime(clock.now);
  await scan(page, VITAMIN);
  const lot = page.getByTestId('lot-dialog');
  await expect(lot).toContainText('Vitamin kompleksi · birinchi skan');
  await lot.getByRole('button', { name: 'Saqlash' }).click();
  await expect(lot).toContainText('Muddatni kiriting: bu toifadagi tovar faqat muddat bilan qabul qilinadi.');
  const longExpiry = addDays(today, 259).split('-').reverse().join('.');
  await lot.getByLabel(/Yaroqlilik muddati/).fill(longExpiry);
  await lot.getByRole('button', { name: 'Saqlash' }).click();
  await expect(lot).toBeHidden();
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('1');
  await scanMany(page, VITAMIN, 1, clock);
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('2');

  // Qadoqda boshqa sana: 50 kun qolgan.
  await page.getByRole('button', { name: 'Yangi partiya' }).click();
  await expect(lot).toContainText('qadoqda boshqa sana');
  await lot.getByLabel(/Yaroqlilik muddati/).fill(addDays(today, 50).split('-').reverse().join('.'));
  await expect(lot).toContainText('50 kun qoladi — partiya sotuvga chiqmaydi');
  await expect(lot).toContainText('Qoldiqqa kiradi, sotuvga chiqmaydi');
  await lot.getByRole('button', { name: 'Saqlash' }).click();
  await expect(lot).toBeHidden();
  await scanMany(page, VITAMIN, 2, clock);
  await expect(page.getByTestId('receiving-counted')).toHaveText('4 / 4');
  const lots = page.getByTestId('lots-table');
  await expect(lots.locator('tr[data-lot="P-0114-1"]')).toContainText('Sotuvda');
  await expect(lots.locator('tr[data-lot="P-0114-2"]')).toContainText('Sotuvdan chiqarilgan');
  await expect(lots.locator('tr[data-lot="P-0114-2"]')).toContainText('50 kun');
  await expect(page.getByTestId('lot-blocked')).toContainText('P-0114-2 sotuvga chiqmaydi');

  await page.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' }).click();
  const finish = page.getByTestId('finish-dialog');
  await expect(finish).toContainText('Farq yo‘q');
  await finish.getByRole('button', { name: 'Yakunlash', exact: true }).click();
  await expect(page.getByText('P-0114 yakunlandi')).toBeVisible();

  // Qoldiq: 4 dona omborda, 2 tasi sotuvdan chiqarilgan — «mavjud» 2.
  const vitamin = db.inbound.skus.find((item) => item.variantId === '51101');
  expect(vitamin).toMatchObject({ onHand: 4, blocked: 2 });
});

test('oxirgi skanni bekor qilish; arizasiz postavka — kutilayotgan postavka taklifi', async ({ page }) => {
  await openWarehouse(page);
  await page.getByRole('button', { name: 'Oxirgi skanni bekor qilish' }).click();
  const undo = page.getByTestId('undo-scan');
  await expect(undo).toContainText('98 → 97');
  await expect(undo).toContainText('100 / 100 → 99 / 100');
  await undo.getByRole('button', { name: 'Skanni bekor qilish' }).click();
  await expect(page.getByText('Skan bekor qilindi')).toBeVisible();
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('97');
  await expect(page.getByTestId('receiving-counted')).toHaveText('99 / 100');

  await page.getByTestId('queue-card').getByRole('button', { name: 'Arizasiz postavka' }).click();
  const undeclared = page.getByTestId('undeclared-dialog');
  await undeclared.getByRole('combobox', { name: /Mahsulot/ }).selectOption({ label: 'Bolalar termos shishasi' });
  await expect(undeclared.getByTestId('undeclared-expected')).toContainText('Bu mahsulot kutilmoqda: P-0113 · 60 dona · Yo‘lda');
  await undeclared.getByRole('button', { name: 'P-0113 qabulini boshlash' }).click();
  await expect(page.getByTestId('inbound-page')).toHaveAttribute('data-shipment-id', '113');
});

test('aloqa uzildi: skanlar navbatda, sanoq davom etadi, yakunlash yopiq; tiklanganda o‘zi yuboriladi', async ({ page, context }) => {
  await openWarehouse(page);
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('98');
  await page.getByRole('button', { name: 'Oxirgi skanni bekor qilish' }).click();
  await page.getByTestId('undo-scan').getByRole('button', { name: 'Skanni bekor qilish' }).click();
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('97');

  await context.setOffline(true);
  const clock = { now: Date.now() };
  await page.clock.setFixedTime(clock.now);
  await scanMany(page, QUL, 1, clock);
  await scan(page, '4600000017822');
  await scanMany(page, QUL, 1, clock);
  const banner = page.getByTestId('connection-banner');
  await expect(banner).toHaveAttribute('data-state', 'scan-queue');
  await expect(banner).toContainText('3 ta skan yuborilmadi.');
  await expect(banner).toContainText('navbatda: 3');
  // Sanoq brauzerda davom etadi; jurnalda «Navbatda»; yakunlash navbat bo'shaguncha yopiq.
  await expect(page.locator('[data-count="accepted"] dd')).toHaveText('99');
  await expect(page.getByTestId('scan-journal').getByText('Navbatda')).toHaveCount(3);
  await expect(page.getByTestId('act-card')).toContainText('Navbatdagi 3 ta skan yuborilmaguncha qabulni yakunlab bo‘lmaydi');
  await expect(page.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' })).toBeDisabled();
  expect(db.inbound.shipments.find((item) => item.id === '112')?.accepted).toBe(97);

  await context.setOffline(false);
  await expect(banner).toHaveAttribute('data-state', 'scan-queue-sent');
  await expect(banner).toContainText('Aloqa tiklandi. Navbatdagi 3 ta skan yuborildi.');
  await expect(page.getByTestId('scan-journal').getByText('Navbatda')).toHaveCount(0);
  await expect(page.getByTestId('scan-journal').locator('li').first()).toContainText('Qabul 99');
  await expect(page.getByTestId('act-card').getByRole('button', { name: 'Qabulni yakunlash' })).toBeEnabled();
  await expect.poll(() => db.inbound.shipments.find((item) => item.id === '112')?.accepted).toBe(99);
  await expect(banner).toBeHidden({ timeout: 6_000 });
});

test('telefon: skan kartasida skaner holati, sanoq qatorlarda, «Qabulni yakunlash» pastki panelda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWarehouse(page);
  await expect(page.getByTestId('scan-card').getByTestId('scanner-status')).toContainText('Skaner: tayyor');
  await expect(page.locator('[data-count="declared"]')).toContainText('optovik arizasida');
  await expect(page.getByRole('button', { name: 'Qabulni yakunlash' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
