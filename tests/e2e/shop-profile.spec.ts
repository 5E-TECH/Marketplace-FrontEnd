import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

const sellerShop = {
  id: '15',
  ownerUserId: 'seller-e2e',
  name: 'MarketHub Store',
  slug: 'markethub-store',
  status: 'ACTIVE',
  description: 'Original va sifatli mahsulotlar do‘koni',
  logoUrl: null,
  bannerUrl: null,
  phone: '+998 90 000 00 00',
  regionId: '1',
  districtId: '10',
  address: 'Toshkent shahri, Chilonzor tumani',
  rating: 4.8,
  ordersCount: 128,
};

async function mockSellerShopApi(page: Page) {
  const state: { patchBody: Record<string, unknown> | null } = {
    patchBody: null,
  };
  await page.route('**/api/v1/sellers/me', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer e2e.access.token');
    if (route.request().method() === 'PATCH') {
      state.patchBody = route.request().postDataJSON() as Record<string, unknown>;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: { ...sellerShop, ...(state.patchBody ?? {}) },
      }),
    });
  });
  return state;
}

test('do‘kon profilini read-only ko‘rish, tahrirlash va PATCH saqlash ishlaydi', async ({
  page,
}) => {
  const apiState = await mockSellerShopApi(page);
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'Do‘kon profili' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saqlash' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tahrirlash' }).click();

  await page.getByLabel('Do‘kon nomi').fill('Elchi Premium Store');

  await page.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByLabel('Do‘kon nomi')).toHaveValue('Elchi Premium Store');
  await expect(page.getByRole('button', { name: 'Tahrirlash' })).toBeVisible();
  await expect(page.getByText('Do‘kon ma’lumotlari saqlandi')).toBeVisible();
  expect(apiState.patchBody).toEqual({
    name: 'Elchi Premium Store',
    description: 'Original va sifatli mahsulotlar do‘koni',
    phone: '+998900000000',
    regionId: '1',
    districtId: '10',
    address: 'Toshkent shahri, Chilonzor tumani',
  });
});

test('joriy do‘kon ma’lumotlari API javobidan to‘ldiriladi', async ({ page }) => {
  await mockSellerShopApi(page);
  await page.goto('/shop');

  await expect(page.getByLabel('Do‘kon nomi')).toHaveValue(sellerShop.name);
  await expect(page.getByLabel('Telefon')).toHaveValue(sellerShop.phone);
  await expect(page.getByLabel('Manzil')).toHaveValue(sellerShop.address);
  await expect(page.getByLabel('Tavsif')).toHaveValue(sellerShop.description);
});

test('logo preview ko‘rinadi va save payload bilan saqlanadi', async ({ page }) => {
  const apiState = await mockSellerShopApi(page);
  await page.goto('/shop');
  await page.getByRole('button', { name: 'Tahrirlash' }).click();

  const logoChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Logo rasmini almashtirish' }).click();
  await (await logoChooser).setFiles({
    name: 'store-logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('market-logo'),
  });

  const logo = page.getByRole('img', { name: /MarketHub Store logotipi/i });
  await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.getByRole('button', { name: 'Saqlash' }).click();

  expect(apiState.patchBody?.logoUrl).toMatch(/^data:image\/png;base64,/);
  await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/);
});

test('do‘kon profili 375px ekranda horizontal overflow bermaydi', async ({
  page,
}) => {
  await mockSellerShopApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/shop');

  await expect(page.getByRole('heading', { name: 'Do‘kon profili' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test('do‘kon mavjud bo‘lmasa popup orqali yangi do‘kon yaratiladi', async ({ page }) => {
  let createBody: Record<string, unknown> | null = null;
  await page.route('**/api/v1/sellers/me', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Shop not found' }),
    });
  });
  await page.route('**/api/v1/sellers', async (route) => {
    createBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...sellerShop, ...createBody, status: 'PENDING' } }),
    });
  });

  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'Sizning do‘koningiz shu yerdan boshlanadi' })).toBeVisible();
  await page.getByRole('button', { name: 'Birinchi do‘konni yaratish' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Yangi do‘kon yaratish' })).toBeVisible();
  await dialog.getByLabel('Do‘kon nomi').fill('Yangi Seller Store');
  await dialog.getByLabel('Telefon').fill('+998901234567');
  await dialog.getByLabel('Viloyat').click();
  await page.getByText('Toshkent shahri', { exact: true }).click();
  await dialog.getByLabel('Tuman').click();
  await page.getByText('Yashnobod tumani', { exact: true }).click();
  await dialog.getByLabel('Manzil').fill('Toshkent shahri');
  await dialog.getByLabel('Do‘kon haqida').fill('Sifatli mahsulotlar do‘koni');
  await dialog.getByRole('button', { name: 'Do‘konni yaratish' }).click();

  await expect(page.getByText('Do‘kon muvaffaqiyatli yaratildi')).toBeVisible();
  expect(createBody).toMatchObject({
    name: 'Yangi Seller Store',
    phone: '+998901234567',
    address: 'Toshkent shahri',
  });
});
