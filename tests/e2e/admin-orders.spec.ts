import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

const allOrders = [
  { id: '91', orderNumber: 'A-91', buyerName: 'Ali Valiyev', buyerPhone: '+998901111111', shopId: '7', shopName: 'Ali Market', totalAmount: 250000, paymentMethod: 'cod', status: 'CONFIRMED', createdAt: '2026-09-03T10:00:00.000Z' },
  { id: '92', orderNumber: 'A-92', buyerName: 'Aziza Karimova', buyerPhone: '+998902222222', shopId: '8', shopName: 'Aziza Market', totalAmount: 120000, paymentMethod: 'online', status: 'PAID', createdAt: '2026-09-10T15:00:00.000Z' },
  { id: '93', orderNumber: 'A-93', buyerName: 'Vali Aliyev', buyerPhone: '+998903333333', shopId: '9', shopName: 'Vali Market', totalAmount: 300000, paymentMethod: 'cod', status: 'CONFIRMED', createdAt: '2026-08-01T10:00:00.000Z' },
];

test('TC1: barcha sotuvchilar buyurtmalari va jadval ustunlari ko‘rinadi', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/admin/orders**', async route => {
    const url = new URL(route.request().url());
    expect(route.request().method()).toBe('GET');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '20' });
    await route.fulfill({ json: { data: { items: allOrders, total: 3, page: 1, limit: 20, totalPages: 1 } } });
  });
  await page.goto('/admin/orders');
  for (const order of allOrders) {
    const row = page.getByRole('row').filter({ hasText: order.buyerName });
    await expect(row).toContainText(order.shopName);
    await expect(row).toContainText(order.buyerName);
    await expect(row).toContainText(order.paymentMethod.toUpperCase());
    await expect(row).toContainText('UZS');
    await expect(row).toContainText('2026');
    await expect(row.getByRole('button', { name: 'Buyurtma tafsilotlari' })).toBeVisible();
  }
  await expect(page.getByRole('checkbox')).toHaveCount(allOrders.length + 1);
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(8);
  await expect(page.getByRole('row').filter({ hasText: 'Ali Valiyev' })).toContainText('250 000 UZS');
  await expect(page.getByRole('row').filter({ hasText: 'Ali Valiyev' })).toContainText('Tasdiqlangan');
});

test('Print faqat tanlangan buyurtma yorlig‘ini backenddan oladi', async ({ page }) => {
  const labelIds: string[] = [];
  await page.route('**/api/v1/admin/orders**', async route => {
    const path = new URL(route.request().url()).pathname;
    const id = path.match(/\/admin\/orders\/(\d+)\/label$/)?.[1];
    if (id) {
      labelIds.push(id);
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4 test') });
      return;
    }
    await route.fulfill({ json: { data: { items: allOrders, total: allOrders.length, page: 1, limit: 20, totalPages: 1 } } });
  });
  await page.goto('/admin/orders');
  const printButton = page.getByRole('button', { name: 'Print' });
  await expect(printButton).toBeDisabled();
  await page.getByRole('row', { name: /Ali Valiyev/ }).getByRole('checkbox').check();
  await expect(printButton).toBeEnabled();
  await printButton.click();
  await expect.poll(() => labelIds).toEqual(['91']);
});

test('Print bir nechta tanlangan buyurtmani batch PDF endpointiga yuboradi', async ({ page }) => {
  let requestBody: unknown;
  await page.route('**/api/v1/admin/orders**', async route => {
    const request = route.request();
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/admin/orders/labels')) {
      requestBody = request.postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4 batch') });
      return;
    }
    await route.fulfill({ json: { data: { items: allOrders, total: allOrders.length, page: 1, limit: 20, totalPages: 1 } } });
  });
  await page.goto('/admin/orders');
  await page.getByRole('row', { name: /Ali Valiyev/ }).getByRole('checkbox').check();
  await page.getByRole('row', { name: /Aziza Karimova/ }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Print' }).click();
  await expect.poll(() => requestBody).toEqual({ orderIds: ['91', '92'] });
});

