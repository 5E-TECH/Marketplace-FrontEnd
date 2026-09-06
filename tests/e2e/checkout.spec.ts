import { expect, test } from '@playwright/test';
import { seedAccessToken, TEST_ACCESS_TOKEN } from './support/auth';

test('BUYER buyurtma yaratadi va COD buyurtmani tasdiqlaydi', async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '9', role: 'BUYER', name: 'Xaridor', phone: '+998901234567', email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false } }) }));
  let checkoutBody: unknown;
  let idempotencyKey = '';
  let authorization = '';
  await page.route('**/api/v1/checkout', async (route) => {
    checkoutBody = route.request().postDataJSON();
    idempotencyKey = route.request().headers()['idempotency-key'] ?? '';
    authorization = route.request().headers().authorization ?? '';
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { orderId: '77' } }) });
  });
  let confirmedOrderId = '';
  await page.route('**/api/v1/checkout/*/confirm', async (route) => {
    confirmedOrderId = route.request().url().split('/').at(-2) ?? '';
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: '77', status: 'CONFIRMED' } }) });
  });

  await page.goto('/checkout');
  await page.getByLabel('Viloyat ID').fill('1');
  await page.getByLabel('Tuman ID').fill('2');
  await page.getByLabel('To‘liq manzil').fill('Toshkent shahri');
  await page.getByRole('button', { name: 'Buyurtma yaratish' }).click();

  await expect(page.getByText('Buyurtma ID: #77')).toBeVisible();
  expect(checkoutBody).toEqual({ paymentMethod: 'COD', address: { regionId: '1', districtId: '2', address: 'Toshkent shahri', whereDeliver: 'ADDRESS' } });
  expect(idempotencyKey.length).toBeGreaterThan(10);
  expect(authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);

  await page.getByRole('button', { name: 'COD buyurtmani tasdiqlash' }).click();
  await expect(page.getByText('COD buyurtma tasdiqlandi')).toBeVisible();
  expect(confirmedOrderId).toBe('77');
});
