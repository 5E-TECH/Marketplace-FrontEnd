import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-13 (admin-narx; BE-09): narx navbati, kalkulyator va narxni tasdiqlash — 4 holat. Hisob serverda (mock —
 * backend kalkulyatori nusxasi). «Bolalar quloqchinlari» (511): optovik 140 000, haq 65 000, 0.3 kg, qisman rejim →
 * tavsiya 262 000, to'q sariq 235 828 dan, sariq 251 183 dan.
 * TC1 — 230 000 qizil, saqlash yo'q; TC2 — 245 000 to'q sariq, sababsiz saqlanmaydi, 58 936 taklif;
 * TC3 — 262 000 yashil, bir tugma bilan; TC4 — bozor narxi kiritildi → solishtirish natijasi.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function openPrices(page: Page, path = '/admin/moderation?tab=prices') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await page.goto(path);
}

const decision = (page: Page) => page.getByTestId('price-decision');
/** Pul maydoni guruhlarni bo'linmas bo'shliq bilan ajratadi. */
const money = (value: string) => new RegExp(`^${value.replace(/\s/g, '\\s')}$`);
const priceInput = (page: Page) => page.getByTestId('admin-price');
const approve = (page: Page) => decision(page).getByRole('button', { name: /^Narxni tasdiqlash/ });

async function typePrice(page: Page, value: string) {
  await priceInput(page).fill(value);
  await expect(decision(page).getByTestId('price-scale')).toHaveAttribute('aria-label', new RegExp(`Belgi ${value.replace(/\s/g, '\\s')} da`));
}