test('TC2: har bir filtr natijani o‘zgartiradi, birgalikda ishlaydi va tozalanadi', async ({ page }) => {
  await page.route('**/api/v1/admin/orders**', async route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('page')).toBe('1');
    const items = allOrders.filter(order =>
      (!params.has('status') || order.status === params.get('status')) &&
      (!params.has('paymentMethod') || order.paymentMethod === params.get('paymentMethod')) &&
      (!params.has('search') || Object.values(order).some(value => String(value).toLocaleLowerCase().includes(params.get('search')!.toLocaleLowerCase()))) &&
      (!params.has('dateFrom') || order.createdAt.slice(0, 10) >= params.get('dateFrom')!) &&
      (!params.has('dateTo') || order.createdAt.slice(0, 10) <= params.get('dateTo')!),
    );
    await route.fulfill({ json: { data: { items, total: items.length, page: 1, limit: 20, totalPages: 1 } } });
  });
  await page.goto('/admin/orders');
  const rows = page.locator('.ant-table-tbody > tr.ant-table-row');
  await expect(rows).toHaveCount(3);
  const choose = async (id: string, label: string) => {
    await page.locator(id).click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click();
  };
  const reset = async () => {
    await page.getByRole('button', { name: 'Tozalash', exact: true }).click();
    await expect(rows).toHaveCount(3);
  };
  await choose('#admin-order-status', 'Tasdiqlangan');
  await expect(rows).toHaveCount(2);
  await expect(page.getByText('Aziza Karimova')).toHaveCount(0);
  await choose('#admin-order-status', 'To‘langan');
  await expect(rows).toHaveCount(3);
  await expect(page.getByText('Aziza Karimova')).toBeVisible();
  await reset();
  await choose('#admin-order-payment', 'Online');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Aziza Karimova');
  await reset();
  await page.getByLabel('Qidirish').fill('Aziza');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Aziza Karimova');
  await reset();
  await page.getByLabel('Qidirish').fill('902222222');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Aziza Karimova');
  await reset();
  await page.getByLabel('Boshlanish sanasi').fill('2026-09-03');
  await page.getByLabel('Boshlanish sanasi').press('Enter');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Tugash sanasi').fill('2026-09-03');
  await page.getByLabel('Tugash sanasi').press('Enter');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Ali Valiyev');
  await choose('#admin-order-status', 'Tasdiqlangan');
  await choose('#admin-order-payment', 'COD');
  await page.getByLabel('Qidirish').fill('A-91');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Ali Valiyev');
  await reset();
  await expect(page.getByLabel('Qidirish')).toHaveValue('');
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('');
  await expect(page.getByLabel('Tugash sanasi')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Tozalash', exact: true })).toBeDisabled();
});

test('TC2: search backendga noma’lum query yubormaydi va tozalanadi', async ({ page }) => {
  let invalidSearchSent = false;
  await page.route('**/api/v1/admin/orders**', async route => {
    if (new URL(route.request().url()).searchParams.has('search')) {
      invalidSearchSent = true;
    }
    await route.fulfill({ json: { data: { items: allOrders, total: 3, page: 1, limit: 20, totalPages: 1 } } });
  });
  await page.goto('/admin/orders');
  await expect(page.getByText('Ali Valiyev')).toBeVisible();
  await page.getByLabel('Qidirish').fill('999');
  await expect(page.getByText('Buyurtmalar topilmadi')).toBeVisible();
  expect(invalidSearchSent).toBe(false);
  await expect(page.getByRole('region', { name: 'Buyurtma filtrlari' })).toBeVisible();
  await page.getByRole('button', { name: 'Tozalash', exact: true }).click();
  await expect(page.getByText('Ali Valiyev')).toBeVisible();
});

