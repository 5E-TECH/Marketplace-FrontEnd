import { expect, test, type Page } from '@playwright/test';
import { collectUnconnectedFormWarnings } from './support/console';
import { findClippedBlocks } from './support/layout';
import { installAuthenticatedSession, operatorUser, seedAccessToken } from './support/auth';

type Status = 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
type ReturnRow = ReturnType<typeof returnRequest>;
interface History { fromStatus: Status | null; toStatus: Status; actorRole: string; comment: string | null; createdAt: string }

const returnRequest = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '1', orderId: '62', sellerOrderId: '63', shopId: '4', shopName: 'Ali Market', buyerName: 'Aziza Karimova',
  status: 'SUBMITTED' as Status, reason: 'DEFECTIVE', comment: 'Ekranda chiziq bor', paymentMethod: 'cod',
  requestedAmount: 45000, refundedAmount: null as number | null, restocked: null as boolean | null,
  decisionComment: null as string | null, decidedAt: null as string | null, refundedAt: null as string | null,
  createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-28T10:00:00.000Z',
  items: [{ id: '1', orderItemId: '66', productId: '7', variantId: '6', productName: 'Telefon g‘ilofi', imageUrl: null, quantity: 1, unitPrice: 45000, lineTotal: 45000 }],
  ...overrides,
});

interface ReturnsApi {
  listParams: Array<Record<string, string>>;
  actions: Array<{ action: string; id: string; body: unknown }>;
}

/**
 * Backend holat mashinasi (C4.2): SUBMITTED → IN_REVIEW → APPROVED | REJECTED → REFUNDED.
 * Har amal tarixga yoziladi va yangilangan so'rovni qaytaradi — xuddi prod'dagidek.
 */
