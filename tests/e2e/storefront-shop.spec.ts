import { expect, test, type Page } from '@playwright/test';

const shop = {
  id: '15', ownerUserId: '42', name: 'Ali Market', slug: 'ali-market', status: 'ACTIVE',
  description: 'Telefon va aksessuarlar do‘koni', logoUrl: 'https://cdn.example.com/ali-logo.png',
  bannerUrl: 'https://cdn.example.com/ali-banner.jpg', phone: '+998901234567', regionId: '1',
  districtId: '10', address: 'Toshkent', rating: 4.8, ordersCount: 327,
};

function product(id: string, shopId: string, name: string, price: number) {
  return {
    id, shopId, ownerUserId: '42', categoryId: '7', name, slug: name.toLowerCase().replaceAll(' ', '-'),
    description: `${name} tavsifi`, price, oldPrice: price + 100000, imageUrl: null, images: [],
    attributes: {}, hasVariants: false, status: 'ACTIVE', isBlocked: false, rating: 4.7,
    createdAt: '2026-09-10T08:00:00.000Z', updatedAt: '2026-09-10T08:00:00.000Z',
    shop, category: { id: '7', name: 'Smartfonlar', slug: 'smartfonlar', parentId: null, iconUrl: null }, variants: [],
  };
}

async function mockCategories(page: Page) {
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: { data: [
    { id: '7', name: 'Smartfonlar', slug: 'smartfonlar', parentId: null, iconUrl: null, sortOrder: 1, isActive: true, children: [] },
  ] } }));
}

test('TC1: do‘kon nomi, logotipi va tavsifi ko‘rinadi', async ({ page }, testInfo) => {
  await mockCategories(page);
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ json: { data: {
    shop,
    products: {
      items: [
        product('1', '15', 'iPhone 16 Pro', 14999000),
        product('2', '15', 'AirPods Pro', 2999000),
        product('foreign', '88', 'Boshqa do‘kon mahsuloti', 1000),
      ], total: 3, page: 1, limit: 12, totalPages: 1,
    },
  } } }));

  await page.goto('/dokon/ali-market');
  await expect(page.getByRole('heading', { level: 1, name: 'Ali Market' })).toBeVisible();
  await expect(page.getByLabel('Ali Market logotipi')).toBeVisible();
  await expect(page.getByText('Telefon va aksessuarlar do‘koni')).toBeVisible();
  await expect(page.getByText('4.8')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('storefront-shop-desktop.png'), fullPage: true });
});

test('TC2: faqat o‘sha do‘konning mahsulotlari chiqadi', async ({ page }) => {
  await mockCategories(page);
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ json: { data: {
    shop,
    products: {
      items: [
        product('1', '15', 'iPhone 16 Pro', 14999000),
        product('2', '15', 'AirPods Pro', 2999000),
        product('foreign', '88', 'Boshqa do‘kon mahsuloti', 1000),
      ], total: 3, page: 1, limit: 12, totalPages: 1,
    },
  } } }));
  await page.goto('/dokon/ali-market');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByText('iPhone 16 Pro')).toBeVisible();
  await expect(page.getByText('AirPods Pro')).toBeVisible();
  await expect(page.getByText('Boshqa do‘kon mahsuloti')).toHaveCount(0);
});

test('rasm faqat images massivida kelsa ham mahsulot kartasida ko‘rinadi', async ({ page }) => {
  const image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='teal'/%3E%3C/svg%3E";
  await mockCategories(page);
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ json: { data: {
    shop,
    products: { items: [{ ...product('1', '15', 'iPhone 16 Pro', 14999000), images: [image] }], total: 1, page: 1, limit: 12, totalPages: 1 },
  } } }));
  await page.goto('/dokon/ali-market');
  await expect(page.getByRole('img', { name: 'iPhone 16 Pro' })).toHaveAttribute('src', image);
});

