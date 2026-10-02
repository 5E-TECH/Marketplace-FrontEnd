import { expect, test, type Page } from '@playwright/test';
import { findClippedBlocks } from './support/layout';
import { installAuthenticatedSession, operatorUser } from './support/auth';

// Sotuvchi moliyasi — mavjud buyurtma ma'lumotidan (komissiya/o'tkazmalar backend ulangach).
const statuses = ['DELIVERED', 'DELIVERED', 'ON_THE_ROAD', 'CONFIRMED', 'CANCELLED', 'DELIVERED', 'RETURNED', 'NEW', 'SHIPMENT_CREATED', 'DELIVERED'] as const;
type Status = typeof statuses[number];
interface MockOrder { id: string; salesOrderId: string; buyerName: string; subtotal: number; deliveryFee: number; codAmount: number; status: Status; elchiShipmentId: null; trackingUrl: null; itemsCount: number; createdAt: string }

/** 130 ta sentabr buyurtmasi (2 sahifa × 100) va 1 ta avgust buyurtmasi — davr filtri uchun. */
const septemberOrders: MockOrder[] = Array.from({ length: 130 }, (_, index) => ({
  id: String(1000 + index), salesOrderId: String(500 + index), buyerName: `Xaridor ${index + 1}`,
  subtotal: 10_000 + index * 1_000, deliveryFee: 15_000, codAmount: 25_000 + index * 1_000,
  status: statuses[index % statuses.length], elchiShipmentId: null, trackingUrl: null, itemsCount: 1,
  createdAt: `2026-09-${String(1 + (index % 29)).padStart(2, '0')}T08:00:00.000Z`,
}));
const augustOrder: MockOrder = { ...septemberOrders[0], id: '9001', salesOrderId: '9001', status: 'DELIVERED', subtotal: 777_000, createdAt: '2026-08-20T08:00:00.000Z' };

// Kutilgan yig'indilar — ilova mantiqidan mustaqil hisoblanadi.
const expected = (orders: MockOrder[]) => {
  const sum = (list: MockOrder[]) => ({ count: list.length, amount: list.reduce((total, order) => total + order.subtotal, 0) });
  return {
    delivered: sum(orders.filter(({ status }) => status === 'DELIVERED')),
    inProgress: sum(orders.filter(({ status }) => ['NEW', 'CONFIRMED', 'SHIPMENT_CREATED', 'ON_THE_ROAD'].includes(status))),
    closed: sum(orders.filter(({ status }) => status === 'CANCELLED' || status === 'RETURNED')),
  };
};
const money = (value: number) => `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`;

interface OrdersApi { requests: Array<Record<string, string>>; fail: boolean }

async function mockSellerOrders(page: Page, orders: MockOrder[]): Promise<OrdersApi> {
  const api: OrdersApi = { requests: [], fail: false };
  await page.route('**/api/v1/seller/orders**', (route) => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams);
    api.requests.push(params);
    if (api.fail) return route.fulfill({ status: 500, json: { message: 'Server xatosi' } });
    const inRange = orders.filter(({ createdAt }) => (!params.dateFrom || createdAt.slice(0, 10) >= params.dateFrom) && (!params.dateTo || createdAt.slice(0, 10) <= params.dateTo));
    const current = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    return route.fulfill({ json: { data: { items: inRange.slice((current - 1) * limit, current * limit), total: inRange.length, page: current, limit, totalPages: Math.max(1, Math.ceil(inRange.length / limit)) } } });
  });
  return api;
}

async function openFinance(page: Page, orders: MockOrder[], url = '/finance') {
  // Standart davr — joriy oy: sana qotiriladi.
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00+05:00'));
  await installAuthenticatedSession(page);
  const api = await mockSellerOrders(page, orders);
  await page.goto(url);
  return api;
}

const card = (page: Page, title: string) => page.getByRole('region', { name: 'Davr bo‘yicha yig‘indi' }).locator('article').filter({ hasText: title });
const summaryRequests = (api: OrdersApi) => api.requests.filter(({ limit }) => limit === '100');

