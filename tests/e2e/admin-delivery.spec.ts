import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const admin = { id: 'delivery-admin', role: 'ADMIN', name: 'Delivery Admin', phone: '+998901234567', isActive: true, isDeleted: false } as const;

const created = { id: '9', salesOrderId: '9', shopId: '4', elchiMarketId: '142', shipmentId: '1251131', trackingUrl: 'https://elchi.uz/track/1251131', status: 'SHIPMENT_CREATED', subtotal: 45000, deliveryFee: 0, codAmount: 45000, orderStatus: 'CONFIRMED', paymentMethod: 'cod', buyerName: 'Nodira', createdAt: '2026-09-17T10:00:00.000Z', updatedAt: '2026-09-17T11:00:00.000Z' };
const stuck = { ...created, id: '12', salesOrderId: '12', shopId: '7', shipmentId: null, trackingUrl: null, status: 'CONFIRMED', buyerName: 'Aziz', codAmount: 120000 };
const webhook = { eventId: 'evt_received_1', shipmentId: '1251131', sellerOrderId: '9', status: 'RECEIVED', occurredAt: '2026-09-18T09:00:00.000Z', processedAt: '2026-09-18T09:00:01.000Z', payload: { event: 'order.received', shipment_id: '1251131' } };

async function mockDelivery(page: Page, shipmentRequests: Record<string, string>[] = []) {
  await page.route('**/api/v1/admin/integration/shipments**', async (route) => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams);
    shipmentRequests.push(query);
    const items = query.shipmentState === 'missing' ? [stuck] : query.shipmentState === 'created' ? [created] : [created, stuck];
    await route.fulfill({ json: { data: { items, total: items.length, page: 1, limit: Number(query.limit ?? 20), totalPages: 1 } } });
  });
  await page.route('**/api/v1/admin/integration/webhooks**', (route) => route.fulfill({ json: { data: { items: [webhook], total: 1, page: 1, limit: 20, totalPages: 1 } } }));
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => { throw error; });
  await installAuthenticatedSession(page, admin);
});

test('TC3: posilkalar va Elchi’ga topshirilmagan buyurtmalar bir ro‘yxatda ko‘rinadi', async ({ page }) => {
  const requests: Record<string, string>[] = [];
  await mockDelivery(page, requests);
  await page.goto('/admin/delivery');

  await expect(page.getByRole('heading', { name: 'Yetkazib berish (Elchi)' })).toBeVisible();
  const createdRow = page.getByRole('row').filter({ hasText: 'Nodira' });
  await expect(createdRow).toContainText('#1251131');
  await expect(createdRow.getByRole('link', { name: 'Kuzatish' })).toHaveAttribute('href', 'https://elchi.uz/track/1251131');
  const stuckRow = page.getByRole('row').filter({ hasText: 'Aziz' });
  await expect(stuckRow).toContainText('Posilka yo‘q');
  // "Topshirilmagan" soni alohida so‘rov bilan olinadi va doim ko‘rinadi.
  await expect(page.getByText('Topshirilmagan (1)')).toBeVisible();
  expect(requests).toContainEqual({ page: '1', limit: '20', shipmentState: 'all' });
  expect(requests).toContainEqual({ page: '1', limit: '1', shipmentState: 'missing' });

  await page.getByText('Topshirilmagan (1)').click();
  await expect.poll(() => requests.at(-1)).toEqual({ page: '1', limit: '20', shipmentState: 'missing' });
  await expect(page.getByRole('alert')).toContainText('buyurtmam qani');
  await expect(page.getByRole('row').filter({ hasText: 'Nodira' })).toHaveCount(0);

  await page.getByRole('button', { name: '#12 buyurtmani ochish' }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/12$/);
});

test('TC5: qotib qolgan buyurtma do‘konini Elchi’da qayta ro‘yxatdan o‘tkazish', async ({ page }) => {
  await mockDelivery(page);
  const calls: string[] = [];
  await page.route('**/api/v1/admin/integration/shops/*/reprovision', async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    const failed = calls.length > 1;
    await route.fulfill({ json: { data: failed
      ? { shopId: '7', elchiMarketId: '150', status: 'failed', reprovisioned: false, error: 'Elchi API 503' }
      : { shopId: '7', elchiMarketId: '150', status: 'done', reprovisioned: true, error: null } } });
  });
  await page.goto('/admin/delivery');
  // Posilkasi bor qatorda bu amal kerak emas.
  await expect(page.getByRole('button', { name: '#4 do‘konni Elchi’da qayta ro‘yxatdan o‘tkazish' })).toHaveCount(0);

  const action = page.getByRole('button', { name: '#7 do‘konni Elchi’da qayta ro‘yxatdan o‘tkazish' });
  await action.click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.ant-message')).toContainText('Do‘kon Elchi’da yangilandi (market #150)');
  expect(calls).toEqual(['/api/v1/admin/integration/shops/7/reprovision']);

  // Backend 200 bilan `status: failed` qaytarsa ham admin xatoni ko‘radi.
  await action.click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.ant-message')).toContainText('Elchi’ga yuborib bo‘lmadi: Elchi API 503');
});

test('TC4: webhook tarixi payload bilan ko‘rinadi', async ({ page }) => {
  await mockDelivery(page);
  await page.goto('/admin/delivery?tab=webhooks');

  const row = page.getByRole('row').filter({ hasText: 'evt_received_1' });
  await expect(row).toContainText('#1251131');
  await expect(row).toContainText('#9');
  await row.getByRole('button', { name: 'Ko‘rish' }).click();
  const dialog = page.getByRole('dialog', { name: 'evt_received_1 webhook xabari' });
  await expect(dialog).toContainText('"event": "order.received"');
});

for (const width of [1440, 375]) {
  test(`yetkazib berish sahifasi ${width}px ekranda sig‘adi`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockDelivery(page);
    await page.goto('/admin/delivery');
    // Tor ekranda xaridor ustuni yashiriladi — qator posilka holati bo‘yicha topiladi.
    await expect(page.getByRole('row').filter({ hasText: 'Posilka yo‘q' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Jadval sahifani kengaytirib qirqilib qolmaydi: oxirgi ustun gorizontal skroll bilan yetib boriladi.
    const action = page.getByRole('button', { name: '#7 do‘konni Elchi’da qayta ro‘yxatdan o‘tkazish' });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
  });
}