test('qidiruv, kategoriya, narx, saralash va pagination backend querylariga ulanadi', async ({ page }) => {
  await mockCategories(page);
  const requests: URL[] = [];
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({ json: { data: { shop, products: {
      items: [product('1', '15', 'iPhone 16 Pro', 14999000)], total: 25,
      page: Number(new URL(route.request().url()).searchParams.get('page') ?? 1), limit: 12, totalPages: 3,
    } } } });
  });

  await page.goto('/dokon/ali-market');
  await page.getByLabel('Do‘kondan mahsulot qidiring...').fill('iphone');
  await expect.poll(() => requests.some((url) => url.searchParams.get('search') === 'iphone')).toBe(true);
  await page.getByLabel('Barcha kategoriyalar').click();
  await page.locator('.ant-select-dropdown:visible').getByText('Smartfonlar').click();
  await page.getByLabel('Saralash').click();
  await page.locator('.ant-select-dropdown:visible').getByText('Narxi: arzonidan').click();
  await page.getByLabel('Minimal narx').fill('1000000');
  await page.getByLabel('Maksimal narx').fill('20000000');
  await page.getByRole('button', { name: 'Qo‘llash' }).click();
  await expect.poll(() => requests.some((url) =>
    url.searchParams.get('search') === 'iphone'
      && url.searchParams.get('categoryId') === '7'
      && url.searchParams.get('sort') === 'price:asc'
      && url.searchParams.get('minPrice') === '1000000'
      && url.searchParams.get('maxPrice') === '20000000',
  )).toBe(true);
  await page.getByTitle('2').click();
  await expect.poll(() => requests.some((url) => url.searchParams.get('page') === '2')).toBe(true);
});

test('ulashish meta teglari do‘kon nomi va logotipidan tuziladi', async ({ page }) => {
  await mockCategories(page);
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ json: { data: {
    shop, products: { items: [], total: 0, page: 1, limit: 12, totalPages: 1 },
  } } }));
  await page.goto('/dokon/ali-market');

  await expect(page).toHaveTitle('Ali Market — MarketHub');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Ali Market');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shop.logoUrl);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/dokon\/ali-market$/);
});

for (const scenario of [
  { name: 'topilmagan', status: 404, body: { message: 'Shop not found', errorCode: 'NOT_FOUND' } },
  { name: 'faol bo‘lmagan', status: 200, body: { data: { shop: { ...shop, status: 'SUSPENDED' }, products: { items: [], total: 0, page: 1, limit: 12, totalPages: 1 } } } },
]) {
  test(`TC3: ${scenario.name} do‘kon uchun tushunarli xabar chiqadi`, async ({ page }) => {
    await mockCategories(page);
    await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ status: scenario.status, json: scenario.body }));
    await page.goto('/dokon/ali-market');
    await expect(page.getByText('Do‘kon mavjud emas')).toBeVisible();
    await expect(page.getByText('Do‘kon topilmadi yoki hozircha faol emas.')).toBeVisible();
  });
}

test('TC4: mahsulot sahifasidagi do‘kon nomidan do‘kon sahifasiga o‘tiladi', async ({ page }, testInfo) => {
  const selectedProduct = product('1', '15', 'iPhone 16 Pro', 14999000);
  await mockCategories(page);
  await page.route('**/api/v1/storefront/products/1', (route) => route.fulfill({ json: { data: selectedProduct } }));
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ json: { data: {
    shop, products: { items: [selectedProduct], total: 1, page: 1, limit: 12, totalPages: 1 },
  } } }));

  await page.goto('/mahsulot/1');
  await expect(page.getByRole('heading', { level: 1, name: 'iPhone 16 Pro' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('storefront-product-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Ali Market do‘koniga o‘tish' }).click();
  await expect(page).toHaveURL(/\/dokon\/ali-market$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ali Market' })).toBeVisible();
});

test('do‘kon sahifasi 375px ekranda gorizontal overflow bermaydi', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockCategories(page);
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => route.fulfill({ json: { data: {
    shop: { ...shop, logoUrl: null, bannerUrl: null }, products: { items: [product('1', '15', 'iPhone 16 Pro', 14999000)], total: 1, page: 1, limit: 12, totalPages: 1 },
  } } }));
  await page.goto('/dokon/ali-market');
  await expect(page.getByRole('heading', { level: 1, name: 'Ali Market' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('storefront-shop-mobile.png'), fullPage: true });
});

test('URL’dagi noma’lum sort qiymati backendga yuborilmaydi va sahifa ochiladi', async ({ page }) => {
  await mockCategories(page);
  const sorts: Array<string | null> = [];
  await page.route('**/api/v1/storefront/shops/ali-market**', (route) => {
    sorts.push(new URL(route.request().url()).searchParams.get('sort'));
    return route.fulfill({ json: { data: { shop, products: { items: [product('1', '15', 'iPhone 16 Pro', 14999000)], total: 1, page: 1, limit: 12, totalPages: 1 } } } });
  });
  await page.goto('/dokon/ali-market?sort=foo;drop');
  await expect(page.getByText('iPhone 16 Pro')).toBeVisible();
  expect(sorts.every((value) => value === null || value === 'createdAt:desc')).toBe(true);
});
