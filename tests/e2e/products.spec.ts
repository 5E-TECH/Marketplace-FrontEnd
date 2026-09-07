import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const makeProduct = (index: number) => ({
  id: index === 1 ? '12' : `product-${index}`,
  name: index === 4 ? 'Noyob Kamera' : `Mahsulot ${String(index).padStart(2, '0')}`,
  slug: index === 4 ? 'noyob-kamera' : `mahsulot-${String(index).padStart(2, '0')}`,
  sku: `SKU-${String(index).padStart(2, '0')}`,
  category: 'Elektronika',
  price: index * 100_000,
  stock: index,
  status: index <= 5 ? 'LOW' : 'ACTIVE',
  imageUrl: index === 1 ? 'https://cdn.example.com/product-1.jpg' : null,
});

async function mockProductsApi(page: Page) {
  let products = Array.from({ length: 10 }, (_, index) => makeProduct(index + 1));

  await page.route('**/api/v1/products/my**', async (route) => {
    const url = new URL(route.request().url());
    const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('uz');
    const status = url.searchParams.get('status');
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 8);
    const filtered = products.filter((product) =>
      (!search || `${product.name} ${product.slug}`.toLocaleLowerCase('uz').includes(search)) &&
      (!status || product.status === status),
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items: filtered.slice((page - 1) * limit, page * limit),
          total: filtered.length,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
      }),
    });
  });
  await page.route('**/api/v1/products/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const id = route.request().url().split('/').at(-1);
    products = products.filter((product) => product.id !== id);
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/files/upload', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { url: 'https://cdn.example.com/product-image.jpg' } }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
  await mockProductsApi(page);
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Mahsulotlar' })).toBeVisible();
});

test('TC1: products pagination ishlaydi', async ({ page }) => {
  await expect(page.getByText('Mahsulot 01', { exact: true })).toBeVisible();
  await expect(page.getByText('Mahsulot 09', { exact: true })).toHaveCount(0);

  await page.getByTitle('2').click();
  await expect(page.getByText('Mahsulot 09', { exact: true })).toBeVisible();
  await expect(page.getByText('Mahsulot 01', { exact: true })).toHaveCount(0);
});

test('TC2: products search filtr ishlaydi', async ({ page }) => {
  const search = page.getByPlaceholder('Mahsulot nomi yoki slug bo‘yicha qidirish...');
  const searchRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('search') === 'noyob-kamera');
  await search.fill('noyob-kamera');
  await searchRequest;

  await expect(page.getByText('Noyob Kamera', { exact: true })).toBeVisible();
  await expect(page.getByText('Mahsulot 01', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Jami 1 ta')).toBeVisible();
});

test('status filter serverga status query yuboradi va natijani filtrlaydi', async ({ page }) => {
  const filterRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('status') === 'ACTIVE');
  const statusFilter = page.getByRole('combobox');
  await statusFilter.click();
  await statusFilter.press('ArrowDown');
  await statusFilter.press('ArrowDown');
  await statusFilter.press('Enter');
  await filterRequest;

  await expect(page.getByText('Mahsulot 06', { exact: true })).toBeVisible();
  await expect(page.getByText('Mahsulot 01', { exact: true })).toHaveCount(0);
  await expect(page.getByText('5 ta natija')).toBeVisible();
});

test('jadval backenddan kelgan cover rasmni ko‘rsatadi', async ({ page }) => {
  await expect(page.locator('img[src="https://cdn.example.com/product-1.jpg"]')).toBeVisible();
});