async function mockReturnsApi(page: Page, scope: 'seller' | 'admin', rows: ReturnRow[], actorRole: string): Promise<ReturnsApi> {
  const api: ReturnsApi = { listParams: [], actions: [] };
  const store = new Map(rows.map((row) => [row.id, { ...row }]));
  const history = new Map<string, History[]>(rows.map((row) => [row.id, [{ fromStatus: null, toStatus: 'SUBMITTED', actorRole: 'BUYER', comment: row.comment, createdAt: row.createdAt }]]));
  const detail = (id: string) => ({ ...store.get(id)!, history: history.get(id) ?? [] });
  const move = (id: string, toStatus: Status, comment: string | null, patch: Record<string, unknown> = {}) => {
    const row = store.get(id)!;
    history.get(id)!.push({ fromStatus: row.status, toStatus, actorRole, comment, createdAt: '2026-09-28T12:00:00.000Z' });
    store.set(id, { ...row, ...patch, status: toStatus, updatedAt: '2026-09-28T12:00:00.000Z' });
  };
  await page.route(`**/api/v1/${scope}/returns**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const [, id, action] = url.pathname.match(new RegExp(`/${scope}/returns(?:/([^/]+))?(?:/([^/]+))?$`)) ?? [];
    if (request.method() === 'GET' && !id) {
      const params = Object.fromEntries(url.searchParams);
      api.listParams.push(params);
      const items = [...store.values()].filter((row) => !params.status || row.status === params.status);
      return route.fulfill({ json: { statusCode: 200, message: 'OK', data: { items, total: items.length, page: Number(params.page ?? 1), limit: Number(params.limit ?? 10), totalPages: 1 } } });
    }
    if (!id || !store.has(id)) return route.fulfill({ status: 404, json: { statusCode: 404, message: 'Qaytarish so‘rovi topilmadi' } });
    if (request.method() === 'GET') return route.fulfill({ json: { statusCode: 200, message: 'OK', data: detail(id) } });
    const body = request.postDataJSON() as Record<string, unknown>;
    api.actions.push({ action, id, body });
    const status = store.get(id)!.status;
    const fail = (message: string) => route.fulfill({ status: 400, json: { statusCode: 400, message } });
    if (action === 'review') { if (status !== 'SUBMITTED') return fail('Faqat yuborilgan so‘rov'); move(id, 'IN_REVIEW', (body.comment as string) ?? null); }
    else if (action === 'approve') move(id, 'APPROVED', (body.comment as string) ?? null, { decisionComment: body.comment ?? null, decidedAt: '2026-09-28T12:00:00.000Z' });
    else if (action === 'reject') move(id, 'REJECTED', body.reason as string, { decisionComment: body.reason, decidedAt: '2026-09-28T12:00:00.000Z' });
    else if (action === 'refund') {
      if (status !== 'APPROVED') return fail('Faqat tasdiqlangan so‘rov bo‘yicha pul qaytariladi');
      move(id, 'REFUNDED', (body.comment as string) ?? null, { refundedAmount: body.amount, restocked: body.restock, refundedAt: '2026-09-28T12:30:00.000Z' });
    }
    return route.fulfill({ status: 201, json: { statusCode: 201, message: 'OK', data: detail(id) } });
  });
  return api;
}

async function asAdmin(page: Page, role: 'ADMIN' | 'SUPERADMIN') {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, json: { message: 'mock yo‘q' } }));
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: { id: `${role}-e2e`, role, name: 'Admin', phone: '+998900000001', isActive: true, isDeleted: false } } }));
  await page.route('**/api/v1/admin/shops**', (route) => route.fulfill({ json: { data: { items: [{ id: '4', ownerUserId: '42', name: 'Ali Market', slug: 'ali-market', description: null, logoUrl: null, bannerUrl: null, status: 'ACTIVE', rating: 0, isFeatured: false, createdAt: '2026-09-01T00:00:00.000Z' }, { id: '5', ownerUserId: '43', name: 'Baraka', slug: 'baraka', description: null, logoUrl: null, bannerUrl: null, status: 'ACTIVE', rating: 0, isFeatured: false, createdAt: '2026-09-01T00:00:00.000Z' }], total: 2, page: 1, limit: 20, totalPages: 1 } } }));
}

async function asSeller(page: Page, user?: Record<string, unknown>) {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, json: { message: 'mock yo‘q' } }));
  await installAuthenticatedSession(page, user);
}

const rowOf = (page: Page, id: string) => page.getByRole('row').filter({ has: page.getByRole('button', { name: `#${id} qaytarish so‘rovini ko‘rish` }) });
const drawer = (page: Page, id = '1') => page.getByRole('dialog', { name: `Qaytarish so‘rovi #${id}` });
const history = (page: Page, id = '1') => drawer(page, id).getByRole('region', { name: 'Holat tarixi' });

test.describe('Sotuvchi: qaytarish so‘rovlari', () => {
  test('TC1: xaridor yuborgan so‘rov sotuvchi ro‘yxatida ko‘rinadi va holat filtri backendga ketadi', async ({ page }) => {
    await asSeller(page);
    const api = await mockReturnsApi(page, 'seller', [returnRequest(), returnRequest({ id: '2', status: 'APPROVED', reason: 'CHANGED_MIND', comment: null })], 'SELLER');
    await page.goto('/returns');
    await expect(page.getByRole('menuitem', { name: 'Qaytarishlar' })).toBeVisible();
    const row = rowOf(page, '1');
    await expect(row).toContainText('#62');
    await expect(row).toContainText('Telefon g‘ilofi');
    await expect(row).toContainText('45 000 UZS');
    await expect(row).toContainText('Nuqsonli (brak)');
    await expect(row).toContainText('Yuborildi');
    expect(api.listParams[0]).toEqual({ page: '1', limit: '10' });

    await page.getByRole('tab', { name: 'Tasdiqlandi' }).click();
    await expect.poll(() => api.listParams.at(-1)).toEqual({ page: '1', limit: '10', status: 'APPROVED' });
    await expect(rowOf(page, '2')).toContainText('Tasdiqlandi');
    await expect(rowOf(page, '1')).toHaveCount(0);
  });

  test('ko‘rib chiqish → tasdiqlash: holat va tarix yangilanadi, qarordan keyin tugmalar yo‘qoladi', async ({ page }) => {
    const warnings = collectUnconnectedFormWarnings(page);
    await asSeller(page);
    const api = await mockReturnsApi(page, 'seller', [returnRequest()], 'SELLER');
    await page.goto('/returns');
    await page.getByRole('button', { name: '#1 qaytarish so‘rovini ko‘rish' }).click();
    await expect(page).toHaveURL(/\/returns\?id=1$/);
    const panel = drawer(page);
    await expect(panel).toContainText('Ekranda chiziq bor');
    await expect(panel).toContainText('Posilka #63');
    await expect(history(page)).toContainText('Yuborildi');
    await expect(history(page)).toContainText('Xaridor');

    await panel.getByRole('button', { name: 'Ko‘rib chiqishga olish' }).click();
    const reviewModal = page.getByRole('dialog', { name: 'So‘rovni ko‘rib chiqishga olish' });
    await reviewModal.getByLabel('Izoh (ixtiyoriy)').fill('Tovar keldi, tekshiryapmiz');
    await reviewModal.getByRole('button', { name: 'Ko‘rib chiqishga olish' }).click();
    await expect(page.getByText('So‘rov ko‘rib chiqishga olindi')).toBeVisible();
    expect(api.actions).toEqual([{ action: 'review', id: '1', body: { comment: 'Tovar keldi, tekshiryapmiz' } }]);
    await expect(panel.getByText('Ko‘rib chiqilmoqda').first()).toBeVisible();
    await expect(history(page)).toContainText('Tovar keldi, tekshiryapmiz');
    await expect(panel.getByRole('button', { name: 'Ko‘rib chiqishga olish' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Tasdiqlash' }).click();
    const approveModal = page.getByRole('dialog', { name: 'Qaytarishni tasdiqlash' });
    await approveModal.getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect(page.getByText('Qaytarish tasdiqlandi')).toBeVisible();
    // Izoh yozilmasa bo'sh tana ketadi.
    expect(api.actions.at(-1)).toEqual({ action: 'approve', id: '1', body: {} });
    await expect(panel.getByRole('button', { name: /Tasdiqlash|Rad etish|Ko‘rib/ })).toHaveCount(0);
    await expect(panel).toContainText('Qaror qabul qilingan. Uni faqat administrator o‘zgartira oladi.');
    // Ro'yxat ham yangilangan.
    await expect(rowOf(page, '1')).toContainText('Tasdiqlandi');
    expect(warnings).toEqual([]);
  });

  test('rad etishda sabab majburiy va xaridorga ketadi', async ({ page }) => {
    await asSeller(page);
    const api = await mockReturnsApi(page, 'seller', [returnRequest()], 'SELLER');
    // Bildirishnomadan kelgan havola: so'rov to'g'ridan-to'g'ri ochiladi.
    await page.goto('/returns?id=1');
    const panel = drawer(page);
    await panel.getByRole('button', { name: 'Rad etish' }).click();
    const modal = page.getByRole('dialog', { name: 'Qaytarishni rad etish' });
    await modal.getByRole('button', { name: 'Rad etish' }).click();
    await expect(modal.getByText('Rad etish sababini kiriting')).toBeVisible();
    expect(api.actions).toEqual([]);
    await modal.getByLabel('Rad etish sababi').fill('Tovarda foydalanish izlari bor');
    await modal.getByRole('button', { name: 'Rad etish' }).click();
    await expect(page.getByText('Qaytarish rad etildi')).toBeVisible();
    expect(api.actions).toEqual([{ action: 'reject', id: '1', body: { reason: 'Tovarda foydalanish izlari bor' } }]);
    await expect(panel).toContainText('Rad etildi');
    await expect(panel).toContainText('Tovarda foydalanish izlari bor');
    await expect(panel.getByRole('button', { name: /Tasdiqlash|Rad etish/ })).toHaveCount(0);

    await drawer(page).getByRole('button', { name: 'Yopish' }).click();
    await expect(page).toHaveURL(/\/returns$/);
  });

  test('operator ham qaytarishlarni ko‘radi va qaror beradi', async ({ page }) => {
    await asSeller(page, operatorUser);
    const api = await mockReturnsApi(page, 'seller', [returnRequest({ status: 'IN_REVIEW' })], 'OPERATOR');
    await page.goto('/returns');
    await expect(page.getByRole('menuitem', { name: 'Qaytarishlar' })).toBeVisible();
    await page.getByRole('button', { name: '#1 qaytarish so‘rovini ko‘rish' }).click();
    await drawer(page).getByRole('button', { name: 'Tasdiqlash' }).click();
    await page.getByRole('dialog', { name: 'Qaytarishni tasdiqlash' }).getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect(history(page)).toContainText('Operator');
    expect(api.actions).toEqual([{ action: 'approve', id: '1', body: {} }]);
  });

  test('390px ekranda ro‘yxat va so‘rov paneli sig‘adi', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await asSeller(page);
    await mockReturnsApi(page, 'seller', [returnRequest()], 'SELLER');
    await page.goto('/returns');
    await expect(rowOf(page, '1')).toContainText('Yuborildi');
    expect(await findClippedBlocks(page)).toEqual([]);
    await page.getByRole('button', { name: '#1 qaytarish so‘rovini ko‘rish' }).click();
    await expect(drawer(page).getByRole('button', { name: 'Rad etish' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('Admin: qaytarishlar va pulni qaytarish', () => {
  test('TC1: sotuvchiga kelgan so‘rov admin ro‘yxatida do‘kon bilan ko‘rinadi, filtrlar backendga ketadi', async ({ page }) => {
    await asAdmin(page, 'ADMIN');
    const api = await mockReturnsApi(page, 'admin', [returnRequest()], 'ADMIN');
    await page.goto('/admin/returns');
    await expect(page.getByRole('menuitem', { name: 'Qaytarishlar' })).toBeVisible();
    const row = rowOf(page, '1');
    await expect(row).toContainText('Ali Market');
    await expect(row).toContainText('Aziza Karimova');
    await expect(row).toContainText('COD');
    await expect(row).toContainText('Yuborildi');

    await page.getByLabel('Holat').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Yuborildi' }).click();
    await page.getByLabel('Do‘kon').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Ali Market' }).click();
    await page.getByLabel('Buyurtma ID').fill('62');
    await expect.poll(() => api.listParams.at(-1)).toEqual({ page: '1', limit: '10', status: 'SUBMITTED', shopId: '4', orderId: '62' });
  });

  test('TC2: tasdiqlash → pulni qaytarish (SUPERADMIN, COD, qisman summa)', async ({ page }) => {
    const warnings = collectUnconnectedFormWarnings(page);
    await asAdmin(page, 'SUPERADMIN');
    const api = await mockReturnsApi(page, 'admin', [returnRequest()], 'SUPERADMIN');
    await page.goto('/admin/returns?id=1');
    const panel = drawer(page);
    // Tasdiqlanmaguncha pul qaytarib bo'lmaydi.
    await expect(panel.getByRole('button', { name: 'Pulni qaytarish' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Tasdiqlash' }).click();
    const approveModal = page.getByRole('dialog', { name: 'Qaytarishni tasdiqlash' });
    await approveModal.getByLabel('Izoh (ixtiyoriy)').fill('Brak tasdiqlandi');
    await approveModal.getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect(page.getByText('Qaytarish tasdiqlandi')).toBeVisible();
    await expect(panel).toContainText('Tasdiqlandi');

    await panel.getByRole('button', { name: 'Pulni qaytarish' }).click();
    const modal = page.getByRole('dialog', { name: 'Pulni qaytarish' });
    await expect(modal).toContainText('COD buyurtma: pulni xaridorga qo‘lda qaytarasiz.');
    const amount = modal.getByLabel('Qaytariladigan summa');
    await expect(amount).toHaveValue('45000');
    // DEFECTIVE — sifat muammosi: omborga qaytarish default o'chiq.
    await expect(modal.getByLabel('Tovar omborga qaytarilsin')).not.toBeChecked();
    // COD'da izohsiz yuborilmaydi.
    await modal.getByRole('button', { name: 'Pulni qaytarish' }).click();
    await expect(modal.getByText('COD buyurtmada pulni qanday qaytarganingizni yozing')).toBeVisible();
    await modal.getByLabel('Pulni qanday qaytardingiz').fill('Karta orqali qaytarildi');
    await amount.fill('40000');
    await modal.getByRole('button', { name: 'Pulni qaytarish' }).click();
    await expect(page.getByText('Pul qaytarildi: 40 000 UZS')).toBeVisible();
    expect(api.actions.map(({ action, body }) => [action, body])).toEqual([
      ['approve', { comment: 'Brak tasdiqlandi' }],
      ['refund', { amount: 40000, restock: false, comment: 'Karta orqali qaytarildi' }],
    ]);
    await expect(panel).toContainText('Pul qaytarildi');
    await expect(panel).toContainText('40 000 UZS');
    await expect(history(page)).toContainText('Bosh administrator');
    await expect(panel.getByRole('button', { name: /Pulni qaytarish|Tasdiqlash|Rad etish/ })).toHaveCount(0);
    expect(warnings).toEqual([]);
  });

  test('summa so‘ralgan summadan oshsa yuborilmaydi; online va sifatli tovarda izoh ixtiyoriy, omborga qaytadi', async ({ page }) => {
    await asAdmin(page, 'SUPERADMIN');
    const api = await mockReturnsApi(page, 'admin', [returnRequest({ status: 'APPROVED', reason: 'CHANGED_MIND', paymentMethod: 'online', comment: null })], 'SUPERADMIN');
    await page.goto('/admin/returns?id=1');
    await drawer(page).getByRole('button', { name: 'Pulni qaytarish' }).click();
    const modal = page.getByRole('dialog', { name: 'Pulni qaytarish' });
    await expect(modal).toContainText('to‘lov provayderi orqali xaridor kartasiga qaytariladi');
    await expect(modal.getByLabel('Tovar omborga qaytarilsin')).toBeChecked();
    await modal.getByLabel('Qaytariladigan summa').fill('50000');
    await modal.getByLabel('Qaytariladigan summa').blur();
    // Input max'ga qisadi yoki xato ko'rsatadi — har holda 45 000 dan ortiq yuborilmaydi.
    await modal.getByRole('button', { name: 'Pulni qaytarish' }).click();
    await expect(page.getByText('Pul qaytarildi: 45 000 UZS')).toBeVisible();
    expect(api.actions).toEqual([{ action: 'refund', id: '1', body: { amount: 45000, restock: true } }]);
  });

  test('ADMIN pulni qaytarish tugmasini ko‘rmaydi, tasdiqlanganni rad eta oladi (nizo)', async ({ page }) => {
    await asAdmin(page, 'ADMIN');
    const api = await mockReturnsApi(page, 'admin', [returnRequest({ status: 'APPROVED' })], 'ADMIN');
    await page.goto('/admin/returns?id=1');
    const panel = drawer(page);
    await expect(panel).toContainText('Tasdiqlandi');
    await expect(panel.getByRole('button', { name: 'Pulni qaytarish' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Rad etish' }).click();
    const modal = page.getByRole('dialog', { name: 'Qaytarishni rad etish' });
    await modal.getByLabel('Rad etish sababi').fill('Sotuvchi dalil taqdim etdi');
    await modal.getByRole('button', { name: 'Rad etish' }).click();
    await expect(panel).toContainText('Rad etildi');
    // Rad etilganni admin qayta tasdiqlay oladi.
    await expect(panel.getByRole('button', { name: 'Tasdiqlash' })).toBeVisible();
    expect(api.actions).toEqual([{ action: 'reject', id: '1', body: { reason: 'Sotuvchi dalil taqdim etdi' } }]);
  });

  test('buyurtma sahifasidan shu buyurtmaning qaytarishlariga o‘tiladi', async ({ page }) => {
    await asAdmin(page, 'ADMIN');
    const api = await mockReturnsApi(page, 'admin', [returnRequest({ orderId: '91' })], 'ADMIN');
    await page.route('**/api/v1/admin/orders/91', (route) => route.fulfill({ json: { data: { id: '91', buyerName: 'Aziza Karimova', status: 'FULFILLED', paymentMethod: 'cod', totalAmount: 45000, deliveryFee: 0, deliveryAddress: null, createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z', sellerOrders: [] } } }));
    await page.goto('/admin/orders/91');
    await page.getByRole('button', { name: 'Qaytarish so‘rovlari' }).click();
    await expect(page).toHaveURL(/\/admin\/returns\?orderId=91$/);
    await expect(page.getByLabel('Buyurtma ID')).toHaveValue('91');
    await expect.poll(() => api.listParams.at(-1)?.orderId).toBe('91');
  });

  test('390px ekranda admin qaytarishlar sahifasi sig‘adi', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await asAdmin(page, 'SUPERADMIN');
    await mockReturnsApi(page, 'admin', [returnRequest({ status: 'APPROVED' })], 'SUPERADMIN');
    await page.goto('/admin/returns');
    await expect(rowOf(page, '1')).toContainText('Tasdiqlandi');
    expect(await findClippedBlocks(page)).toEqual([]);
    await page.getByRole('button', { name: '#1 qaytarish so‘rovini ko‘rish' }).click();
    await drawer(page).getByRole('button', { name: 'Pulni qaytarish' }).click();
    await expect(page.getByRole('dialog', { name: 'Pulni qaytarish' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