test('TC4: filtrga mos buyurtma bo‘lmasa bo‘sh holat va ishlaydigan filtrlar chiqadi', async ({ page }) => {
  await page.goto('/admin/orders');
  await page.getByLabel('Qidirish').fill('999');
  await expect(page.getByText('Buyurtmalar topilmadi')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Buyurtma filtrlari' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buyurtma tafsilotlari' })).toHaveCount(0);
});

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/admin/orders')) {
      const isBatchLabel = new URL(request.url()).pathname.endsWith('/admin/orders/labels');
      expect(request.method()).toBe(isBatchLabel ? 'POST' : 'GET');
    }
  });
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }),
  }));
  await page.route('**/api/v1/admin/orders**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } }),
  }));
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`admin orders filtrlari ${viewport.name} ekranda sig‘adi`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/admin/orders');

    const filters = page.getByRole('region', { name: 'Buyurtma filtrlari' });
    await expect(filters).toBeVisible();
    await expect(filters.getByLabel('Qidirish')).toBeVisible();
    await expect(filters.getByLabel('Boshlanish sanasi')).toBeVisible();
    await expect(filters.getByLabel('Tugash sanasi')).toBeVisible();
    const searchUi = await filters.getByLabel('Qidirish').locator('xpath=..').evaluate((element) => {
      const icon = element.querySelector('.ant-input-prefix svg');
      return {
        height: element.getBoundingClientRect().height,
        iconWidth: icon?.getBoundingClientRect().width,
        iconHeight: icon?.getBoundingClientRect().height,
      };
    });
    expect(searchUi).toEqual({ height: 42, iconWidth: 16, iconHeight: 16 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('TC3: filtrlangan buyurtmaning sub-order, item, shipment va tarixi read-only ko‘rinadi', async ({ page }) => {
  const order = { id: '91', orderNumber: 'A-91', buyerName: 'Ali Valiyev', shopId: '7', shopName: 'Ali Market', totalAmount: 250000, paymentMethod: 'cod', status: 'CONFIRMED', createdAt: '2026-09-03T10:00:00.000Z' };
  let detailRequested = false;
  await page.route('**/api/v1/admin/orders**', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('GET');
    if (/\/admin\/orders\/91$/.test(request.url())) {
      detailRequested = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        ...order,
        sellerOrders: [{ id: 'SO-501', shopId: '7', shopName: 'Ali Market', status: 'CONFIRMED', subtotal: 250000, createdAt: '2026-09-03T10:01:00.000Z', items: [{ id: 'I-1', productName: 'Simsiz quloqchin', sku: 'EAR-01', quantity: 2, unitPrice: 125000 }], shipment: { id: 'SH-9', provider: 'Elchi', status: 'ON_THE_ROAD', trackingUrl: 'https://elchi.uz/track/SH-9', createdAt: '2026-09-03T11:00:00.000Z' } }],
        payment: { id: 'PAY-8', method: 'cod', status: 'PENDING', amount: 250000 },
        history: [{ id: 'H-1', status: 'CONFIRMED', actorName: 'Super Admin', note: 'Buyurtma tasdiqlandi', createdAt: '2026-09-03T10:05:00.000Z' }],
      } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [order], total: 1, page: 1, limit: 20, totalPages: 1 } }) });
  });

  await page.goto('/admin/orders');
  await page.getByLabel('Qidirish').fill('A-91');
  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/admin/orders')
      && url.searchParams.get('page') === '1'
      && url.searchParams.get('limit') === '100'
      && url.searchParams.get('status') === 'CONFIRMED'
      && url.searchParams.get('paymentMethod') === 'cod'
      && !url.searchParams.has('search')
      && url.searchParams.get('dateFrom') === '2026-09-01'
      && url.searchParams.get('dateTo') === '2026-09-14';
  });
  await page.locator('#admin-order-status').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Tasdiqlangan' }).click();
  await page.locator('#admin-order-payment').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'COD' }).click();
  await page.getByLabel('Boshlanish sanasi').fill('2026-09-01');
  await page.getByLabel('Boshlanish sanasi').press('Enter');
  await page.getByLabel('Tugash sanasi').fill('2026-09-14');
  await page.getByLabel('Tugash sanasi').press('Enter');
  await filteredRequest;

  const row = page.getByRole('row', { name: /Ali Valiyev/ });
  await expect(row).toContainText('Ali Market');
  await expect(row).toContainText('Ali Valiyev');
  await expect(row).toContainText('250 000 UZS');
  await expect(row).toContainText('COD');

  await page.getByRole('button', { name: 'Buyurtma tafsilotlari' }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/91$/);
  await expect.poll(() => detailRequested).toBe(true);
  const detailPage = page.getByTestId('detail-page');
  await expect(detailPage).toContainText('Ali Valiyev');
  await expect(detailPage.getByRole('heading', { name: 'Sub-buyurtmalar' })).toBeVisible();
  await expect(detailPage.getByText('#SO-501')).toBeVisible();
  await expect(detailPage.getByRole('heading', { name: 'Mahsulotlar' })).toBeVisible();
  await expect(detailPage.getByText('Simsiz quloqchin')).toBeVisible();
  await expect(detailPage.getByText('EAR-01')).toBeVisible();
  await expect(detailPage.getByRole('heading', { name: 'Jo‘natmalar' })).toBeVisible();
  await expect(detailPage.getByText('Elchi')).toBeVisible();
  await expect(detailPage.getByRole('link', { name: 'Kuzatuv sahifasini ochish' })).toHaveAttribute('href', 'https://elchi.uz/track/SH-9');
  await expect(detailPage.getByRole('heading', { name: 'To‘lov tafsiloti' })).toBeVisible();
  await expect(detailPage.getByText('PAY-8')).toBeVisible();
  await expect(detailPage.getByRole('heading', { name: 'Holat tarixi' })).toBeVisible();
  await expect(detailPage.getByText('Buyurtma tasdiqlandi')).toBeVisible();
  await expect(detailPage.getByRole('button', { name: 'Buyurtma yaratish' })).toHaveCount(0);
  await expect(detailPage.getByRole('button', { name: 'Buyurtmani o‘chirish' })).toHaveCount(0);
});

