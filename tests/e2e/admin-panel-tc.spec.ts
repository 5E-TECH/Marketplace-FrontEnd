import { expect, test, type Page } from '@playwright/test';
import { authenticatedUser, mockDashboard, mockLogout, mockProducts, mockSellerShop, seedAccessToken } from './support/auth';

/**
 * QA ro'yxati (C6.5): admin foydalanuvchi rolini o'zgartiradi va nomidan kiradi —
 * curl kerak emas (mahsulot yashirish va do'kon tariflari sahifalari FE-01 da uzildi).
 * Har bir TC boshidan oxirigacha: amal, backendga ketgan so'rov, muvaffaqiyat
 * xabari va ekrandagi yangi holat.
 * Kompyuter va telefon kengligida tekshiriladi.
 */
const ADMIN_TOKEN = 'admin.token';
const IMPERSONATION_TOKEN = 'imp.token';
const json = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify({ data }) });
const admin = (role: 'ADMIN' | 'SUPERADMIN') => ({ id: 'admin-1', role, name: 'Panel Admin', phone: '+998900000001', email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false });
const userRecord = (id: string, name: string, role: string) => ({
  id, name, role, phone: '+998901112233', email: null, avatarUrl: null, isActive: true, isBlocked: false, isDeleted: false,
  shopId: role === 'SELLER' || role === 'OPERATOR' ? '15' : null, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-02T08:00:00.000Z',
});

async function mockAdmin(page: Page, role: 'ADMIN' | 'SUPERADMIN') {
  // Mock qilinmagan so'rov dev proxy orqali haqiqiy backendga chiqmasin.
  await page.route('**/api/v1/**', (route) => route.fulfill(json({ message: 'mock yo‘q' }, 404)));
  await seedAccessToken(page, ADMIN_TOKEN);
  await mockLogout(page);
  await page.route('**/api/v1/auth/me', (route) => {
    const authorization = route.request().headers().authorization ?? '';
    // Admin foydalanuvchilar bo'limi hali eski rollarda (FE-15); nomidan kirilgan sessiya yangi rol bilan (BE-05).
    if (authorization === `Bearer ${IMPERSONATION_TOKEN}`) return route.fulfill(json({ ...authenticatedUser, id: '42', name: 'Ali Valiyev', role: 'AFFILIATE' }));
    if (authorization === `Bearer ${ADMIN_TOKEN}`) return route.fulfill(json(admin(role)));
    return route.fulfill(json({ message: 'Token muddati tugagan' }, 401));
  });
}

async function mockUser(page: Page, record: ReturnType<typeof userRecord>) {
  const state = { current: { ...record }, roleBodies: [] as unknown[] };
  await page.route(`**/api/v1/admin/users/${record.id}`, (route) => route.fulfill(json(state.current)));
  await page.route(`**/api/v1/admin/users/${record.id}/role`, (route) => {
    const body = route.request().postDataJSON() as { role: string };
    state.roleBodies.push(body);
    state.current = { ...state.current, role: body.role };
    return route.fulfill(json(state.current));
  });
  return state;
}

for (const width of [1440, 390]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('TC1: admin foydalanuvchi rolini paneldan o‘zgartiradi', async ({ page }) => {
      await mockAdmin(page, 'ADMIN');
      const user = await mockUser(page, userRecord('42', 'Ali Valiyev', 'SELLER'));
      await page.goto('/admin/users/42');
      const detail = page.getByTestId('detail-page');
      await expect(detail.getByRole('heading', { name: 'Ali Valiyev' })).toBeVisible();

      await page.getByRole('button', { name: 'Rolni o‘zgartirish' }).click();
      const dialog = page.getByRole('dialog', { name: 'Foydalanuvchi rolini o‘zgartirish' });
      await expect(dialog).toContainText('Joriy rol: Sotuvchi');
      await dialog.getByLabel('Yangi rol').click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Xaridor' }).click();
      await dialog.getByRole('button', { name: 'Rolni o‘zgartirish' }).click();

      await expect(page.getByText('Foydalanuvchi roli o‘zgartirildi')).toBeVisible();
      await expect(dialog).toBeHidden();
      expect(user.roleBodies).toEqual([{ role: 'BUYER' }]);
      // Sahifa backenddan qayta o'qiladi: yangi rol ko'rinadi.
      await expect(detail.getByText('BUYER', { exact: true }).first()).toBeVisible();
      await expect(detail.getByText('SELLER', { exact: true })).toHaveCount(0);
    });

    test('TC2: SUPERADMIN foydalanuvchi nomidan kira oladi va ogohlantirish chizig‘i ko‘rinadi', async ({ page }) => {
      await mockAdmin(page, 'SUPERADMIN');
      await mockUser(page, userRecord('42', 'Ali Valiyev', 'SELLER'));
      await mockProducts(page);
      await mockDashboard(page);
      await mockSellerShop(page);
      let impersonateCalls = 0;
      await page.route('**/api/v1/admin/users/42/impersonate', (route) => {
        impersonateCalls += 1;
        return route.fulfill(json({
          impersonationToken: IMPERSONATION_TOKEN, expiresIn: 900, expiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: { id: '42', name: 'Ali Valiyev', role: 'AFFILIATE' },
        }));
      });
      await page.goto('/admin/users/42');

      await page.getByRole('button', { name: 'Nomidan kirish' }).click();
      await page.getByRole('dialog', { name: 'Ali Valiyev nomidan kirilsinmi?' }).getByRole('button', { name: 'Nomidan kirish' }).click();

      await expect(page).toHaveURL('/affiliate');
      await expect(page.getByRole('heading', { level: 1, name: 'Bosh sahifa' })).toBeVisible();
      const banner = page.getByTestId('impersonation-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Siz Ali Valiyev nomidan ko‘ryapsiz');
      await expect(banner).toContainText(/1[45]:\d\d/);
      await expect(banner.getByRole('button', { name: 'Chiqish' })).toBeVisible();
      expect(impersonateCalls).toBe(1);

      await banner.getByRole('button', { name: 'Chiqish' }).click();
      await expect(page).toHaveURL('/admin/users/42');
      await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
    });

    test('TC3: oddiy ADMIN’ga "Nomidan kirish" tugmasi ko‘rinmaydi', async ({ page }) => {
      await mockAdmin(page, 'ADMIN');
      await mockUser(page, userRecord('42', 'Ali Valiyev', 'SELLER'));
      await mockUser(page, userRecord('43', 'Vali Operator', 'OPERATOR'));
      for (const [id, name] of [['42', 'Ali Valiyev'], ['43', 'Vali Operator']] as const) {
        await page.goto(`/admin/users/${id}`);
        await expect(page.getByTestId('detail-page').getByRole('heading', { name })).toBeVisible();
        // Sahifa to'liq yuklangan (boshqa amallar bor), lekin nomidan kirish yo'q.
        await expect(page.getByRole('button', { name: 'Rolni o‘zgartirish' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Nomidan kirish' })).toHaveCount(0);
      }
    });
  });
}

