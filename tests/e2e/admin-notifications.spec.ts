import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const superadmin = { id: 'notify-superadmin', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } as const;
const admin = { ...superadmin, id: 'notify-admin', role: 'ADMIN', name: 'Admin' } as const;

const templates = [
  { key: 'shop_approved', name: 'Do‘kon tasdiqlandi', description: 'Admin do‘konni tasdiqlaganda sotuvchiga', variables: { shopName: 'Do‘kon nomi' }, title: 'Do‘kon tasdiqlandi', body: '{shopName} do‘koningiz faol holatga o‘tdi.', customized: false, defaultTitle: 'Do‘kon tasdiqlandi', defaultBody: '{shopName} do‘koningiz faol holatga o‘tdi.', updatedAt: null },
  { key: 'order_created', name: 'Yangi buyurtma', description: 'Buyurtma tasdiqlanganda', variables: { orderNumber: 'Buyurtma raqami', totalAmount: 'Summa' }, title: 'Buyurtmangiz qabul qilindi', body: '{orderNumber} raqamli buyurtma yaratildi.', customized: true, defaultTitle: 'Yangi buyurtma', defaultBody: '{orderNumber} raqamli buyurtma yaratildi.', updatedAt: '2026-09-24T10:00:00.000Z' },
];
const history = [{ id: '3', audience: 'sellers', channels: [], title: 'Eski aksiya', body: 'Matn', recipientsCount: 40, sentCount: 40, status: 'DONE', createdAt: '2026-09-20T10:00:00.000Z', finishedAt: '2026-09-20T10:01:00.000Z', lastError: null }];

async function mockNotifications(page: Page, calls: { method: string; path: string; body: unknown }[] = []) {
  await page.route('**/api/v1/admin/notifications/templates**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ method: request.method(), path, body: request.postDataJSON() });
    if (request.method() === 'GET') return route.fulfill({ json: { data: templates } });
    if (path.endsWith('/reset')) return route.fulfill({ json: { data: { ...templates[1], customized: false } } });
    const body = request.postDataJSON() as { title: string; body: string };
    if (body.body.includes('{phone}')) return route.fulfill({ status: 400, json: { statusCode: 400, message: 'Noma’lum o‘zgaruvchi: {phone}. Mumkin: {shopName}', errorCode: 'VALIDATION_ERROR' } });
    return route.fulfill({ json: { data: { ...templates[0], ...body, customized: true } } });
  });
  await page.route('**/api/v1/admin/broadcasts**', (route) => route.fulfill({ json: { data: { items: history, total: 1, page: 1, limit: 10, totalPages: 1 } } }));
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => { throw error; });
});

test('TC1/TC2: shablonlar ro‘yxati, o‘zgaruvchi qo‘shib tahrirlash va xato matni', async ({ page }) => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  await installAuthenticatedSession(page, admin);
  await mockNotifications(page, calls);
  await page.goto('/admin/notifications');

  await expect(page.getByRole('heading', { name: 'Xabarlar' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Yangi buyurtma' })).toContainText('Tahrirlangan');
  await expect(page.getByRole('row').filter({ hasText: 'Do‘kon tasdiqlandi' })).toContainText('Standart');

  await page.getByRole('button', { name: '“Do‘kon tasdiqlandi” shablonini tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: '“Do‘kon tasdiqlandi” shabloni' });
  await dialog.getByRole('textbox', { name: /Matn/ }).fill('Tabriklaymiz! ');
  await dialog.getByRole('button', { name: 'shopName o‘zgaruvchisini matnga qo‘shish' }).click();
  await expect(dialog.getByRole('textbox', { name: /Matn/ })).toHaveValue('Tabriklaymiz! {shopName}');
  // Jonli ko‘rinishda o‘zgaruvchi tavsif bilan ko‘rinadi.
  await expect(dialog).toContainText('Tabriklaymiz! ‹Do‘kon nomi›');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => calls.find((call) => call.method === 'PATCH')).toEqual({
    method: 'PATCH',
    path: '/api/v1/admin/notifications/templates/shop_approved',
    body: { title: 'Do‘kon tasdiqlandi', body: 'Tabriklaymiz! {shopName}' },
  });
  await expect(page.locator('.ant-message')).toContainText('Shablon saqlandi');

  // Noma’lum o‘zgaruvchi — backend matni ko‘rinadi, oyna yopilmaydi.
  await page.getByRole('button', { name: '“Do‘kon tasdiqlandi” shablonini tahrirlash' }).click();
  await dialog.getByRole('textbox', { name: /Matn/ }).fill('{shopName} {phone}');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.locator('.ant-message')).toContainText('Noma’lum o‘zgaruvchi: {phone}');
  await expect(dialog).toBeVisible();
});

test('tahrirlangan shablonni standartga qaytarish', async ({ page }) => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  await installAuthenticatedSession(page, admin);
  await mockNotifications(page, calls);
  await page.goto('/admin/notifications');
  await page.getByRole('button', { name: '“Yangi buyurtma” shablonini tahrirlash' }).click();
  await page.getByRole('button', { name: 'Standartga qaytarish' }).click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: 'OK' }).click();
  await expect.poll(() => calls.find((call) => call.path.endsWith('/reset'))?.method).toBe('POST');
  await expect(page.locator('.ant-message')).toContainText('standart matnga qaytarildi');
});

