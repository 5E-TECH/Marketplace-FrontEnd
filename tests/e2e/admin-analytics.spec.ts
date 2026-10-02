import { expect, test, type Page, type Route } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';
import { findClippedBlocks } from './support/layout';

// Admin Dashboard → "Savdo analitikasi": davr ko'rsatkichlari, kunlik grafik, yetakchi do'kon/mahsulotlar.
const adminUser = { id: 'analytics-admin', role: 'ADMIN', name: 'Analytics Admin', phone: '+998901234567', isActive: true, isDeleted: false } as const;
const dashboard = { shops: { total: 3, pending: 0, active: 3, suspended: 0, rejected: 0 }, users: { total: 20, sellers: 3, buyers: 16, admins: 1, operators: 0 }, orders: { total: 140, today: 2 }, gmv: 0, revenue: 0 };
const shops = [{ id: '1', name: 'Alfa Market' }, { id: '2', name: 'Beta Savdo' }, { id: '3', name: 'Gamma Shop' }];
const products = [{ id: '10', name: 'Telefon' }, { id: '11', name: 'Quloqchin' }, { id: '12', name: 'Zaryadka' }];
const STATUSES = ['CONFIRMED', 'PAID', 'FULFILLED', 'CANCELLED', 'DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_FULFILLED', 'REFUNDED'] as const;
const REALIZED = new Set(['PAID', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED']);

interface MockOrder { id: string; buyerName: string; status: typeof STATUSES[number]; paymentMethod: 'cod'; totalAmount: number; deliveryFee: number; sellersCount: number; shipmentsCount: number; createdAt: string }
const DELIVERY = 20_000;
/** Sentabr: 110 ta buyurtma (2 sahifa), har 5-chisi ikki do'kondan; avgust: oldingi davr uchun 24 ta. */
const september: MockOrder[] = Array.from({ length: 110 }, (_, index) => ({
  id: String(1000 + index), buyerName: `Xaridor ${index}`, status: STATUSES[index % STATUSES.length], paymentMethod: 'cod',
  totalAmount: 100_000 + index * 1_000, deliveryFee: DELIVERY, sellersCount: index % 5 === 0 ? 2 : 1, shipmentsCount: 1,
  createdAt: `2026-09-${String(1 + (index % 30)).padStart(2, '0')}T08:00:00.000Z`,
}));
// UTC 20:00 — Toshkentda 1-oktabr, lekin backend filtri kabi 30-sentabrga tushadi.
september.push({ ...september[0], id: '1999', totalAmount: 333_000, createdAt: '2026-09-30T20:00:00.000Z' });
const august: MockOrder[] = Array.from({ length: 24 }, (_, index) => ({
  ...september[index], id: String(5000 + index), createdAt: `2026-08-${String(2 + (index % 28)).padStart(2, '0')}T08:00:00.000Z`,
}));
const allOrders = [...september, ...august];

/** Buyurtma tafsiloti: do'kon(lar) va mahsulotlar — mock ham, kutilgan natija ham shundan. */
function detailOf(order: MockOrder) {
  const index = Number(order.id) % 1000;
  const subtotal = order.totalAmount - order.deliveryFee;
  const owners = order.sellersCount === 2 ? [shops[index % 3], shops[(index + 1) % 3]] : [shops[index % 3]];
  return {
    id: order.id, status: order.status, totalAmount: order.totalAmount, deliveryFee: order.deliveryFee, createdAt: order.createdAt,
    sellerOrders: owners.map((shop, position) => {
      const product = products[(index + position) % 3];
      const part = owners.length === 2 ? subtotal / 2 : subtotal;
      const quantity = 1 + ((index + position) % 2);
      return { id: `${order.id}-${position}`, shopId: shop.id, subtotal: part, deliveryFee: 0, codAmount: part, status: 'NEW', items: [{ productId: product.id, productName: product.name, variantId: null, quantity, unitPrice: part / quantity, lineTotal: part }] };
    }),
  };
}

const day = (createdAt: string) => new Date(createdAt).toISOString().slice(0, 10);
const inRange = (from: string, to: string) => allOrders.filter((order) => day(order.createdAt) >= from && day(order.createdAt) <= to);
const realized = (orders: MockOrder[]) => orders.filter((order) => REALIZED.has(order.status));
/** Kutilgan qiymatlar — ilova kodidan mustaqil. */
function expected(from: string, to: string) {
  const sales = realized(inRange(from, to));
  const gmv = sales.reduce((sum, order) => sum + order.totalAmount, 0);
  const byShop = new Map<string, number>(); const byProduct = new Map<string, { quantity: number; gmv: number }>();
  for (const seller of sales.flatMap((order) => detailOf(order).sellerOrders)) {
    byShop.set(seller.shopId, (byShop.get(seller.shopId) ?? 0) + seller.subtotal);
    for (const item of seller.items) { const entry = byProduct.get(item.productName) ?? { quantity: 0, gmv: 0 }; entry.quantity += item.quantity; entry.gmv += item.lineTotal; byProduct.set(item.productName, entry); }
  }
  return {
    gmv, orders: sales.length, average: sales.length ? Math.round(gmv / sales.length) : 0,
    shops: [...byShop].sort((a, b) => b[1] - a[1]).map(([id, amount]) => ({ name: shops.find((shop) => shop.id === id)!.name, amount })),
    products: [...byProduct].sort((a, b) => b[1].quantity - a[1].quantity || b[1].gmv - a[1].gmv).map(([name, value]) => ({ name, ...value })),
    sales,
  };
}
const money = (value: number) => `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`;
const change = (current: number, previous: number) => Math.round(((current - previous) / previous) * 100);

const json = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status >= 400 ? data : { data }) });
interface Api { listRequests: Array<Record<string, string>>; detailRequests: string[]; failList: boolean; failDetail: boolean }

