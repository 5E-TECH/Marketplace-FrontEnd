import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const shipment = (index: number) => ({
  id: `shipment-${index}`,
  salesOrderId: `SO-${100 + index}`,
  buyerName: index === 1 ? 'Aziz Karimov' : null,
  subtotal: index * 100_000,
  codAmount: index === 1 ? 250_000 : 0,
  status: index === 1 ? 'ON_THE_ROAD' : 'SHIPMENT_CREATED',
  elchiShipmentId: `ELCHI-${900 + index}`,
  trackingUrl: index === 1 ? 'https://elchi.example.com/track/901' : null,
  itemsCount: index,
  createdAt: '2026-08-01T10:00:00.000Z',
});

async function mockShipments(page: Page) {
  const calls: string[] = [];

  await page.route('**/api/v1/seller/shipments**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.search);
    const status = url.searchParams.get('status');
    const items = [shipment(1), shipment(2)].filter(
      (item) => !status || item.status === status,
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: { items, total: items.length, page: 1, limit: 20, totalPages: 1 },
      }),
    });
  });

  return calls;
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test('jo‘natmalar ro‘yxati backenddan yuklanadi va kuzatuv havolasi chiqadi', async ({
  page,
}) => {
  await mockShipments(page);
  await page.goto('/delivery');

  await expect(
    page.getByRole('heading', { name: 'Yetkazib berish' }),
  ).toBeVisible();
  await expect(page.getByText('#SO-101')).toBeVisible();
  await expect(page.getByText('ELCHI-901')).toBeVisible();
  await expect(page.getByText('Noma’lum xaridor')).toBeVisible();

  const tracking = page.getByRole('link', { name: /Kuzatish/ });
  await expect(tracking).toHaveAttribute(
    'href',
    'https://elchi.example.com/track/901',
  );
  await expect(tracking).toHaveAttribute('rel', /noopener/);
});

test('holat filtri so‘rovga status parametrini qo‘shadi', async ({ page }) => {
  const calls = await mockShipments(page);
  await page.goto('/delivery');
  await expect(page.getByText('#SO-101')).toBeVisible();

  const statusRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get('status') === 'SHIPMENT_CREATED',
  );
  await page.getByRole('combobox').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Elchi yaratildi' })
    .click();
  await statusRequest;

  await expect(page.getByText('#SO-102')).toBeVisible();
  await expect(page.getByText('#SO-101')).toHaveCount(0);
  expect(calls.some((search) => search.includes('status=SHIPMENT_CREATED'))).toBe(
    true,
  );
});

test('jo‘natma bo‘lmasa bo‘sh holat ko‘rsatiladi', async ({ page }) => {
  await page.route('**/api/v1/seller/shipments**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 },
      }),
    });
  });

  await page.goto('/delivery');
  await expect(page.getByText('Jo‘natmalar topilmadi')).toBeVisible();
});
