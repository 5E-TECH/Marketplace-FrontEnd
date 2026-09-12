import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, authenticatedUser } from './support/auth';

const product = {
  id: '55', name: 'Futbolka', description: 'Paxtali futbolka', categoryId: null,
  price: 120000, oldPrice: null, status: 'DRAFT', images: [], imageUrl: null,
  attributes: {}, hasVariants: true,
  variants: [{ id: '8', productId: '55', sku: 'FUT-QORA-XL', name: 'Qora / XL',
    attributes: {}, price: 120000, oldPrice: null, barcode: '', imageUrl: null, isActive: true }],
};

test('mavjud variant tahrirlanganda ID va qoldiq bog‘lanishi saqlanadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  const calls: string[] = [];
  await page.route('**/api/v1/products/55', route => route.fulfill({ json: { data: product } }));
  await page.route('**/api/v1/products/55/variants**', route => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.fulfill({ json: { data: product.variants[0] } });
  });
  await page.goto('/products/55/edit');
  await page.getByRole('button', { name: 'Qora / XL variantini tahrirlash' }).click();
  await page.getByRole('dialog').getByLabel('Variant nomi').fill('Qora / XXL');
  await page.getByRole('dialog').getByRole('button', { name: 'Saqlash', exact: true }).click();
  await page.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();
  await expect(page).toHaveURL(/\/products$/);
  expect(calls).toEqual(['PATCH /api/v1/products/55/variants/8']);
});

for (const scenario of ['retry-server-error', 'refresh-server-error'] as const) {
  test(`${scenario}: vaqtinchalik server xatosi sessiyani yopmaydi`, async ({ page }) => {
    await installAuthenticatedSession(page);
    let calls = 0;
    await page.route('**/api/v1/auth/refresh', route => route.fulfill({
      status: scenario === 'refresh-server-error' ? 503 : 200,
      json: scenario === 'refresh-server-error' ? { message: 'Server vaqtincha ishlamayapti' } : { accessToken: 'new.token' },
    }));
    await page.route('**/api/v1/seller/orders**', route => {
      calls += 1;
      return route.fulfill({ status: calls === 1 ? 401 : 500, json: { message: 'Server xatosi' } });
    });
    await page.goto('/orders');
    await expect(page.getByRole('button', { name: /Qayta/ })).toBeVisible();
    await expect(page).toHaveURL(/\/orders$/);
    expect(await page.evaluate(() => sessionStorage.getItem('elchi_access_token'))).toBeTruthy();
  });
}

test('checkout timeoutdan keyin qayta yuborishda ayni idempotency key ishlatiladi', async ({ page }) => {
  await installAuthenticatedSession(page, { ...authenticatedUser, role: 'BUYER' });
  const keys: string[] = [];
  await page.route('**/api/v1/checkout', route => {
    keys.push(route.request().headers()['idempotency-key']);
    return route.fulfill(keys.length === 1 ? { status: 504, json: { message: 'Vaqtincha xato' } } : { json: { data: { orderId: '77' } } });
  });
  await page.goto('/checkout');
  await page.getByLabel('Viloyat ID').fill('1');
  await page.getByLabel('Tuman ID').fill('2');
  await page.getByLabel('To‘liq manzil').fill('Toshkent shahri');
  await page.getByRole('button', { name: 'Buyurtma yaratish' }).click();
  await expect(page.getByText('Vaqtincha xato')).toBeVisible();
  await page.getByRole('button', { name: 'Buyurtma yaratish' }).click();
  await expect(page.getByText('Buyurtma ID: #77')).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test('ulanmagan admin bo‘limida soxta CRUD va demo yozuvlar yo‘q', async ({ page }) => {
  await installAuthenticatedSession(page, { ...authenticatedUser, role: 'ADMIN' });
  await page.goto('/admin/brands');
  await expect(page.getByText('Bu bo‘lim hali mavjud emas')).toBeVisible();
  await expect(page.getByText('Asosiy yozuv', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tahrirlash' })).toHaveCount(0);
});
