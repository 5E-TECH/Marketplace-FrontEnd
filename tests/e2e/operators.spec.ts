import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

interface OperatorRecord {
  id: string;
  role: 'OPERATOR';
  name: string;
  phone: string;
}

for (const width of [1440, 375]) {
  test(`operatorlar ro‘yxati va qo‘shish formasi responsive (${width}px)`, async ({ page }, testInfo) => {
    await installAuthenticatedSession(page);
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/sellers/operators', route => route.fulfill({ status: 200, json: { data: [{
      id: 'operator-responsive', role: 'OPERATOR', name: 'Responsive Operator', phone: '+998901234567',
    }] } }));

    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Operatorlar' })).toBeVisible();
    await expect(page.getByText('Responsive Operator')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`operators-${width}.png`), fullPage: true });

    await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
    await expect(page.getByRole('heading', { name: 'Yangi operator' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`operator-create-${width}.png`), fullPage: true });
  });
}

test('TC1: seller operatorlar ro‘yxatini ko‘radi va yangi operator qo‘shadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  let operators: OperatorRecord[] = [];
  let createBody: Record<string, unknown> | null = null;
  let deletedId = '';

  await page.route('**/api/v1/sellers/operators', async route => {
    if (route.request().method() === 'POST') {
      createBody = route.request().postDataJSON() as Record<string, unknown>;
      const created: OperatorRecord = {
        id: 'operator-1',
        role: 'OPERATOR',
        name: String(createBody.name),
        phone: String(createBody.phone),
      };
      operators = [created];
      await route.fulfill({ status: 201, json: { data: created } });
      return;
    }
    await route.fulfill({ status: 200, json: { data: operators } });
  });
  await page.route('**/api/v1/sellers/operators/*', async route => {
    deletedId = route.request().url().split('/').at(-1) ?? '';
    operators = operators.filter(operator => operator.id !== deletedId);
    await route.fulfill({ status: 200, json: { data: null } });
  });

  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Operatorlar' })).toBeVisible();
  await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
  await expect(page).toHaveURL(/\/users\/new$/);

  await page.getByLabel('Ism').fill('Buyurtma operatori');
  await page.getByLabel('Telefon').fill('+998901112233');
  await page.getByLabel('Parol', { exact: true }).fill('secure123');
  await page.getByLabel('Parolni tasdiqlash').fill('secure123');
  await page.getByRole('button', { name: 'Operator yaratish' }).click();

  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText('Operator yaratildi')).toBeVisible();
  await expect(page.getByText('Buyurtma operatori')).toBeVisible();
  expect(createBody).toEqual({ name: 'Buyurtma operatori', phone: '+998901112233', password: 'secure123' });

  const row = page.getByRole('row').filter({ hasText: 'Buyurtma operatori' });
  await expect(row).toContainText('+998901112233');
  await expect(row).toContainText('Faol');
  await expect(row).toContainText('—');
  await row.getByRole('button', { name: 'O‘chirish' }).click();
  await page.getByRole('dialog', { name: 'Operator o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();

  await expect(page.getByText('Operator o‘chirildi')).toBeVisible();
  await expect(page.getByText('Buyurtma operatori')).toHaveCount(0);
  expect(deletedId).toBe('operator-1');
});

function order(id: string, salesOrderId: string) {
  return {
    id,
    salesOrderId,
    buyerName: 'Test xaridor',
    subtotal: 150000,
    codAmount: 150000,
    status: 'PENDING',
    elchiShipmentId: null,
    trackingUrl: null,
    itemsCount: 1,
    createdAt: '2026-09-14T10:00:00.000Z',
  };
}

