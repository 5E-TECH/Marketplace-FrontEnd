import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

async function mockStock(page: Page) {
  const items = [
    { variantId: '88', productName: 'iPhone 16 Pro', variantName: 'Qora / 256 GB', sku: 'IPH-16-QORA', warehouseId: '3', warehouseName: 'Asosiy ombor', onHand: 8, reserved: 3, available: 5, lowStockThreshold: 5 },
    { variantId: '89', productName: 'Futbolka', variantName: 'Oq / XL', sku: 'FUT-OQ-XL', warehouseId: '3', warehouseName: 'Asosiy ombor', onHand: 30, reserved: 2, available: 28, lowStockThreshold: 5 },
  ];
  let inboundBody: unknown;
  let adjustBody: unknown;
  await page.route('**/api/v1/inventory/stock**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const visible = url.pathname.endsWith('/stock/low') ? items.filter((item) => item.available <= item.lowStockThreshold) : items;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: visible, total: visible.length, page: 1, limit: 20, totalPages: 1 } }) });
  });
  await page.route('**/api/v1/inventory/stock/inbound', async (route) => {
    const body = route.request().postDataJSON() as { variantId: string; warehouseId: string; quantity: number };
    inboundBody = body;
    const item = items.find((entry) => entry.variantId === body.variantId && entry.warehouseId === body.warehouseId);
    if (item) {
      item.onHand += body.quantity;
      item.available += body.quantity;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: item }) });
  });
  await page.route('**/api/v1/inventory/stock/adjust', async (route) => {
    adjustBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { variantId: '88', warehouseId: '3', onHand: 6, reserved: 3, available: 3 } }) });
  });
  return { getInbound: () => inboundBody, getAdjust: () => adjustBody };
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test('TC1: jadval qoldiq sonlarini to‘g‘ri ko‘rsatadi', async ({ page }) => {
  await mockStock(page);
  await page.goto('/stock');
  const lowRow = page.getByRole('row').filter({ hasText: 'iPhone 16 Pro' });
  const lowCells = lowRow.getByRole('cell');
  await expect(lowCells.nth(3)).toHaveText('8');
  await expect(lowCells.nth(4)).toHaveText('3');
  await expect(lowCells.nth(5)).toHaveText('5');
  await expect(lowCells.nth(6)).toHaveText('5');
  await expect(lowRow).toContainText('Kam qolgan');
});

test('TC2: inbound +10 dan keyin jadval yangilanadi', async ({ page }) => {
  const api = await mockStock(page);
  await page.goto('/stock');
  const productRow = page.getByRole('row').filter({ hasText: 'iPhone 16 Pro' });
  await productRow.getByRole('button', { name: 'Kirim' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tovar kirimi' });
  await dialog.getByLabel('Miqdor').fill('10');
  await dialog.getByLabel('Sabab').fill('Yangi partiya');
  await dialog.getByRole('button', { name: 'Kirim qilish' }).click();
  await expect(page.getByText('Kirim muvaffaqiyatli bajarildi')).toBeVisible();
  expect(api.getInbound()).toMatchObject({ variantId: '88', warehouseId: '3', quantity: 10, reason: 'Yangi partiya' });
  expect((api.getInbound() as { idempotencyKey: string }).idempotencyKey).toBeTruthy();
  await expect(productRow.getByRole('cell').nth(3)).toHaveText('18');
  await expect(productRow.getByRole('cell').nth(4)).toHaveText('3');
  await expect(productRow.getByRole('cell').nth(5)).toHaveText('15');
});

test('TC3: kam qolgan tovar ajratib ko‘rsatiladi', async ({ page }) => {
  await mockStock(page);
  await page.goto('/stock');
  const lowRow = page.getByRole('row').filter({ hasText: 'iPhone 16 Pro' });
  await expect(lowRow).toHaveClass(/lowStock/);
  await expect(lowRow).toContainText('Kam qolgan');
  await expect(page.getByRole('row').filter({ hasText: 'Futbolka' })).toContainText('Yetarli');
  await page.getByRole('tab', { name: 'Kam qolgan' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Futbolka' })).toHaveCount(0);
});

test('tuzatish modal signed delta bilan adjust yuboradi', async ({ page }) => {
  const api = await mockStock(page);
  await page.goto('/stock');
  await page.getByRole('row').filter({ hasText: 'iPhone 16 Pro' }).getByRole('button', { name: 'Tuzatish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Qoldiqni tuzatish' });
  await dialog.getByLabel('O‘zgarish miqdori').fill('-2');
  await dialog.getByLabel('Sabab').fill('Yaroqsiz tovar');
  await dialog.getByRole('button', { name: 'Tuzatish' }).click();
  await expect(page.getByText('Qoldiq tuzatildi')).toBeVisible();
  expect(api.getAdjust()).toMatchObject({ variantId: '88', warehouseId: '3', delta: -2, reason: 'Yaroqsiz tovar' });
  expect((api.getAdjust() as { idempotencyKey: string }).idempotencyKey).toBeTruthy();
});

test('warehouseId va productId query filterlari yuboriladi', async ({ page }) => {
  await mockStock(page);
  await page.goto('/stock');
  const request = page.waitForRequest((value) => { const url = new URL(value.url()); return url.searchParams.get('warehouseId') === '3' && url.searchParams.get('productId') === '12'; });
  await page.getByLabel('Ombor ID').fill('3');
  await page.getByLabel('Mahsulot ID').fill('12');
  await request;
});
