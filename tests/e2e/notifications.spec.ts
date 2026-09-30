import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession, seedAccessToken } from './support/auth';

// C4.2 bildirishnomalari: return_submitted (sotuvchiga), return_refunded (ikkalasiga) va boshqalar.
const notification = (overrides: Record<string, unknown> = {}) => ({
  id: '11', type: 'return_submitted', title: 'Yangi qaytarish so‘rovi', body: '#62 buyurtma bo‘yicha xaridor tovarni qaytarmoqchi',
  isRead: false, data: { returnId: '1', orderId: '62', status: 'SUBMITTED' }, createdAt: '2026-09-28T10:00:00.000Z', ...overrides,
});
const returnRequest = { id: '1', orderId: '62', sellerOrderId: '63', shopId: '4', shopName: 'Ali Market', buyerName: 'Aziza Karimova', status: 'SUBMITTED', reason: 'DEFECTIVE', comment: 'Ekranda chiziq bor', paymentMethod: 'cod', requestedAmount: 45000, refundedAmount: null, restocked: null, decisionComment: null, decidedAt: null, refundedAt: null, createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-28T10:00:00.000Z', items: [], history: [] };

interface NotificationsApi { reads: string[]; readAll: number }

async function mockNotificationsApi(page: Page, items: ReturnType<typeof notification>[]): Promise<NotificationsApi> {
  const api: NotificationsApi = { reads: [], readAll: 0 };
  const store = items.map((item) => ({ ...item }));
  await page.route('**/api/v1/notifications**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'PATCH' && path.endsWith('/read-all')) { api.readAll += 1; store.forEach((item) => { item.isRead = true; }); return route.fulfill({ json: { statusCode: 200, message: 'OK', data: null } }); }
    const read = path.match(/\/notifications\/([^/]+)\/read$/);
    if (request.method() === 'PATCH' && read) { api.reads.push(read[1]); store.forEach((item) => { if (item.id === read[1]) item.isRead = true; }); return route.fulfill({ json: { statusCode: 200, message: 'OK', data: null } }); }
    return route.fulfill({ json: { statusCode: 200, message: 'OK', data: { items: store, total: store.length, unreadCount: store.filter((item) => !item.isRead).length, page: 1, limit: 20 } } });
  });
  return api;
}

test('sotuvchi yangi qaytarish bildirishnomasini ko‘radi va bosganda so‘rov ochiladi', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, json: { message: 'mock yo‘q' } }));
  await installAuthenticatedSession(page);
  const api = await mockNotificationsApi(page, [notification(), notification({ id: '12', type: 'shop_approved', title: 'Do‘kon tasdiqlandi', body: 'Do‘koningiz faol', isRead: true, data: {} })]);
  await page.route('**/api/v1/seller/returns**', (route) => route.fulfill({ json: { data: new URL(route.request().url()).pathname.endsWith('/returns') ? { items: [returnRequest], total: 1, page: 1, limit: 10, totalPages: 1 } : returnRequest } }));
  await page.goto('/');

  const bell = page.getByRole('button', { name: 'Bildirishnomalar: 1 ta o‘qilmagan' });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.locator('.ant-popover:visible');
  await expect(panel).toContainText('Yangi qaytarish so‘rovi');
  await expect(panel).toContainText('Do‘kon tasdiqlandi');
  await panel.getByRole('button', { name: /Yangi qaytarish so‘rovi/ }).click();

  await expect(page).toHaveURL(/\/returns\?id=1$/);
  await expect(page.getByRole('dialog', { name: 'Qaytarish so‘rovi #1' })).toContainText('Ekranda chiziq bor');
  expect(api.reads).toEqual(['11']);
  await expect(page.getByRole('button', { name: 'Bildirishnomalar', exact: true })).toBeVisible();
});

test('“Barchasini o‘qilgan qilish” hisoblagichni nolga tushiradi; sahifasi yo‘q tur faqat o‘qiladi', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await mockNotificationsApi(page, [notification({ id: '21', type: 'shop_approved', title: 'Do‘kon tasdiqlandi', data: {} }), notification({ id: '22' })]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Bildirishnomalar: 2 ta o‘qilmagan' }).click();
  const panel = page.locator('.ant-popover:visible');
  // Sahifasi yo'q bildirishnoma: o'qiladi, lekin sahifa o'zgarmaydi.
  await panel.getByRole('button', { name: /Do‘kon tasdiqlandi/ }).click();
  await expect.poll(() => api.reads).toEqual(['21']);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Bildirishnomalar: 1 ta o‘qilmagan' })).toBeVisible();
  await panel.getByRole('button', { name: 'Barchasini o‘qilgan qilish' }).click();
  await expect.poll(() => api.readAll).toBe(1);
  await expect(page.getByRole('button', { name: 'Bildirishnomalar', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Barchasini o‘qilgan qilish' })).toBeDisabled();
});

test('admin qaytarish bildirishnomasi admin qaytarishlar sahifasini ochadi; bo‘sh holat ham ko‘rinadi', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, json: { message: 'mock yo‘q' } }));
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: { id: 'super', role: 'SUPERADMIN', name: 'Bosh admin', phone: '+998900000002', isActive: true, isDeleted: false } } }));
  const api = await mockNotificationsApi(page, [notification({ id: '31', type: 'return_refunded', title: 'Pul qaytarildi', data: { returnId: '7', orderId: '62', status: 'REFUNDED' } })]);
  await page.goto('/admin/overview');
  await page.getByRole('button', { name: 'Bildirishnomalar: 1 ta o‘qilmagan' }).click();
  await page.locator('.ant-popover:visible').getByRole('button', { name: /Pul qaytarildi/ }).click();
  await expect(page).toHaveURL(/\/admin\/returns\?id=7$/);
  expect(api.reads).toEqual(['31']);
});

test('bildirishnomalar bo‘lmasa bo‘sh holat, yuklanmasa xato va qayta urinish ko‘rinadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  let fail = true;
  await page.route('**/api/v1/notifications**', (route) => fail
    ? route.fulfill({ status: 500, json: { message: 'xato' } })
    : route.fulfill({ json: { data: { items: [], total: 0, unreadCount: 0, page: 1, limit: 20 } } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Bildirishnomalar', exact: true }).click();
  const panel = page.locator('.ant-popover:visible');
  await expect(panel.getByRole('alert')).toContainText('Bildirishnomalarni yuklab bo‘lmadi.', { timeout: 20_000 });
  fail = false;
  await panel.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(panel).toContainText('Bildirishnomalar yo‘q');
});