test('TC3: SUPERADMIN ko‘rib chiqib, tasdiqlab, aynan shu xabarni token bilan yuboradi', async ({ page }) => {
  await installAuthenticatedSession(page, superadmin);
  await mockNotifications(page);
  let previewBody: unknown;
  let sendBody: unknown;
  await page.route('**/api/v1/admin/broadcast/preview', async (route) => {
    previewBody = route.request().postDataJSON();
    await route.fulfill({ json: { data: { ...(previewBody as object), recipientsCount: 42, previewToken: 'a'.repeat(64) } } });
  });
  await page.route('**/api/v1/admin/broadcast', async (route) => {
    sendBody = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { data: { id: '9', ...(sendBody as object), recipientsCount: 42, sentCount: 0, status: 'QUEUED', createdAt: '2026-09-24T10:00:00.000Z', finishedAt: null, lastError: null } } });
  });
  await page.goto('/admin/notifications?tab=broadcast');

  await expect(page.getByRole('row').filter({ hasText: 'Eski aksiya' })).toContainText('40 / 40');
  // antd radio-tugmasining input'i ko‘rinmas — label bosiladi.
  await page.locator('.ant-radio-button-wrapper').filter({ hasText: 'Sotuvchilar' }).click();
  await expect(page.getByRole('radio', { name: 'Sotuvchilar' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'SMS (pulli)' }).check();
  await page.getByLabel('Sarlavha').fill('Yangi aksiya');
  await page.getByRole('textbox', { name: /Matn/ }).fill('Bugun 20% chegirma');
  await page.getByRole('button', { name: 'Ko‘rib chiqish' }).click();
  await expect.poll(() => previewBody).toEqual({ audience: 'sellers', channels: ['sms'], title: 'Yangi aksiya', body: 'Bugun 20% chegirma' });

  const dialog = page.getByRole('dialog', { name: 'Yuborishdan oldin tekshiring' });
  await expect(dialog).toContainText('42 ta foydalanuvchi');
  await expect(dialog).toContainText('Ilova ichida, SMS (pulli)');
  await expect(dialog).toContainText('Yuborilgan xabarni qaytarib bo‘lmaydi');
  const sendButton = dialog.getByRole('button', { name: 'Yuborish' });
  await expect(sendButton).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Xabarni 42 ta foydalanuvchiga yuborishni tasdiqlayman' }).check();
  await sendButton.click();

  await expect.poll(() => sendBody).toEqual({ audience: 'sellers', channels: ['sms'], title: 'Yangi aksiya', body: 'Bugun 20% chegirma', previewToken: 'a'.repeat(64) });
  await expect(page.locator('.ant-message')).toContainText('42 ta foydalanuvchiga yuborilmoqda');
  await expect(dialog).toBeHidden();
});

test('preview’dan keyin o‘zgargan bo‘lsa (409) — sabab ko‘rinadi, oyna yopiladi', async ({ page }) => {
  await installAuthenticatedSession(page, superadmin);
  await mockNotifications(page);
  await page.route('**/api/v1/admin/broadcast/preview', (route) => route.fulfill({ json: { data: { audience: 'all', channels: [], title: 'A', body: 'B', recipientsCount: 5, previewToken: 'b'.repeat(64) } } }));
  await page.route('**/api/v1/admin/broadcast', (route) => route.fulfill({ status: 409, json: { statusCode: 409, message: 'Xabar yoki qabul qiluvchilar soni ko‘rib chiqilgandan keyin o‘zgardi — qayta ko‘rib chiqing', errorCode: 'CONFLICT' } }));
  await page.goto('/admin/notifications?tab=broadcast');
  await page.getByLabel('Sarlavha').fill('A');
  await page.getByRole('textbox', { name: /Matn/ }).fill('B');
  await page.getByRole('button', { name: 'Ko‘rib chiqish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yuborishdan oldin tekshiring' });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Yuborish' }).click();
  await expect(page.locator('.ant-message')).toContainText('qayta ko‘rib chiqing');
  await expect(dialog).toBeHidden();
});

test('TC4: oddiy ADMIN ommaviy xabar yubora olmaydi — faqat tarix', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await mockNotifications(page);
  let previewCalled = false;
  await page.route('**/api/v1/admin/broadcast/**', (route) => { previewCalled = true; return route.abort(); });
  await page.goto('/admin/notifications?tab=broadcast');
  await expect(page.getByRole('alert')).toContainText('faqat SUPERADMIN');
  await expect(page.getByRole('button', { name: 'Ko‘rib chiqish' })).toHaveCount(0);
  await expect(page.getByLabel('Sarlavha')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Eski aksiya' })).toBeVisible();
  expect(previewCalled).toBe(false);
});

test('xabarlar sahifasi mobil ekranda sig‘adi', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installAuthenticatedSession(page, superadmin);
  await mockNotifications(page);
  await page.goto('/admin/notifications');
  await expect(page.getByRole('row').filter({ hasText: 'Yangi buyurtma' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Ommaviy xabar' }).click();
  await expect(page.getByRole('button', { name: 'Ko‘rib chiqish' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
