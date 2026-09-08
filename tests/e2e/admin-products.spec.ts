import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

const baseProduct = {
  id: '12',
  shopId: '5',
  ownerUserId: '42',
  categoryId: '1',
  name: 'iPhone 16 Pro',
  slug: 'iphone-16-pro',
  description: 'Titanium, 256 GB',
  price: 14_999_000,
  oldPrice: 15_999_000,
  imageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
  images: [],
  attributes: { brand: 'Apple', storage: '256 GB' },
  hasVariants: true,
  status: 'ACTIVE',
  rating: 4.75,
  createdAt: '2026-08-14T10:00:00.000Z',
  updatedAt: '2026-09-01T11:30:00.000Z',
  variants: [{ id: '25', productId: '12', sku: 'IPHONE-16-BLACK-256', name: 'Qora — 256 GB', attributes: { color: 'Qora' }, price: 16_000_000, oldPrice: null, barcode: '4780012345678', imageUrl: null, isActive: true }],
};

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }),
  }));
});

test('admin mahsulotlar ro‘yxati mock popup o‘rniga backend ma’lumotlarini ko‘rsatadi', async ({ page }) => {
  let requestedUrl = '';
  const products = [baseProduct, ...Array.from({ length: 20 }, (_, index) => ({
    ...baseProduct,
    id: String(index + 13),
    name: `Test mahsulot ${index + 2}`,
    slug: `test-mahsulot-${index + 2}`,
  }))];
  await page.route('**/api/v1/admin/products**', route => {
    const url = new URL(route.request().url());
    requestedUrl = url.toString();
    const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('uz');
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const filtered = products.filter((product) => !search || `${product.name} ${product.slug}`.toLocaleLowerCase('uz').includes(search));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { items: filtered.slice((pageNumber - 1) * limit, pageNumber * limit).map((product) => ({ ...product, isBlocked: false })), total: filtered.length, page: pageNumber, limit, totalPages: Math.ceil(filtered.length / limit) } }),
    });
  });

  await page.goto('/admin/products');

  await expect(page.getByRole('heading', { name: 'Mahsulot moderatsiyasi' })).toBeVisible();
  await expect(page.getByText('iPhone 16 Pro', { exact: true })).toBeVisible();
  await expect(page.getByText('Add Product moderation')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => requestedUrl).toContain('/api/v1/admin/products?page=1&limit=20');

  await page.getByPlaceholder('Nomi yoki slug bo‘yicha qidiring...').fill('iphone-16');
  await expect.poll(() => requestedUrl).toContain('search=iphone-16');
  await expect(page.getByText('Jami 1 ta mahsulot')).toBeVisible();
  await page.getByPlaceholder('Nomi yoki slug bo‘yicha qidiring...').clear();
  await expect(page.getByTitle('2')).toBeVisible();
  await page.getByTitle('2').click();
  await expect.poll(() => requestedUrl).toContain('page=2');
  await expect(page.getByText('Test mahsulot 21')).toBeVisible();
});

test('mahsulot detail page barcha muhim fieldlarni va suspend/reactivate amallarini ko‘rsatadi', async ({ page }) => {
  let blocked = false;
  let suspended = 0;
  let reactivated = 0;
  await page.route('**/api/v1/admin/products**', async route => {
    const url = route.request().url();
    if (url.endsWith('/12/suspend')) {
      blocked = true;
      suspended += 1;
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      return;
    }
    if (url.endsWith('/12/reactivate')) {
      blocked = false;
      reactivated += 1;
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      return;
    }
    const product = { ...baseProduct, isBlocked: blocked };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: product }) });
  });

  await page.goto('/admin/products/12');

  await expect(page.getByRole('heading', { name: 'Mahsulot tafsilotlari' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'iPhone 16 Pro' })).toBeVisible();
  await expect(page.getByText('Titanium, 256 GB')).toBeVisible();
  await expect(page.getByText('Apple')).toBeVisible();
  await expect(page.getByText('IPHONE-16-BLACK-256')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Bloklash' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bloklash' }).click();
  await expect.poll(() => suspended).toBe(1);
  await expect(page.getByRole('button', { name: 'Qayta faollashtirish' })).toBeVisible();

  await page.getByRole('button', { name: 'Qayta faollashtirish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Qayta faollashtirish' }).click();
  await expect.poll(() => reactivated).toBe(1);
  await expect(page.getByRole('button', { name: 'Bloklash' })).toBeVisible();
});