test('admin orders pagination backendga page va limit yuboradi', async ({ page }) => {
  const orders = Array.from({ length: 21 }, (_, index) => ({ id: String(index + 1), orderNumber: `A-${index + 1}`, buyerName: `Xaridor ${index + 1}`, shopId: '7', totalAmount: 250000, paymentMethod: 'cod', status: 'CONFIRMED', createdAt: '2026-09-03T10:00:00.000Z' }));
  await page.route('**/api/v1/admin/orders**', async route => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: orders.slice((pageNumber - 1) * limit, pageNumber * limit), total: orders.length, page: pageNumber, limit, totalPages: 2 } }) });
  });
  await page.goto('/admin/orders');
  const secondPageRequest = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.searchParams.get('page') === '2' && url.searchParams.get('limit') === '20';
  });
  await page.getByTitle('2').click();
  await secondPageRequest;
  await expect(page.getByText('Xaridor 21')).toBeVisible();
  const resetPageRequest = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/admin/orders') && url.searchParams.get('page') === '1' && url.searchParams.get('limit') === '100' && !url.searchParams.has('search');
  });
  await page.getByLabel('Qidirish').fill('A-1');
  await resetPageRequest;
  await expect(page.getByText('Xaridor 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Xaridor 21')).toHaveCount(0);
});