test('narx navbati va hisob: tavsiya, chegaralar, taqsimot, rejimlar — serverdan', async ({ page }) => {
  await openPrices(page);
  const queue = page.getByTestId('price-queue');
  await expect(queue.getByRole('link')).toHaveText([/^Bolalar quloqchinlari.*140 000 → 262 000/, /^Bolalar tarozisi/, /^Termos krujka/, /^Bug‘li dazmol/]);
  await expect(page.getByRole('tab', { name: /Narx\s*4/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('price-review-state')).toHaveText('Ko‘rib chiqilmoqda');

  const calc = page.getByTestId('price-calculation');
  await expect(calc).toContainText('Tavsiya narx251 000 so‘m');
  await expect(calc).toContainText('(0.96 × 205 000 + 29 688 + 9 000) / 0.9415 = 250 120 → 1 000 gacha yuqoriga');
  await expect(calc).toContainText('Zararsizlik narxi240 561 so‘m');
  await expect(calc).toContainText('Qat’iy pastki chegara225 206 so‘m');
  await expect(calc).toContainText('Platforma natijasi, sotuvdan9 828 so‘m');
  await expect(calc).toContainText('18.3%');
  await expect(page.getByTestId('price-split')).toContainText('Platforma xizmati');
  await expect(page.getByTestId('price-split')).toContainText('13.5%');
  await expect(page.getByTestId('price-modes').getByRole('row')).toHaveText(['Rejim · mijoz ko‘radiMijoz jamiPlatforma natijasi', /Alohida.*291 000.*9 828/, /Qisman.*292 000.*10 185/, /Bepul.*294 000.*10 313/]);
  await expect(calc).toContainText('qisman, global sozlamadan');

  await expect(priceInput(page)).toHaveValue(money('262 000'));
  await expect(page.getByTestId('price-state')).toContainText('Yashil');
  await expect(page.getByTestId('product-audit')).toContainText('Tavsiya narx hisoblandi: 251 000 so‘m (qisman rejimda 262 000 so‘m)');
});

test('TC1: 230 000 — qizil, tasdiqlash yopiq; zararsiz taqsimot yo‘q', async ({ page }) => {
  await openPrices(page);
  await typePrice(page, '230 000');
  await expect(page.getByTestId('price-state')).toContainText('Qizil');
  await expect(page.getByTestId('price-state')).toContainText('Qabul qilinmaydi');
  await expect(decision(page)).toContainText('235 828 so‘mdan past narx qabul qilinmaydi.');
  await expect(decision(page)).toContainText('Qizil narx saqlanmaydi — narxni 235 828 so‘mdan yuqori qiling.');
  await expect(page.getByTestId('price-safe')).toContainText('Zararsiz taqsimot yo‘q.');
  await expect(page.getByTestId('price-safe')).toContainText('ko‘pi bilan 44 226 so‘m');
  await expect(page.getByTestId('price-results')).toContainText('−19 943 so‘m');
  await expect(approve(page)).toBeDisabled();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('price-outcome')).toHaveCount(0);
  expect(db.adminProducts.find((product) => product.id === '511')?.approvedPrice).toBeNull();
});

test('TC2: 245 000 — to‘q sariq: sababsiz saqlanmaydi, 58 936 taklif; sabab bilan — superadminga xabar', async ({ page }) => {
  await openPrices(page);
  await typePrice(page, '245 000');
  await expect(page.getByTestId('price-state')).toContainText('To‘q sariq');
  const safe = page.getByTestId('price-safe');
  await expect(safe).toContainText('sotuvchi haqi 58 936 so‘mgacha tushirilsa, platforma ham, sotuvchi ham zarar ko‘rmaydi.');
  await expect(safe.getByRole('button', { name: 'Haqni 58 936 so‘m qilish' })).toBeVisible();

  await approve(page).click();
  await expect(decision(page).getByRole('alert')).toContainText('To‘q sariq narxda sabab majburiy');
  await expect(page.getByTestId('price-reason')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('price-outcome')).toHaveCount(0);
  expect(db.adminProducts.find((product) => product.id === '511')?.approvedPrice).toBeNull();

  // Zararsiz taklif oynasi: yangi haq bilan holat sariqqa o'tadi.
  await safe.getByRole('button', { name: 'Haqni 58 936 so‘m qilish' }).click();
  const fee = page.getByRole('dialog', { name: 'Sotuvchi haqini o‘zgartirish' });
  await expect(page.getByTestId('price-fee-input')).toHaveValue(money('58 936'));
  await expect(fee.getByTestId('price-fee-compare')).toContainText('Sariq');
  await fee.getByRole('button', { name: 'Bekor qilish' }).click();

  await decision(page).getByRole('button', { name: 'Raqobatchi narxiga moslash' }).click();
  await approve(page).click();
  const outcome = page.getByTestId('price-outcome');
  await expect(outcome).toContainText('Narx tasdiqlandi: 245 000 so‘m');
  await expect(outcome).toContainText('Sabab: Raqobatchi narxiga moslash');
  await expect(outcome).toContainText('Superadminga xabar yuborildi.');
  await expect(page.getByText('Bolalar quloqchinlari — 245 000 so‘m, To‘q sariq. Superadminga xabar yuborildi.')).toBeVisible();
  await expect(page.getByTestId('price-review-state')).toHaveText('Tasdiqlandi');
  expect(db.adminProducts.find((product) => product.id === '511')).toMatchObject({ approvedPrice: 245_000, priceStatus: 'ORANGE' });
});

test('TC3: 262 000 — yashil, bir tugma bilan tasdiq; navbatdan chiqadi, «Keyingisi»', async ({ page }) => {
  await openPrices(page);
  await expect(page.getByTestId('price-state')).toContainText('Narx tavsiya narxdan past emas. Saqlanadi.');
  await expect(page.getByTestId('price-results')).toContainText('10 185 so‘m');
  await expect(page.getByTestId('price-results')).toContainText('24 641 so‘m');
  await approve(page).click();
  const outcome = page.getByTestId('price-outcome');
  await expect(outcome).toContainText('Narx tasdiqlandi: 262 000 so‘m');
  await expect(outcome).toContainText('qisman rejim, mijoz jami 292 000 so‘m');
  await expect(page.getByTestId('product-audit')).toContainText('Narx qarori: Yashil · 262 000 so‘m');
  await expect(page.getByTestId('price-queue').getByRole('link')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: /Narx\s*3/ })).toBeVisible();
  await outcome.getByRole('button', { name: 'Keyingisi: Bolalar tarozisi' }).click();
  await expect(page).toHaveURL(/product=512/);
  await expect(page.getByRole('heading', { level: 2, name: 'Bolalar tarozisi' })).toBeVisible();
  await expect(priceInput(page)).toHaveValue(money('221 000'));
});

