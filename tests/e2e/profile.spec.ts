import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, TEST_ACCESS_TOKEN } from './support/auth';

const shop = {
  id: '15', ownerUserId: '42', name: 'Dilshod Market', slug: 'dilshod-market-1234567',
  status: 'ACTIVE', description: 'Telefon va elektronika mahsulotlari',
  logoUrl: 'https://cdn.example.com/logo.png', bannerUrl: 'https://cdn.example.com/banner.png',
  phone: '+998901234567', regionId: '1', districtId: '10',
  address: 'Toshkent shahri, Chilonzor tumani', rating: 0, ordersCount: 0,
};

test('profilning barcha editable maydonlarini tahrirlaydi', async ({ page }) => {
  await installAuthenticatedSession(page);
  let requestBody: unknown;
  let authorization = '';

  await page.route('**/api/v1/sellers/me', async (route) => {
    if (route.request().method() === 'PATCH') {
      requestBody = route.request().postDataJSON();
      authorization = route.request().headers().authorization ?? '';
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...shop, ...(requestBody as object | undefined) } }),
    });
  });

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: shop.name })).toBeVisible();
  await page.getByRole('button', { name: 'Tahrirlash' }).click();

  const dialog = page.getByRole('dialog', { name: 'Profilni tahrirlash' });
  await expect(dialog.getByLabel('Do‘kon nomi')).toHaveValue(shop.name);
  await expect(dialog.getByLabel('Telefon')).toHaveValue(shop.phone);
  await expect(dialog.getByLabel('Tavsif')).toHaveValue(shop.description);
  await expect(dialog.getByLabel('Logo URL')).toHaveCount(0);
  await expect(dialog.getByLabel('Banner URL')).toHaveCount(0);
  await dialog.getByLabel('Do‘kon nomi').fill('Yangi Dilshod Market');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByText('Profil yangilandi')).toBeVisible();
  expect(requestBody).toEqual({
    name: 'Yangi Dilshod Market', description: shop.description,
    phone: shop.phone, regionId: shop.regionId, districtId: shop.districtId,
    address: shop.address,
  });
  expect(authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Yangi Dilshod Market' })).toBeVisible();
});