test('TC3: delete tasdiqlangach mahsulot ro‘yxatdan yo‘qoladi', async ({ page }) => {
  await page.getByRole('button', { name: 'Mahsulot 01 mahsulotini o‘chirish' }).click();

  const dialog = page.getByRole('dialog', { name: 'Mahsulot o‘chirilsinmi?' });
  await expect(dialog).toContainText('Mahsulot 01');
  await dialog.getByRole('button', { name: 'O‘chirish' }).click();

  await expect(page.getByText('Mahsulot o‘chirildi')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mahsulot 01', exact: true })).toHaveCount(0);
  await expect(page.getByText('Jami 9 ta')).toBeVisible();
});

test('product PATCH /products/12 orqali Bearer token bilan yangilanadi', async ({ page }) => {
  const product = {
    id: '12', shopId: '5', ownerUserId: '2', categoryId: '1',
    name: 'Eski nom', slug: 'eski-nom', description: 'Eski tavsif',
    price: 100000, oldPrice: null, imageUrl: null, images: [], attributes: {},
    hasVariants: false, stock: 4, status: 'DRAFT', isDeleted: false,
    createdAt: '', updatedAt: '', variants: [],
  };
  let method = '';
  let authorization = '';
  let requestBody: Record<string, unknown> | undefined;

  await page.route('**/api/v1/products/12', async (route) => {
    method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: product }) });
      return;
    }
    authorization = route.request().headers().authorization ?? '';
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...product, ...requestBody, updatedAt: '2026-08-11T10:00:00.000Z' } }),
    });
  });

  await page.goto('/products/12/edit');
  await page.getByLabel('Mahsulot nomi').fill('Yangi nom');
  await page.getByLabel('Narxi', { exact: true }).fill('125000');
  await page.getByLabel('Tavsif').fill('Yangilangan tavsif');
  await page.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();

  await expect(page.getByText('Mahsulot yangilandi')).toBeVisible();
  await expect(page).toHaveURL(/\/products$/);
  expect(method).toBe('PATCH');
  expect(authorization).toBe('Bearer e2e.access.token');
  expect(requestBody).toEqual({
    categoryId: '1',
    name: 'Yangi nom',
    description: 'Yangilangan tavsif',
    price: 125000,
    oldPrice: null,
    imageUrl: null,
    images: [],
    attributes: {},
    status: 'DRAFT',
  });
});