async function openAnalytics(page: Page, query = '') {
  const api: Api = { listRequests: [], detailRequests: [], failList: false, failDetail: false };
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00+05:00'));
  await installAuthenticatedSession(page, adminUser);
  await page.route('**/api/v1/admin/dashboard', (route) => json(route, dashboard));
  await page.route((url) => url.pathname === '/api/v1/admin/shops', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const items = params.get('status') === 'PENDING' ? [] : shops.map((shop) => ({ ...shop, status: 'ACTIVE', ownerUserId: '9', slug: shop.name.toLowerCase(), createdAt: '2026-01-01T00:00:00Z' }));
    return json(route, { items, total: items.length, page: 1, limit: Number(params.get('limit') ?? 20), totalPages: 1 });
  });
  await page.route((url) => url.pathname === '/api/v1/admin/orders', (route) => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams);
    api.listRequests.push(params);
    if (api.failList) return json(route, { message: 'Server xatosi' }, 500);
    const items = inRange(params.dateFrom ?? '0000', params.dateTo ?? '9999');
    const current = Number(params.page ?? 1); const limit = Number(params.limit ?? 20);
    return json(route, { items: items.slice((current - 1) * limit, current * limit), total: items.length, page: current, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) });
  });
  await page.route((url) => /^\/api\/v1\/admin\/orders\/\d+$/.test(url.pathname), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    api.detailRequests.push(id);
    if (api.failDetail) return json(route, { message: 'Server xatosi' }, 500);
    return json(route, detailOf(allOrders.find((order) => order.id === id)!));
  });
  await page.goto(`/admin/overview${query}`);
  return api;
}

const section = (page: Page) => page.getByRole('region', { name: 'Savdo analitikasi' });
const card = (page: Page, title: string) => section(page).getByRole('group', { name: 'Davr ko‘rsatkichlari' }).locator('article').filter({ hasText: title });
const panelRows = (page: Page, title: string) => section(page).locator('section').filter({ hasText: title }).getByRole('row');

test('TC1: aylanma, buyurtmalar soni va o‘rtacha chek butun davr bo‘yicha, oldingi davrga nisbatan', async ({ page }) => {
  const api = await openAnalytics(page);
  const current = expected('2026-09-01', '2026-09-30');
  const previous = expected('2026-08-02', '2026-08-31');
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(current.gmv));
  await expect(card(page, 'Umumiy aylanma')).toContainText(`▲ ${change(current.gmv, previous.gmv)}% oldingi 30 kunga nisbatan`);
  await expect(card(page, 'Buyurtmalar soni')).toContainText(String(current.orders));
  await expect(card(page, 'O‘rtacha chek')).toContainText(money(current.average));
  // Bekor qilingan, qoralama, to'lov kutilayotgan va qaytarilganlar savdoga kirmaydi.
  expect(current.orders).toBeLessThan(inRange('2026-09-01', '2026-09-30').length);
  // Joriy davr 2 sahifada, oldingi davr alohida so'raladi — sana filtri backendga ketadi.
  const pages = (from: string) => api.listRequests.filter((request) => request.dateFrom === from).map((request) => request.page).sort();
  expect(pages('2026-09-01')).toEqual(['1', '2']);
  expect(pages('2026-08-02')).toEqual(['1']);
  expect(api.listRequests.every((request) => request.limit === '100')).toBe(true);
});

test('TC2: kunlar bo‘yicha grafik — davrning har kuni, savdosiz kun nol', async ({ page }) => {
  await openAnalytics(page);
  const bars = section(page).getByRole('list', { name: 'Kunlar bo‘yicha aylanma' }).getByRole('listitem');
  await expect(bars).toHaveCount(30);
  const sales = expected('2026-09-01', '2026-09-30').sales;
  const dayTotal = (date: string) => sales.filter((order) => day(order.createdAt) === date);
  for (const date of ['2026-09-15', '2026-09-30']) {
    const orders = dayTotal(date);
    const label = `${date.slice(8, 10)}.${date.slice(5, 7)}: ${money(orders.reduce((sum, order) => sum + order.totalAmount, 0))} · ${orders.length} ta buyurtma`;
    await expect(section(page).getByRole('listitem', { name: label, exact: true })).toHaveCount(1);
  }
  // O'q yozuvi o'zbekcha qisqartma bilan (brauzer Intl'ida yo'q — "M/K" chiqmasin).
  await expect(section(page).locator('figure').getByText(/^\d+(,\d)? ming$/).first()).toBeVisible();
  await bars.nth(14).hover();
  await expect(page.getByRole('tooltip')).toContainText('15.09');
});

