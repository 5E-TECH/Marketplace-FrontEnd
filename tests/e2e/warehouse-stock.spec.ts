import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { seedLot } from '../../src/mocks/handlers/warehouse';
import { addDays, tashkentDate } from '../../src/shared/lib/tashkentTime';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-16 (ombor-qoldiq, ombor-muddat): «Qoldiq» — SKU bo'yicha omborda / band / mavjud / brak va «Muddat» — partiyalar.
 * TC4 davomi: muddatiga 50 kun qolgan partiya omborda turadi, lekin «mavjud»ga kirmaydi (BE-17 `blocked`). Muddati
 * o'tgan partiya — hisobdan chiqarish (`adjust` + `lotId`; izoh majburiy, partiyadan ko'p emas).
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

/** Namuna Farm «Vitamin kompleksi» (P-0120): 140 dona — 259 kun, 60 dona — `secondDays` kun; yacheyka C-03-2. */
function seedVitamin(secondDays: number) {
  const today = tashkentDate();
  seedLot('511', 140, addDays(today, 259), 'P-0120-1');
  seedLot('511', 60, addDays(today, secondDays), 'P-0120-2');
  const sku = db.inbound.skus.find((item) => item.productId === '511');
  if (sku) sku.cell = 'C-03-2';
}

async function openStock(page: Page, query = '') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000005');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/warehouse$/);
  await page.goto(`/warehouse/stock${query}`);
}

test('Ro‘yxat: omborda / band / mavjud / brak, «mavjud 0» ogohlantirishi, filtrlar va jami', async ({ page }) => {
  await openStock(page);
  const kpis = page.locator('[class*="kpi_"]');
  await expect(kpis.nth(0)).toContainText('206');
  await expect(kpis.nth(1)).toContainText('15');
  await expect(kpis.nth(2)).toContainText('191');
  await expect(kpis.nth(3)).toContainText('4');
  await expect(page.getByTestId('stock-zero')).toContainText('Bolalar termos shishasi — mavjud 0');
  await expect(page.getByTestId('stock-zero')).toContainText('P-0113 bilan 60 dona kelmoqda');
  const table = page.getByTestId('stock-table');
  await expect(table.locator('tfoot')).toContainText('Jami · 4 SKU');
  await table.getByRole('button', { name: /Mavjud 0/ }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr')).toContainText('tugagan');
  await table.getByRole('button', { name: /Mavjud 0/ }).click();
  await table.getByRole('searchbox').fill('B-02-2');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr')).toContainText('Elektr choynak');
});

test('TC4: 50 kun qolgan partiya omborda, lekin «mavjud»ga kirmaydi; «Muddat» — sotuvdan chiqarilgan', async ({ page }) => {
  seedVitamin(50);
  await openStock(page);
  const row = page.getByTestId('stock-table').locator('tr[data-variant-id="51101"]');
  await expect(row).toContainText('Vitamin kompleksi');
  await expect(row.locator('td').nth(3)).toHaveText('200');
  await expect(row.locator('td').nth(5)).toHaveText('140');
  await expect(row).toContainText('1 sotuvdan chiqarilgan');

  await page.getByRole('tab', { name: /Muddat/ }).click();
  await expect(page.getByTestId('stock-page')).toHaveAttribute('data-tab', 'expiry');
  await expect(page.locator('[data-kpi="BLOCKED"]')).toContainText('60 dona · P-0120-2');
  await expect(page.getByTestId('lot-cell-warning')).toContainText('P-0120-2 ni alohida joyga qo‘ying');
  const lot = page.locator('tr[data-lot="P-0120-2"]');
  await expect(lot).toContainText('Sotuvdan chiqarilgan');
  await expect(lot).toContainText('50 kun');
  await expect(page.locator('tr[data-lot="P-0120-1"]')).toContainText('Sotuvda');
  await lot.click();
  await expect(page.getByTestId('lot-selected')).toContainText('Tanlangan: P-0120-2 · 60 dona · sotuvdan chiqarilgan');
  await expect(page.getByTestId('lot-selected').getByRole('link', { name: 'Joyini o‘zgartirish' })).toBeVisible();
});

test('muddati o‘tgan partiya: hisobdan chiqarish — miqdor partiyadan ko‘p emas, izoh majburiy', async ({ page }) => {
  seedVitamin(-1);
  await openStock(page, '?tab=expiry');
  await page.locator('tr[data-lot="P-0120-2"]').click();
  await page.getByTestId('lot-selected').getByRole('button', { name: 'Hisobdan chiqarish' }).click();
  const writeOff = page.getByTestId('write-off-dialog');
  await expect(writeOff).toContainText('Partiyadagi hammasi: 60 dona');
  await writeOff.getByLabel(/Miqdor/).fill('61');
  await expect(writeOff).toContainText('Ko‘pi bilan 60 dona — partiyada shuncha bor');
  await expect(writeOff.getByRole('button', { name: 'Hisobdan chiqarish' })).toBeDisabled();
  await writeOff.getByLabel(/Miqdor/).fill('60');
  await writeOff.getByRole('button', { name: 'Hisobdan chiqarish' }).click();
  await expect(writeOff).toContainText('Izohni yozing');
  await writeOff.getByLabel(/Izoh/).fill('Partiya alohida joydan olindi, yo‘q qilish uchun ajratildi');
  await writeOff.getByRole('button', { name: 'Hisobdan chiqarish' }).click();
  await expect(page.getByText('Hisobdan chiqarildi')).toBeVisible();
  await expect(page.locator('tr[data-lot="P-0120-2"]')).toHaveCount(0);
  expect(db.inbound.skus.find((item) => item.variantId === '51101')?.onHand).toBe(140);
});