async function mockOperatorOrders(page: Page) {
  const orders = [order('order-confirm', '101'), order('order-status', '102')];
  let confirmedId = '';
  let statusUpdate: { id: string; status: string } | null = null;

  await page.route('**/api/v1/seller/orders**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const segments = path.split('/');
    const id = segments[5] ?? '';

    if (request.method() === 'POST' && path.endsWith('/confirm')) {
      confirmedId = segments[5] ?? '';
      const selected = orders.find(item => item.id === confirmedId);
      if (selected) selected.status = 'CONFIRMED';
      await route.fulfill({ status: 200, json: { data: null } });
      return;
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as { status: string };
      statusUpdate = { id, status: body.status };
      const selected = orders.find(item => item.id === id);
      if (selected) selected.status = body.status;
      await route.fulfill({ status: 200, json: { data: selected } });
      return;
    }
    if (path.endsWith('/items') || path.endsWith('/history')) {
      await route.fulfill({ status: 200, json: { data: [] } });
      return;
    }
    if (id) {
      await route.fulfill({ status: 200, json: { data: orders.find(item => item.id === id) ?? null } });
      return;
    }
    await route.fulfill({ status: 200, json: { data: { items: orders, total: orders.length, page: 1, limit: 20, totalPages: 1 } } });
  });

  return {
    getConfirmedId: () => confirmedId,
    getStatusUpdate: () => statusUpdate,
  };
}

async function mockOperatorLogin(page: Page) {
  let loginBody: Record<string, unknown> | null = null;
  await page.route('**/api/v1/auth/login', async route => {
    loginBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, json: { data: { accessToken: 'operator.access.token' } } });
  });
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, json: { data: {
    id: 'operator-1', role: 'OPERATOR', name: 'Buyurtma operatori', phone: '+998901112233',
    email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false,
  } } }));

  return { getLoginBody: () => loginBody };
}

test('TC2: operator login qilgach buyurtmalar sahifasiga o‘tadi', async ({ page }) => {
  const auth = await mockOperatorLogin(page);
  await mockOperatorOrders(page);

  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('901112233');
  await page.getByLabel('Parol').fill('secure123');
  await page.getByRole('button', { name: 'PLATFORMAGA KIRISH' }).click();

  await expect(page).toHaveURL(/\/orders$/);
  expect(auth.getLoginBody()).toEqual({ phone: '+998901112233', password: 'secure123' });
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByRole('menuitem', { name: 'Buyurtmalar' })).toBeVisible();
  await expect(sidebar.getByRole('menuitem', { name: 'Yetkazib berish' })).toBeVisible();
  for (const hidden of ['Bosh sahifa', 'Operatorlar', 'Do‘kon profili', 'Mahsulotlar', 'Omborlar', 'Qoldiq', 'Yordam']) {
    await expect(sidebar.getByRole('menuitem', { name: hidden })).toHaveCount(0);
  }

  await page.goto('/products');
  await expect(page.getByText('Bu bo‘lim sizga ochiq emas')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  await page.goto('/support');
  await expect(page.getByText('Bu bo‘lim sizga ochiq emas')).toBeVisible();
});

test('TC3: operator buyurtmani tasdiqlaydi va holatini o‘zgartiradi', async ({ page }) => {
  await installAuthenticatedSession(page, {
    id: 'operator-1', role: 'OPERATOR', name: 'Buyurtma operatori',
    phone: '+998901112233', isActive: true, isDeleted: false,
  });
  const api = await mockOperatorOrders(page);
  await page.goto('/orders');

  await page.getByRole('button', { name: '#101 buyurtmani ko‘rish' }).click();
  const confirmDrawer = page.getByRole('dialog', { name: 'Buyurtma #101' });
  await confirmDrawer.getByRole('button', { name: 'Tasdiqlash' }).click();
  await page.getByRole('tooltip').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('alert').getByText('Buyurtma tasdiqlandi')).toBeVisible();
  expect(api.getConfirmedId()).toBe('order-confirm');
  await confirmDrawer.locator('.ant-drawer-close').click();

  await page.getByRole('button', { name: '#102 buyurtmani ko‘rish' }).click();
  const statusDrawer = page.getByRole('dialog', { name: 'Buyurtma #102' });
  await statusDrawer.locator('.ant-select').last().getByRole('combobox').click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'Tasdiqlangan' }).click();
  await statusDrawer.getByRole('button', { name: 'Statusni saqlash' }).click();
  await expect(page.getByText('Buyurtma statusi yangilandi')).toBeVisible();
  expect(api.getStatusUpdate()).toEqual({ id: 'order-status', status: 'CONFIRMED' });
});
