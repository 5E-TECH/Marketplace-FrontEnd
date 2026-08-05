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
