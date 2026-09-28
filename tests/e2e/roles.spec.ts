import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, operatorUser } from './support/auth';

/**
 * Backend'da kabinet endpointlarining ko'pi @Roles(SELLER), buyurtma va
 * jo'natmalar esa @Roles(SELLER, OPERATOR). Frontend shu chegarani takrorlaydi:
 * operator yopiq bo'limni ko'rmaydi va unga kira olmaydi.
 */
test.describe('OPERATOR roli', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedSession(page, operatorUser);
    await page.route('**/api/v1/seller/orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      });
    });
  });

  test('admin URL ochilsa operator o‘ziga ochiq birinchi bo‘limga yo‘naltiriladi', async ({ page }) => {
    await page.goto('/admin/overview');
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole('heading', { name: 'Buyurtmalar' })).toBeVisible();
  });

  test('menyuda faqat ochiq bo‘limlar ko‘rinadi', async ({ page }) => {
    await page.goto('/orders');
    const sidebar = page.getByRole('complementary');

    await expect(
      sidebar.getByRole('menuitem', { name: 'Buyurtmalar' }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('menuitem', { name: 'Yetkazib berish' }),
    ).toBeVisible();

    for (const hidden of ['Mahsulotlar', 'Omborlar', 'Qoldiq', 'Do‘kon profili']) {
      await expect(
        sidebar.getByRole('menuitem', { name: hidden }),
      ).toHaveCount(0);
    }
  });

  test('yopiq bo‘limga kirsa ruxsat yo‘q holati chiqadi', async ({ page }) => {
    await page.goto('/products');

    await expect(page.getByText('Bu bo‘lim sizga ochiq emas')).toBeVisible();
    // Mahsulot ro'yxati so'rovi umuman yuborilmaydi.
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('ochiq bo‘limga qaytarish tugmasi ishlaydi', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Ochiq bo‘limga o‘tish' }).click();

    await expect(page).toHaveURL(/\/orders$/);
  });

  test('operator posilka yorlig‘ini chop etadi', async ({ page }) => {
    const labelIds: string[] = [];
    const shipped = {
      id: '31', salesOrderId: '12', buyerName: 'Ali Valiyev', subtotal: 450000, codAmount: 450000,
      status: 'ON_THE_ROAD', elchiShipmentId: '987', trackingUrl: null, itemsCount: 2, createdAt: '2026-07-30T09:00:00.000Z',
    };
    await page.route('**/api/v1/seller/orders**', (route) => route.fulfill({
      json: { data: { items: [shipped], total: 1, page: 1, limit: 20, totalPages: 1 } },
    }));
    await page.route('**/api/v1/seller/orders/31/label', (route) => {
      labelIds.push('31');
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4 operator') });
    });
    await page.goto('/orders');

    await page.getByRole('button', { name: '#12 buyurtmani ko‘rish' }).click();
    await page.getByRole('dialog', { name: 'Buyurtma #12' }).getByRole('button', { name: 'Yorliqni chop etish' }).click();
    await expect.poll(() => labelIds).toEqual(['31']);
  });
});

test('SELLER barcha bo‘limlarni ko‘radi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/');
  const sidebar = page.getByRole('complementary');

  for (const visible of [
    'Bosh sahifa',
    'Mahsulotlar',
    'Omborlar',
    'Qoldiq',
    'Buyurtmalar',
    'Yetkazib berish',
  ]) {
    await expect(sidebar.getByRole('menuitem', { name: visible })).toBeVisible();
  }
});

test('BUYER kabinet sahifalariga kira olmaydi va checkout mavjud emas', async ({ page }) => {
  await installAuthenticatedSession(page, { ...operatorUser, role: 'BUYER' });

  await page.goto('/profile');
  await expect(page.getByText('Seller akkaunti talab qilinadi')).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);

  await page.goto('/checkout');
  await expect(page.getByText('Sahifa topilmadi')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buyurtma yaratish' })).toHaveCount(0);
});