test('TC4: bozor narxi — 285 000 qimmat (134 369), «Optovik bilan kelishish» → rad etish; 299 000 mos', async ({ page }) => {
  await openPrices(page);
  await expect(decision(page)).toContainText('Bozor narxi kiritilmagan');
  await decision(page).getByRole('button', { name: 'Manba bilan kiritish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bozor narxini kiritish' });
  await dialog.getByLabel('Raqobatchida mijoz jami to‘laydi').fill('285 000');
  await expect(dialog).toContainText('Qimmat: optovik narxini pasaytirish kerak');
  await expect(dialog).toContainText('bozordan 7 000 so‘m qimmat');
  await expect(dialog).toContainText('134 369 so‘m');
  await dialog.getByLabel(/Qayerda ko‘rildi/).fill('uzum.uz');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog).toBeHidden();

  const result = page.getByTestId('market-result');
  await expect(page.getByTestId('market-verdict')).toHaveText('Qimmat: optovik narxini pasaytirish kerak');
  await expect(result).toContainText('292 000 so‘m');
  await expect(result).toContainText('hozir 140 000 so‘m · shu bozor narxida platforma natijasi M = 9 000 saqlanadi');
  await expect(decision(page)).toContainText('Manba: uzum.uz');

  await decision(page).getByRole('button', { name: 'Optovik bilan narxni kelishish' }).click();
  const reject = page.getByRole('dialog', { name: 'Narxni rad etish' });
  await expect(reject.getByRole('textbox')).toHaveValue('Raqobatchida mijoz jami 285 000 so‘m, bizda 292 000 so‘m. Optovik narxi 134 369 so‘mdan oshmasa, narx bozorga mos keladi.');
  await reject.getByRole('button', { name: 'Bekor qilish' }).click();

  // Inline kiritish (Enter): 299 000 — mos.
  await page.getByTestId('market-input').fill('299 000');
  await page.getByTestId('market-input').press('Enter');
  await expect(page.getByTestId('market-verdict')).toHaveText('Mos: bozor narxidan qimmat emas');
  await expect(page.getByTestId('market-result')).toContainText('148 099 so‘m');
  await expect(page.getByTestId('market-result')).toContainText('bozordan 7 000 so‘m arzon');
});

test('rad etish: sabab majburiy, mahsulot sotuvga chiqmaydi va navbatdan chiqadi', async ({ page }) => {
  await openPrices(page);
  await decision(page).getByRole('button', { name: 'Rad etish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Narxni rad etish' });
  await dialog.getByRole('button', { name: 'Rad etish' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Sababni yozing');
  await dialog.getByRole('textbox').fill('Bozor narxidan qimmat');
  await dialog.getByRole('button', { name: 'Rad etish' }).click();
  await expect(page.getByTestId('price-outcome')).toContainText('Narx rad etildi');
  await expect(page.getByTestId('price-review-state')).toHaveText('Rad etildi');
  await expect(page.getByTestId('price-queue').getByRole('link')).toHaveCount(3);
  expect(db.adminProducts.find((product) => product.id === '511')?.status).toBe('REJECTED');
});

test('yetkazish rejimi: «Alohida» — tavsiya 251 000, manba «shu mahsulot uchun»', async ({ page }) => {
  await openPrices(page);
  await page.getByTestId('price-calculation').getByRole('radio', { name: 'Alohida' }).click();
  await expect(page.getByTestId('price-calculation').getByRole('radio', { name: 'Alohida' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('price-calculation')).toContainText('alohida, shu mahsulot uchun');
  await expect(decision(page)).toContainText('tavsiya: 251 000 so‘m');
  await expect(priceInput(page)).toHaveValue(money('251 000'));
});

test('mahsulot kartasi «Narx» yorlig‘i: kalkulyator, tasdiqdan keyin «Narxni o‘zgartirish»', async ({ page }) => {
  await openPrices(page, '/admin/products/511?tab=price');
  await expect(page.getByTestId('price-tab').getByTestId('price-calculation')).toBeVisible();
  await approve(page).click();
  await expect(page.getByTestId('price-outcome')).toContainText('Narx tasdiqlandi: 262 000 so‘m');
  await page.getByRole('button', { name: 'Narxni o‘zgartirish' }).click();
  await expect(decision(page)).toBeVisible();
  await expect(priceInput(page)).toHaveValue(money('262 000'));
});

test('telefon: navbat ro‘yxati → mahsulot sahifasi, amallar pastki panelda, «orqaga» — narx navbatiga', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPrices(page);
  await expect(page.getByTestId('price-queue')).toContainText('Narx navbati (4)');
  await page.getByRole('link', { name: 'Bolalar quloqchinlari: narxni ko‘rib chiqish' }).click();
  await expect(page).toHaveURL(/\/admin\/moderation\/511\?tab=prices/);
  await expect(page.getByText('Narx navbati · 1 / 4')).toBeVisible();
  await expect(page.getByTestId('price-decision').getByRole('button', { name: /^Narxni tasdiqlash/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Narxni tasdiqlash' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Orqaga: Narx navbati' }).click();
  await expect(page).toHaveURL(/\/admin\/moderation\?tab=prices$/);
});