test('TC3: eng ko‘p sotgan do‘konlar va mahsulotlar buyurtma tafsilotidan', async ({ page }) => {
  const api = await openAnalytics(page);
  const current = expected('2026-09-01', '2026-09-30');
  const shopRows = panelRows(page, 'Eng ko‘p sotgan do‘konlar');
  await expect(shopRows).toHaveCount(1 + current.shops.length);
  for (const [index, shop] of current.shops.entries()) {
    await expect(shopRows.nth(index + 1)).toContainText(shop.name);
    await expect(shopRows.nth(index + 1)).toContainText(money(shop.amount));
  }
  const productRows = panelRows(page, 'Eng ko‘p sotilgan mahsulotlar');
  for (const [index, product] of current.products.entries()) {
    await expect(productRows.nth(index + 1)).toContainText(product.name);
    await expect(productRows.nth(index + 1)).toContainText(`${product.quantity} dona`);
  }
  // Faqat savdo buyurtmalarining tafsiloti so'raladi.
  expect(new Set(api.detailRequests)).toEqual(new Set(current.sales.map((order) => order.id)));
});

test('TC4: sana filtri natijani o‘zgartiradi, URL’da saqlanadi va tozalanadi', async ({ page }) => {
  const api = await openAnalytics(page);
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(expected('2026-09-01', '2026-09-30').gmv));
  const start = page.getByLabel('Boshlanish sanasi');
  await start.click(); await start.fill('2026-09-10'); await start.press('Enter');
  await expect(page).toHaveURL(/from=2026-09-10&to=2026-09-30/);
  const narrowed = expected('2026-09-10', '2026-09-30');
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(narrowed.gmv));
  await expect(card(page, 'Buyurtmalar soni')).toContainText(String(narrowed.orders));
  await expect(section(page).getByRole('list', { name: 'Kunlar bo‘yicha aylanma' }).getByRole('listitem')).toHaveCount(21);
  // Oldingi davr ham shu uzunlikda: 21 kun.
  expect(api.listRequests.some((request) => request.dateFrom === '2026-08-20' && request.dateTo === '2026-09-09')).toBe(true);

  await page.reload();
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('2026-09-10');
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(narrowed.gmv));

  await section(page).getByRole('button', { name: 'Tozalash' }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('2026-09-01');
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(expected('2026-09-01', '2026-09-30').gmv));
});

test('TC5: ma’lumot yo‘q holati — nol kartalar va tushunarli xabar', async ({ page }) => {
  const api = await openAnalytics(page, '?from=2026-07-01&to=2026-07-31');
  await expect(section(page).getByText('Bu davrda savdo bo‘lmagan')).toBeVisible();
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(0));
  await expect(card(page, 'Buyurtmalar soni')).toContainText('0');
  await expect(card(page, 'Umumiy aylanma')).toContainText('Oldingi 31 kunda savdo bo‘lmagan');
  await expect(section(page).getByRole('list', { name: 'Kunlar bo‘yicha aylanma' })).toHaveCount(0);
  await expect(section(page).getByRole('table')).toHaveCount(0);
  expect(api.detailRequests).toEqual([]);
});

test('xatolar: ro‘yxat xatosi qayta urinishda tiklanadi, reyting xatosi bir marta ko‘rsatiladi', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00+05:00'));
  const api = await openAnalytics(page);
  await expect(card(page, 'Umumiy aylanma')).toBeVisible();
  // Reyting xatosi.
  api.failDetail = true;
  await page.getByLabel('Boshlanish sanasi').click();
  await page.getByLabel('Boshlanish sanasi').fill('2026-09-05');
  await page.getByLabel('Boshlanish sanasi').press('Enter');
  await expect(section(page).getByText('Reytingni yuklab bo‘lmadi')).toHaveCount(1, { timeout: 20_000 });
  api.failDetail = false;
  await section(page).getByRole('button', { name: /Qayta urinish/ }).click();
  await expect(panelRows(page, 'Eng ko‘p sotgan do‘konlar').nth(1)).toContainText(expected('2026-09-05', '2026-09-30').shops[0].name);
  // Ro'yxat xatosi.
  api.failList = true;
  await page.goto('/admin/overview?from=2026-09-20&to=2026-09-30');
  await expect(section(page).getByText('Savdo analitikasini yuklab bo‘lmadi')).toBeVisible({ timeout: 20_000 });
  api.failList = false;
  await section(page).getByRole('button', { name: /Qayta urinish/ }).click();
  await expect(card(page, 'Umumiy aylanma')).toContainText(money(expected('2026-09-20', '2026-09-30').gmv));
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px ekranda analitika sig‘adi`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openAnalytics(page);
    await expect(panelRows(page, 'Eng ko‘p sotgan do‘konlar').nth(1)).toBeVisible();
    expect(await findClippedBlocks(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`analytics-${viewport.width}.png`), fullPage: true });
  });
}
