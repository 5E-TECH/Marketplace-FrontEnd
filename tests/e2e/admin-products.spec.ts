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

// Backend asosiy rasmni ko'pincha faqat `images` da qaytaradi (`imageUrl: null`).
const galleryImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='orange'/%3E%3C/svg%3E";

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }),
  }));
  // Jadval do'kon va kategoriya nomini ID bo'yicha alohida so'raydi.
  await page.route(/\/api\/v1\/admin\/shops\/5$/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: '5', ownerUserId: '42', name: 'Texno Market', status: 'ACTIVE', stats: {} } }),
  }));
  await page.route('**/api/v1/admin/categories', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: '9', name: 'Elektronika', children: [{ id: '1', name: 'Smartfonlar', parentId: '9', children: [] }] }] }),
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
  const productRow = page.getByRole('row').filter({ hasText: 'iPhone 16 Pro' });
  await expect(productRow).toContainText('Texno Market');
  await expect(productRow).toContainText('Smartfonlar');
  await expect(productRow).not.toContainText('#5');
  await expect(page.getByText('Add Product moderation')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => requestedUrl).toContain('/api/v1/admin/products?page=1&limit=10');

  await page.getByPlaceholder('Nomi yoki slug bo‘yicha qidiring...').fill('iphone-16');
  await expect.poll(() => requestedUrl).toContain('search=iphone-16');
  await expect(page.getByText('Jami 1 ta mahsulot')).toBeVisible();
  await page.getByPlaceholder('Nomi yoki slug bo‘yicha qidiring...').clear();
  await expect(page.getByTitle('3')).toBeVisible();
  await page.getByTitle('3').click();
  await expect.poll(() => requestedUrl).toContain('page=3');
  await expect(page.getByText('Test mahsulot 21')).toBeVisible();
});

test('mahsulot detail page barcha muhim fieldlarni va suspend/reactivate amallarini ko‘rsatadi', async ({ page }) => {
  let blocked = false;
  let hidden = 0;
  let shown = 0;
  let hideBody: unknown;
  await page.route('**/api/v1/admin/products**', async route => {
    const url = route.request().url();
    if (url.endsWith('/12/hide')) {
      hideBody = route.request().postDataJSON();
      blocked = true;
      hidden += 1;
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      return;
    }
    if (url.endsWith('/12/reactivate')) {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postData()).toBeFalsy();
      blocked = false;
      shown += 1;
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

  await page.getByRole('button', { name: 'Yashirish' }).click();
  await page.getByRole('dialog').getByLabel('Yashirish sababi').fill('Marketplace qoidalariga mos emas');
  await page.getByRole('dialog').getByRole('button', { name: 'Yashirish' }).click();
  await expect.poll(() => hidden).toBe(1);
  expect(hideBody).toEqual({ reason: 'Marketplace qoidalariga mos emas' });
  await expect(page.getByRole('button', { name: 'Ko‘rsatish' })).toBeVisible();

  await page.getByRole('button', { name: 'Ko‘rsatish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ko‘rsatish' }).click();
  await expect.poll(() => shown).toBe(1);
  await expect(page.getByRole('button', { name: 'Yashirish' })).toBeVisible();
});

test('rasm faqat images massivida kelsa ham jadvalda ko‘rinadi', async ({ page }) => {
  await page.route('**/api/v1/admin/products**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [{ ...baseProduct, imageUrl: null, images: [galleryImage], isBlocked: false }], total: 1, page: 1, limit: 10, totalPages: 1 } }),
  }));
  await page.goto('/admin/products');
  const row = page.getByRole('row').filter({ hasText: 'iPhone 16 Pro' });
  await expect(row.locator(`img[src="${galleryImage}"]`)).toHaveCount(1);
});

test('detail sahifa ixcham: muqova images’dan, ID o‘rniga nomlar, takroriy maydonlarsiz', async ({ page }) => {
  await page.route('**/api/v1/admin/products**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { ...baseProduct, imageUrl: null, images: [galleryImage], isBlocked: false } }),
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/products/12');
  const detailPage = page.getByTestId('detail-page');
  await expect(detailPage.getByRole('heading', { name: 'iPhone 16 Pro' })).toBeVisible();
  // Hero avatari va galereya: muqova images[0] dan olinadi.
  await expect(detailPage.locator(`img[src="${galleryImage}"]`)).toHaveCount(2);
  await expect(detailPage).toContainText('Smartfonlar');
  await expect(detailPage).toContainText('Texno Market');
  for (const duplicate of ['Mahsulot ID', 'Nomi', 'Slug', 'Kategoriya ID', 'Do‘kon ID', 'Moderatsiya holati']) {
    await expect(detailPage.getByText(duplicate, { exact: true })).toHaveCount(0);
  }
  // 1440px: asosiy ma'lumotlar 3 ustunda — birinchi uch maydon bir qatorda.
  const tops = await Promise.all(['Kategoriya', 'Do‘kon', 'Sotuvchi ID'].map(async (label) => (await detailPage.getByText(label, { exact: true }).boundingBox())?.y ?? -1));
  expect(Math.min(...tops)).toBeGreaterThan(0);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);

  // 390px: sarlavha va amal tugmasi orasida bo'sh joy qolmaydi.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Yashirish' })).toBeVisible();
  const titleBox = await page.getByRole('heading', { name: 'Mahsulot tafsilotlari' }).boundingBox();
  const actionBox = await page.getByRole('button', { name: 'Yashirish' }).boundingBox();
  expect(actionBox!.y - (titleBox!.y + titleBox!.height)).toBeLessThan(80);
});