// Payload fields verified against 5E-TECH/marketplace dev commit
// 668847c8af2a35c1022567992797d33b4c79cc03, SellerOrdersService.adminGetOrder/adminListOrders.
for (const width of [1440, 375]) {
  test(`TC3: haqiqiy backend formati — bir nechta sub-order va Elchi jo‘natmasi (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const order = { id: '91', buyerName: 'Ali Valiyev', status: 'CONFIRMED', paymentMethod: 'cod', totalAmount: 240000, deliveryFee: 0, sellersCount: 2, createdAt: '2026-09-03T10:00:00.000Z' };
    const detail = {
      id: order.id, buyerName: order.buyerName, customerId: '3', status: order.status,
      paymentMethod: order.paymentMethod, totalAmount: order.totalAmount, deliveryFee: 0,
      deliveryAddress: null, createdAt: order.createdAt, updatedAt: order.createdAt,
      sellerOrders: [
        { id: '501', shopId: '7', subtotal: 140000, deliveryFee: 0, codAmount: 140000, status: 'ON_THE_ROAD', elchiShipmentId: 'SH-9', trackingUrl: 'https://elchi.uz/track/SH-9', items: [{ productId: '11', productName: 'Simsiz quloqchin', variantId: '21', quantity: 2, unitPrice: 75000, lineTotal: 140000 }] },
        { id: '502', shopId: '8', subtotal: 100000, deliveryFee: 0, codAmount: 100000, status: 'NEW', elchiShipmentId: null, trackingUrl: null, items: [{ productId: '12', productName: 'Klaviatura', variantId: '22', quantity: 1, unitPrice: 100000, lineTotal: 100000 }] },
      ],
    };
    await page.route('**/api/v1/admin/orders**', async route => {
      const payload = new URL(route.request().url()).pathname.endsWith('/91')
        ? detail : { items: [order], total: 1, page: 1, limit: 20, totalPages: 1 };
      await route.fulfill({ json: { data: payload } });
    });
    await page.goto('/admin/orders');
    if (width === 1440) await expect(page.getByRole('row', { name: /Ali Valiyev/ })).toContainText('2 ta do‘kon');
    await page.getByRole('button', { name: 'Buyurtma tafsilotlari' }).click();
    await expect(page).toHaveURL(/\/admin\/orders\/91$/);
    const detailPage = page.getByTestId('detail-page');
    await expect(detailPage.getByText('#501', { exact: true })).toBeVisible();
    await expect(detailPage.getByText('#502', { exact: true })).toBeVisible();
    await expect(detailPage).toContainText('#7, #8');
    await expect(detailPage.getByRole('row', { name: /Simsiz quloqchin/ })).toContainText('140 000');
    await expect(detailPage.getByText('Klaviatura', { exact: true })).toBeVisible();
    await expect(detailPage.getByText('#SH-9', { exact: true })).toBeVisible();
    await expect(detailPage.getByRole('link', { name: 'Kuzatuv sahifasini ochish' })).toHaveAttribute('href', 'https://elchi.uz/track/SH-9');
    await expect(detailPage.getByText('To‘lov ma’lumoti mavjud emas')).toHaveCount(0);
    await expect(detailPage.getByText('Holat tarixi mavjud emas')).toBeVisible();
    await expect(detailPage.locator('input, select, textarea')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('TC3: detail loading, xato, qayta urinish va bo‘sh bo‘limlar', async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  let failed = true;
  await page.route('**/api/v1/admin/orders**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/91')) {
      if (failed) {
        await new Promise<void>(resolve => { releaseResponse = resolve; });
        await route.fulfill({ status: 404, json: { message: 'Buyurtma topilmadi' } });
      } else {
        await route.fulfill({ json: { data: { ...allOrders[0], sellerOrders: [] } } });
      }
      return;
    }
    await route.fulfill({ json: { data: { items: [allOrders[0]], total: 1, page: 1, limit: 20, totalPages: 1 } } });
  });
  await page.goto('/admin/orders');
  await page.getByRole('button', { name: 'Buyurtma tafsilotlari' }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/91$/);
  await expect(page.locator('.ant-skeleton')).toBeVisible();
  await expect.poll(() => Boolean(releaseResponse)).toBe(true);
  releaseResponse!();
  await expect(page.locator('.ant-result-error')).toBeVisible();
  failed = false;
  await page.locator('.ant-result-extra button').click();
  const detailPage = page.getByTestId('detail-page');
  await expect(detailPage.getByText('Sub-buyurtmalar mavjud emas')).toBeVisible();
  await expect(detailPage.getByText('Mahsulotlar mavjud emas')).toBeVisible();
  await expect(detailPage.getByText('Jo‘natma mavjud emas')).toBeVisible();
  await expect(detailPage.getByText('Holat tarixi mavjud emas')).toBeVisible();
});

test('admin order detail direct URL va refreshda backenddan ochiladi', async ({ page }) => {
  await page.route('**/api/v1/admin/orders/91', route => route.fulfill({ json: { data: { ...allOrders[0], sellerOrders: [] } } }));
  await page.goto('/admin/orders/91');
  await expect(page.getByTestId('detail-page')).toContainText('Ali Valiyev');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/orders\/91$/);
  await expect(page.getByTestId('detail-page')).toContainText('Ali Valiyev');
});

test('TC4: ro‘yxat loading va empty holatlarini ko‘rsatadi', async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  await page.unroute('**/api/v1/admin/orders**');
  await page.route('**/api/v1/admin/orders**', async route => {
    await new Promise<void>((resolve) => { releaseResponse = resolve; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } }) });
  });

  await page.goto('/admin/orders');
  await expect(page.locator('.ant-skeleton')).toBeVisible();
  await expect.poll(() => Boolean(releaseResponse)).toBe(true);
  releaseResponse!();
  await expect(page.getByText('Buyurtmalar topilmadi')).toBeVisible();
  await expect(page.getByText('Filterlarni o‘zgartiring yoki yangi buyurtmalarni kuting.')).toBeVisible();
});
