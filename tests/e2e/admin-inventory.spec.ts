import { expect, test, type Page, type Request } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const admin = { id: 'inventory-admin', role: 'ADMIN', name: 'Inventory Admin', phone: '+998901234567', isActive: true, isDeleted: false } as const;

const stockItems = [
  { shopId: '15', variantId: '88', productId: '12', productName: 'Samsung Galaxy A55', variantName: 'Qora', sku: 'A55-BLK', catalogMissing: false, warehouseId: '3', warehouseName: 'Asosiy ombor', warehouseActive: true, onHand: 10, reserved: 2, available: 8, lowStockThreshold: 3 },
  { shopId: '15', variantId: '89', productId: '12', productName: 'Samsung Galaxy A55', variantName: 'Oq', sku: 'A55-WHT', catalogMissing: false, warehouseId: '4', warehouseName: 'Eski ombor', warehouseActive: false, onHand: 2, reserved: 0, available: 2, lowStockThreshold: 5 },
  { shopId: '16', variantId: '77', productId: null, productName: null, variantName: null, sku: null, catalogMissing: true, warehouseId: '5', warehouseName: 'Chilonzor', warehouseActive: true, onHand: 4, reserved: 0, available: 4, lowStockThreshold: 1 },
  { shopId: '17', variantId: '66', productId: null, productName: null, variantName: null, sku: null, catalogMissing: false, warehouseId: '6', warehouseName: 'Yunusobod', warehouseActive: true, onHand: 1, reserved: 0, available: 1, lowStockThreshold: 0 },
];

const movement = { id: '501', shopId: '15', variantId: '88', productId: '12', productName: 'Samsung Galaxy A55', variantName: 'Qora', sku: 'A55-BLK', catalogMissing: false, warehouseId: '3', warehouseName: 'Asosiy ombor', warehouseActive: true, type: 'INBOUND', quantity: 5, onHandAfter: 10, reservedAfter: 2, referenceType: 'MANUAL', referenceId: '9', reason: 'Kirim hujjati', actorId: '7', createdAt: '2026-09-20T10:00:00.000Z' };

const params = (request: Request) => Object.fromEntries(new URL(request.url()).searchParams);

async function mockInventory(page: Page, stockRequests: Record<string, string>[] = [], movementRequests: Record<string, string>[] = []) {
  await page.route('**/api/v1/admin/inventory/stock**', async (route) => {
    stockRequests.push(params(route.request()));
    await route.fulfill({ json: { data: { items: stockItems, total: stockItems.length, page: 1, limit: 20, totalPages: 1, warnings: [{ shopId: '17', reason: 'Ichki xato' }], searchTruncated: false } } });
  });
  await page.route('**/api/v1/admin/inventory/movements**', async (route) => {
    movementRequests.push(params(route.request()));
    await route.fulfill({ json: { data: { items: [movement], total: 1, page: 1, limit: 20, totalPages: 1, warnings: [] } } });
  });
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => { throw error; });
  await installAuthenticatedSession(page, admin);
});

test('TC1: admin barcha do‘konlar qoldig‘ini ko‘radi — o‘chirilgan ombor, o‘chirilgan variant va katalog ogohlantirishi bilan', async ({ page }) => {
  const requests: Record<string, string>[] = [];
  await mockInventory(page, requests);
  await page.goto('/admin/inventory');

  await expect(page.getByRole('heading', { name: 'Platforma qoldig‘i' })).toBeVisible();
  const row = (text: string) => page.getByRole('row').filter({ hasText: text });
  await expect(row('A55-BLK')).toContainText('#15');
  await expect(row('A55-BLK')).toContainText('Asosiy ombor');
  await expect(row('A55-WHT')).toContainText('o‘chirilgan');
  await expect(row('A55-WHT')).toContainText('Kam');
  await expect(row('Chilonzor')).toContainText('Katalogda topilmadi (o‘chirilgan)');
  await expect(row('Yunusobod')).toContainText('Nomi olinmadi');
  await expect(page.getByRole('alert')).toContainText('#17');
  // Sukut bo‘yicha barcha omborlar so‘raladi (o‘chirilganlari ham).
  expect(requests[0]).toEqual({ page: '1', limit: '20' });
});

test('TC1: qoldiq filtrlari backendga to‘g‘ri yuboriladi va tozalanadi', async ({ page }) => {
  const requests: Record<string, string>[] = [];
  await mockInventory(page, requests);
  await page.goto('/admin/inventory');
  await expect(page.getByRole('row').filter({ hasText: 'A55-BLK' })).toBeVisible();

  await page.getByLabel('Mahsulot, variant yoki SKU').fill('a55');
  await page.getByLabel('Do‘kon ID').fill('15x');
  await expect(page.getByLabel('Do‘kon ID')).toHaveValue('15');
  await page.locator('#admin-stock-warehouse').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'O‘chirilgan omborlar' }).click();
  await page.getByRole('checkbox', { name: 'Faqat kam qoldiq' }).check();
  await expect.poll(() => requests.at(-1)).toEqual({ page: '1', limit: '20', search: 'a55', shopId: '15', warehouseActive: 'false', lowOnly: 'true' });

  await page.getByRole('button', { name: 'Tozalash' }).click();
  await expect(page.getByLabel('Mahsulot, variant yoki SKU')).toHaveValue('');
  await expect(page.getByLabel('Do‘kon ID')).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: 'Faqat kam qoldiq' })).not.toBeChecked();
  await expect(page.locator('#admin-stock-warehouse').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]')).toContainText('Barcha omborlar');
  await expect(page.getByRole('button', { name: 'Tozalash' })).toBeDisabled();
});

test('TC2: harakatlar jurnali — tur, sana va ombor filtri bilan', async ({ page }) => {
  const movementRequests: Record<string, string>[] = [];
  await mockInventory(page, [], movementRequests);
  await page.goto('/admin/inventory');
  await page.getByRole('tab', { name: 'Harakatlar' }).click();
  await expect(page).toHaveURL(/\/admin\/inventory\?tab=movements$/);

  const row = page.getByRole('row').filter({ hasText: 'A55-BLK' });
  await expect(row).toContainText('Kirim');
  await expect(row).toContainText('+5');
  await expect(row).toContainText('10 / 2');

  await page.locator('#admin-movement-type').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Band qilish' }).click();
  await page.getByLabel('Boshlanish sanasi').fill('2026-09-01');
  await page.getByLabel('Boshlanish sanasi').press('Enter');
  await page.getByLabel('Tugash sanasi').fill('2026-09-14');
  await page.getByLabel('Tugash sanasi').press('Enter');
  await expect.poll(() => movementRequests.at(-1)?.dateTo).toBeTruthy();
  const last = movementRequests.at(-1)!;
  expect(last.type).toBe('RESERVE');
  // Tugash sanasi o‘sha kunning OXIRIgacha kiradi (mahalliy vaqt bilan).
  expect(new Date(last.dateTo).getTime()).toBe(new Date('2026-09-14T23:59:59.999').getTime());
  expect(new Date(last.dateFrom).getTime()).toBe(new Date('2026-09-01T00:00:00').getTime());

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Harakatlar', selected: true })).toBeVisible();
});

test('qoldiq sahifasi mobil ekranda gorizontal skrollsiz sig‘adi', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockInventory(page);
  await page.goto('/admin/inventory');
  await expect(page.getByRole('row').filter({ hasText: 'Samsung' }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