test('TC1: balans kartalari butun davr (ikki sahifa) bo‘yicha to‘g‘ri hisoblanadi', async ({ page }) => {
  const api = await openFinance(page, [...septemberOrders, augustOrder]);
  await expect(page.getByRole('menuitem', { name: 'Moliya' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moliya', level: 1 })).toBeVisible();
  const totals = expected(septemberOrders);
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(money(totals.delivered.amount));
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(`${totals.delivered.count} ta buyurtma`);
  await expect(card(page, 'Yo‘ldagi buyurtmalar')).toContainText(money(totals.inProgress.amount));
  await expect(card(page, 'Yo‘ldagi buyurtmalar')).toContainText(`${totals.inProgress.count} ta buyurtma`);
  await expect(card(page, 'Bekor qilingan va qaytarilgan')).toContainText(money(totals.closed.amount));
  await expect(card(page, 'Bekor qilingan va qaytarilgan')).toContainText(`${totals.closed.count} ta buyurtma`);
  // Joriy oy: 1-sahifa va 2-sahifa (100 tadan) so'raladi, avgust buyurtmasi hisobga kirmaydi.
  expect(summaryRequests(api).map(({ page: current, dateFrom, dateTo }) => [current, dateFrom, dateTo]).sort()).toEqual([['1', '2026-09-01', '2026-09-30'], ['2', '2026-09-01', '2026-09-30']]);
  // Komissiya va o'tkazmalar taxmin qilinmaydi — bu aniq aytiladi.
  await expect(page.getByText(/komissiya ayirilmagan/)).toBeVisible();
});

test('TC2: har buyurtma bo‘yicha hisob — summa ustunlari va sahifalash', async ({ page }) => {
  const api = await openFinance(page, septemberOrders);
  const table = page.getByRole('table');
  const first = page.getByRole('row').filter({ hasText: '#500' });
  await expect(first).toContainText(money(10_000));
  await expect(first).toContainText(money(15_000));
  await expect(first).toContainText(money(25_000));
  await expect(first).toContainText('Yetkazildi');
  await expect(page.getByText('Jami 130 ta')).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(11);
  await page.getByTitle('2', { exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '#510' })).toBeVisible();
  await expect.poll(() => api.requests.some(({ page: current, limit }) => current === '2' && limit === '10')).toBe(true);
});

test('TC3: sana filtri backendga ketadi, URL’da saqlanadi va tozalanadi', async ({ page }) => {
  const api = await openFinance(page, [...septemberOrders, augustOrder]);
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(`${expected(septemberOrders).delivered.count} ta buyurtma`);

  const start = page.getByLabel('Boshlanish sanasi');
  await start.fill('2026-08-01');
  await start.press('Enter');
  await expect(page).toHaveURL(/from=2026-08-01&to=2026-09-30/);
  const withAugust = expected([...septemberOrders, augustOrder]);
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(money(withAugust.delivered.amount));
  expect(api.requests.some(({ dateFrom, dateTo }) => dateFrom === '2026-08-01' && dateTo === '2026-09-30')).toBe(true);

  // Sahifa yangilansa davr saqlanadi.
  await page.reload();
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('2026-08-01');
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(money(withAugust.delivered.amount));

  await page.getByRole('button', { name: 'Tozalash' }).click();
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('2026-09-01');
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(money(expected(septemberOrders).delivered.amount));
});

test('TC4: ma’lumot yo‘q holati — nol summalar va bo‘sh jadval xabari', async ({ page }) => {
  await openFinance(page, []);
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText(money(0));
  await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText('0 ta buyurtma');
  await expect(page.getByText('Bu davrda buyurtmalar yo‘q')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tozalash' })).toBeDisabled();
});

test('API xato bersa xabar va qayta urinish ishlaydi', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00+05:00'));
  await installAuthenticatedSession(page);
  const api = await mockSellerOrders(page, septemberOrders);
  api.fail = true;
  await page.goto('/finance');
  await expect(page.getByText('Yig‘indini hisoblab bo‘lmadi')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Buyurtmalarni yuklab bo‘lmadi')).toBeVisible();
  api.fail = false;
  await page.getByRole('button', { name: /Qayta urinish/ }).first().click();
  await expect(page.getByRole('region', { name: 'Davr bo‘yicha yig‘indi' }).or(page.getByRole('table'))).toBeVisible();
});

test('operator moliya bo‘limini ko‘rmaydi va ocha olmaydi', async ({ page }) => {
  await installAuthenticatedSession(page, operatorUser);
  await mockSellerOrders(page, septemberOrders);
  await page.goto('/orders');
  await expect(page.getByRole('menuitem', { name: 'Buyurtmalar' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Moliya' })).toHaveCount(0);
  await page.goto('/finance');
  await expect(page.getByText('Bu bo‘lim sizga ochiq emas')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Davr bo‘yicha yig‘indi' })).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px ekranda moliya sahifasi sig‘adi`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openFinance(page, septemberOrders);
    await expect(card(page, 'Yetkazilgan buyurtmalar')).toContainText('ta buyurtma');
    await expect(page.getByRole('row').filter({ hasText: '#500' })).toBeVisible();
    expect(await findClippedBlocks(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`finance-${viewport.width}.png`), fullPage: true });
  });
}
