import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const makeProduct = (index: number) => ({
  id: `product-${index}`,
  name: index === 4 ? 'Noyob Kamera' : `Mahsulot ${String(index).padStart(2, '0')}`,
  sku: `SKU-${String(index).padStart(2, '0')}`,
  category: 'Elektronika',
  price: index * 100_000,
  stock: index,
  status: index <= 5 ? 'LOW' : 'ACTIVE',
});

async function mockProductsApi(page: Page) {
  let products = Array.from({ length: 10 }, (_, index) => makeProduct(index + 1));

  await page.route('**/api/v1/products/my', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: products }),
    });
  });
  await page.route('**/api/v1/products/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const id = route.request().url().split('/').at(-1);
    products = products.filter((product) => product.id !== id);
    await route.fulfill({ status: 204 });
  });
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
  await mockProductsApi(page);
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Mahsulotlar' })).toBeVisible();
});

test('TC1: products pagination ishlaydi', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Mahsulot 01', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mahsulot 09', exact: true })).toHaveCount(0);

  await page.getByTitle('2').click();
  await expect(page.getByRole('cell', { name: 'Mahsulot 09', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mahsulot 01', exact: true })).toHaveCount(0);
});

test('TC2: products search filtr ishlaydi', async ({ page }) => {
  const search = page.getByPlaceholder('Mahsulot yoki SKU qidirish...');
  await search.fill('Noyob Kamera');

  await expect(page.getByRole('cell', { name: 'Noyob Kamera', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mahsulot 01', exact: true })).toHaveCount(0);
  await expect(page.getByText('Jami 1 ta')).toBeVisible();
});

test('TC3: delete tasdiqlangach mahsulot ro‘yxatdan yo‘qoladi', async ({ page }) => {
  await page.getByRole('button', { name: 'Mahsulot 01 amallari' }).click();
  await page.getByRole('menuitem', { name: 'O‘chirish' }).click();

  const dialog = page.getByRole('dialog', { name: 'Mahsulot o‘chirilsinmi?' });
  await expect(dialog).toContainText('Mahsulot 01');
  await dialog.getByRole('button', { name: 'O‘chirish' }).click();

  await expect(page.getByText('Mahsulot o‘chirildi')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mahsulot 01', exact: true })).toHaveCount(0);
  await expect(page.getByText('Jami 9 ta')).toBeVisible();
});