test('product DELETE /products/12 orqali Bearer token bilan o‘chiriladi', async ({ page }) => {
  let method = '';
  let authorization = '';
  await page.route('**/api/v1/products/12', async (route) => {
    method = route.request().method();
    authorization = route.request().headers().authorization ?? '';
    await route.fulfill({ status: 204 });
  });

  await page.getByRole('button', { name: 'Mahsulot 01 mahsulotini o‘chirish' }).click();
  await page.getByRole('dialog', { name: 'Mahsulot o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();

  await expect(page.getByText('Mahsulot o‘chirildi')).toBeVisible();
  expect(method).toBe('DELETE');
  expect(authorization).toBe('Bearer e2e.access.token');
});

test('product editor 8 ta rasmni 3 ustun va maksimum 3 qatorda ko‘rsatadi', async ({ page }) => {
  await page.goto('/products/new');
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await page.locator('input[type="file"]').setInputFiles(
    Array.from({ length: 8 }, (_, index) => ({
      name: `product-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: pixel,
    })),
  );

  const cards = page.locator('article[draggable="true"]');
  await expect(cards).toHaveCount(8);
  const positions = await cards.evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { left: Math.round(box.left), top: Math.round(box.top) };
    }),
  );
  const gridLeft = await page
    .locator('.ant-upload-list')
    .evaluate((element) => Math.round(element.getBoundingClientRect().left));
  expect(positions[0]?.left).toBe(gridLeft);
  expect(new Set(positions.map(({ left }) => left)).size).toBe(3);
  expect(new Set(positions.map(({ top }) => top)).size).toBe(3);
});

test('product form number inputlari bo‘sh boshlanadi va 0 yopishib qolmaydi', async ({ page }) => {
  await page.goto('/products/new');

  const price = page.getByLabel('Narxi', { exact: true });
  const oldPrice = page.getByLabel('Eski narxi', { exact: true });
  await expect(price).toHaveValue('');
  await expect(oldPrice).toHaveValue('');
  await price.fill('250000');
  await oldPrice.fill('300000');
  await expect(price).toHaveValue('250000');
  await expect(oldPrice).toHaveValue('300000');

});

test('product create yangi API contractiga mos payload yuboradi', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  let uploadContentType = '';
  let uploadBody = '';
  let uploadAuthorization = '';
  await page.route('**/api/v1/files/upload', async (route) => {
    uploadContentType = route.request().headers()['content-type'] ?? '';
    uploadAuthorization = route.request().headers().authorization ?? '';
    uploadBody = route.request().postData() ?? '';
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { url: 'https://cdn.example.com/iphone.jpg' } }),
    });
  });
  await page.route('**/api/v1/products', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 201,
        message: 'OK',
        data: {
          id: '12', shopId: '5', ownerUserId: '2', categoryId: '1',
          name: 'iPhone 16 Pro', slug: 'iphone-16-pro',
          description: 'Titanium, 256 GB', price: 14999000, oldPrice: 15999000,
          imageUrl: 'https://cdn.example.com/iphone.jpg', images: ['https://cdn.example.com/iphone.jpg'], attributes: { brand: 'Apple', storage: '256 GB' },
          hasVariants: false, status: 'DRAFT', isDeleted: false,
          createdAt: '2026-08-10T07:30:00.000Z', updatedAt: '2026-08-10T07:30:00.000Z',
        },
      }),
    });
  });
  await page.goto('/products/new');

  await page.getByLabel('Mahsulot nomi').fill('iPhone 16 Pro');
  await page.getByLabel('Narxi', { exact: true }).fill('14999000');
  await page.getByLabel('Eski narxi', { exact: true }).fill('15999000');
  await page.getByLabel('Tavsif').fill('Titanium, 256 GB');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'iphone.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Xususiyat qo‘shish' }).click();
  await page.getByPlaceholder('Masalan, Rang').fill('brand');
  await page.getByPlaceholder('Masalan, Qora').fill('Apple');
  await page.getByRole('button', { name: 'Xususiyat qo‘shish' }).click();
  await page.getByPlaceholder('Masalan, Rang').nth(1).fill('storage');
  await page.getByPlaceholder('Masalan, Qora').nth(1).fill('256 GB');
  await page.getByRole('button', { name: 'Mahsulotni yaratish' }).click();

  await expect(page.getByText('Mahsulot yaratildi')).toBeVisible();
  expect(requestBody).toEqual({
    categoryId: null,
    name: 'iPhone 16 Pro',
    description: 'Titanium, 256 GB',
    price: 14999000,
    oldPrice: 15999000,
    imageUrl: null,
    images: [],
    attributes: { brand: 'Apple', storage: '256 GB' },
    status: 'DRAFT',
  });
  expect(uploadContentType).toContain('multipart/form-data');
  expect(uploadAuthorization).toBe('Bearer e2e.access.token');
  expect(uploadBody).toContain('name="file"; filename="iphone.png"');
  expect(uploadBody).toContain('name="productId"');
  expect(uploadBody).toContain('12');
  expect(uploadBody).toContain('name="isCover"');
  expect(uploadBody).toContain('true');
});

test('variant jadvalida qo‘shish, tahrirlash va o‘chirish UI ishlaydi', async ({ page }) => {
  await page.goto('/products/new');
  await page.getByLabel('Narxi', { exact: true }).fill('120000');
  await expect(page.getByLabel('Standart variant')).toContainText('120 000 so‘m');

  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Variant qo‘shish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi variant' });
  await dialog.getByLabel('Variant nomi').fill('Qora / XL');
  await dialog.getByLabel('SKU').fill('MAS-001-QORA-XL');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();

  await expect(page.getByRole('cell', { name: 'Qora / XL', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Qora / XL variantini tahrirlash' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Variantni tahrirlash' });
  await editDialog.getByLabel('Variant nomi').fill('Oq / L');
  await editDialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByRole('cell', { name: 'Oq / L', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Oq / L variantini o‘chirish' }).click();
  await page.getByRole('button', { name: 'O‘chirish', exact: true }).click();
  await expect(page.getByText('Hali variant qo‘shilmagan')).toBeVisible();
});

test('TC1: variant qo‘shish va saqlash backendda persist qilinadi', async ({ page }) => {
  let variantBody: Record<string, unknown> | undefined;
  await page.route('**/api/v1/products/55/variants', async (route) => {
    variantBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: '8', productId: '55', ...variantBody } }) });
  });
  await page.route('**/api/v1/products', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: {
        id: '55', shopId: '5', ownerUserId: '2', categoryId: null,
        name: 'Futbolka', slug: 'futbolka', description: 'Paxtali futbolka',
        price: 120000, oldPrice: null, imageUrl: null, images: [], attributes: {},
        hasVariants: false, status: 'DRAFT', isDeleted: false, createdAt: '', updatedAt: '', variants: [],
      } }),
    });
  });
  await page.goto('/products/new');
  await page.getByLabel('Mahsulot nomi').fill('Futbolka');
  await page.getByLabel('Narxi', { exact: true }).fill('120000');
  await page.getByLabel('Tavsif').fill('Paxtali futbolka');
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Variant qo‘shish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi variant' });
  await dialog.getByLabel('Variant nomi').fill('Qora / XL');
  await dialog.getByLabel('SKU').fill('FUT-QORA-XL');
  await dialog.getByLabel('Eski narxi').fill('150000');
  await dialog.getByLabel('Shtrix-kod').fill('4780012345678');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await page.getByRole('button', { name: 'Mahsulotni yaratish' }).click();

  await expect(page.getByText('Mahsulot yaratildi')).toBeVisible();
  expect(variantBody).toEqual({
    sku: 'FUT-QORA-XL', name: 'Qora / XL', attributes: {}, price: 120000,
    oldPrice: 150000, barcode: '4780012345678', imageUrl: null, isActive: true,
  });
});

test('TC2: variant o‘chirish va saqlashdan keyin backenddan yo‘qoladi', async ({ page }) => {
  let deletedVariantId: string | undefined;
  const product = {
    id: '55', shopId: '5', ownerUserId: '2', categoryId: null,
    name: 'Futbolka', slug: 'futbolka', description: 'Paxtali futbolka',
    price: 120000, oldPrice: null, imageUrl: null, images: [], attributes: {},
    hasVariants: true, status: 'DRAFT', isDeleted: false, createdAt: '', updatedAt: '',
    variants: [{
      id: '8', productId: '55', sku: 'FUT-QORA-XL', name: 'Qora / XL',
      attributes: {}, price: 120000, oldPrice: null, barcode: null,
      imageUrl: null, isActive: true,
    }],
  };
  await page.route('**/api/v1/products/55/variants/8', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    deletedVariantId = '8';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '8', deleted: true } }) });
  });
  await page.route('**/api/v1/products/55', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: product }) });
      return;
    }
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: product }) });
      return;
    }
    await route.fallback();
  });

  await page.goto('/products/55/edit');
  await page.getByRole('button', { name: 'Qora / XL variantini o‘chirish' }).click();
  await page.getByRole('button', { name: 'O‘chirish', exact: true }).click();
  await expect(page.getByText('Hali variant qo‘shilmagan')).toBeVisible();
  await page.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();

  await expect(page.getByText('Mahsulot yangilandi')).toBeVisible();
  expect(deletedVariantId).toBe('8');
});

test('TC3: variantsiz mahsulotda standart default ko‘rsatiladi', async ({ page }) => {
  await page.goto('/products/new');
  await page.getByLabel('Narxi', { exact: true }).fill('120000');

  const defaultVariant = page.getByLabel('Standart variant');
  await expect(defaultVariant).toContainText('DEFAULT');
  await expect(defaultVariant).toContainText('120 000 so‘m');
  await expect(page.getByRole('button', { name: 'Variant qo‘shish' })).toHaveCount(0);
});

test('kategoriya ro‘yxatdan nomi bo‘yicha tanlanadi va POST /products ga ID sifatida ketadi', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;

  await page.route('**/api/v1/products', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 201,
        message: 'OK',
        data: {
          id: '77', shopId: '5', ownerUserId: '2', categoryId: '2',
          name: 'Galaxy S25', slug: 'galaxy-s25', description: 'Snapdragon, 256 GB',
          price: 9500000, oldPrice: null, imageUrl: null, images: [], attributes: {},
          hasVariants: false, status: 'DRAFT', isDeleted: false,
          createdAt: '2026-09-07T07:30:00.000Z', updatedAt: '2026-09-07T07:30:00.000Z',
        },
      }),
    });
  });

  await page.goto('/products/new');
  await page.getByLabel('Mahsulot nomi').fill('Galaxy S25');
  await page.getByLabel('Narxi', { exact: true }).fill('9500000');
  await page.getByLabel('Tavsif').fill('Snapdragon, 256 GB');

  // Sotuvchi raqam yozmaydi — kategoriya nomini ro'yxatdan tanlaydi.
  await page.getByLabel('Kategoriya').click();
  await page.getByRole('treeitem', { name: 'Smartfonlar' }).click();
  await expect(page.getByTitle('Smartfonlar', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Mahsulotni yaratish' }).click();

  await expect(page.getByText('Mahsulot yaratildi')).toBeVisible();
  expect(requestBody?.categoryId).toBe('2');
});
