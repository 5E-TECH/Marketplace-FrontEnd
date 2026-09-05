import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const orders = [
  { id: '31', salesOrderId: '12', buyerName: 'Ali Valiyev', subtotal: 450000, codAmount: 450000, status: 'ON_THE_ROAD', elchiShipmentId: '987', trackingUrl: 'https://elchi.uz/track/987', itemsCount: 2, createdAt: '2026-07-30T09:00:00.000Z' },
  { id: '32', salesOrderId: '13', buyerName: 'Madina Karimova', subtotal: 180000, codAmount: 0, status: 'PENDING', elchiShipmentId: null, trackingUrl: null, itemsCount: 1, createdAt: '2026-08-01T11:00:00.000Z' },
  { id: '33', salesOrderId: '14', buyerName: null, subtotal: 920000, codAmount: 920000, status: 'DELIVERED', elchiShipmentId: '990', trackingUrl: 'https://elchi.uz/track/990', itemsCount: 4, createdAt: '2026-08-02T13:00:00.000Z' },
];

async function mockOrders(page: Page) {
  const currentOrders = orders.map((order) => ({ ...order }));
  let updateBody: unknown;
  let updateId = '';
  let authorization = '';
  await page.route('**/api/v1/seller/orders**', async (route) => {
    if (route.request().method() === 'PATCH') {
      updateId = route.request().url().split('/').at(-1) ?? '';
      updateBody = route.request().postDataJSON();
      authorization = route.request().headers().authorization ?? '';
      const body = updateBody as { status: string };
      const order = currentOrders.find((item) => item.id === updateId);
      if (order) order.status = body.status;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: order }) });
      return;
    }
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const visible = currentOrders.filter((order) =>
      (!status || order.status === status) &&
      (!search || order.salesOrderId.includes(search)) &&
      (!dateFrom || order.createdAt.slice(0, 10) >= dateFrom) &&
      (!dateTo || order.createdAt.slice(0, 10) <= dateTo),
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: visible, total: visible.length, page: 1, limit: 20, totalPages: 1 } }) });
  });
  return { getUpdateBody: () => updateBody, getUpdateId: () => updateId, getAuthorization: () => authorization };
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
  await mockOrders(page);
  await page.goto('/orders');
});

test('TC1: seller buyurtmalari to‘g‘ri sonlar bilan ko‘rsatiladi', async ({ page }) => {
  const row = page.getByRole('row').filter({ hasText: '#12' });
  await expect(row).toContainText('Ali Valiyev');
  await expect(row).toContainText('2 ta');
  await expect(row).toContainText('450 000 so‘m');
  await expect(row).toContainText('Yo‘lda');
  await expect(page.getByText('3 ta natija')).toBeVisible();
});

test('TC2: status, sana va search filterlari serverga yuboriladi', async ({ page }) => {
  const statusRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('status') === 'PENDING');
  const statusFilter = page.getByRole('combobox');
  await statusFilter.click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'Kutilmoqda' }).click();
  await statusRequest;
  await expect(page.getByText('Madina Karimova')).toBeVisible();
  await expect(page.getByText('Ali Valiyev')).toHaveCount(0);

  await page.getByRole('button', { name: 'Tozalash' }).click();
  const dateRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('dateFrom') === '2026-08-01');
  await page.getByLabel('Boshlanish sanasi').fill('2026-08-01');
  await dateRequest;
  await expect(page.getByText('Ali Valiyev')).toHaveCount(0);

  const searchRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('search') === '14');
  await page.getByPlaceholder('Order ID, sales order ID yoki xaridor ismi...').fill('14');
  await searchRequest;
  await expect(page.getByRole('row').filter({ hasText: '#14' })).toBeVisible();
});

test('TC4: status PATCH orqali CONFIRMED ga yangilanadi', async ({ page }) => {
  const api = await mockOrders(page);
  await page.reload();
  await page.getByRole('button', { name: '#13 buyurtmani ko‘rish' }).click();
  const drawer = page.getByRole('dialog', { name: 'Buyurtma #13' });
  const statusSelect = drawer.locator('.ant-select').last().getByRole('combobox');
  await statusSelect.click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'Tasdiqlangan' }).click();
  await drawer.getByRole('button', { name: 'Statusni saqlash' }).click();

  await expect(page.getByText('Buyurtma statusi yangilandi')).toBeVisible();
  expect(api.getUpdateId()).toBe('32');
  expect(api.getUpdateBody()).toEqual({ status: 'CONFIRMED' });
  expect(api.getAuthorization()).toBe('Bearer e2e.access.token');
  await expect(drawer).toContainText('Tasdiqlangan');
  await expect(page.getByRole('button', { name: /o‘chirish/i })).toHaveCount(0);
});

test('TC3: Elchi status timeline va tracking link ko‘rsatiladi', async ({ page }) => {
  await page.getByRole('button', { name: '#12 buyurtmani ko‘rish' }).click();
  const drawer = page.getByRole('dialog', { name: 'Buyurtma #12' });
  const timeline = drawer.getByLabel('Elchi status timeline');
  await expect(timeline).toContainText('Buyurtma qabul qilindi');
  await expect(timeline).toContainText('Elchi jo‘natmasi yaratildi');
  await expect(timeline).toContainText('Kuryer yo‘lda');
  await expect(timeline).toContainText('Yetkazildi');
  await expect(timeline).toContainText('Jo‘natma #987');
  await expect(timeline.getByRole('link', { name: 'Elchi’da kuzatish' })).toHaveAttribute('href', 'https://elchi.uz/track/987');
});
