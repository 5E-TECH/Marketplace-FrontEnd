import { expect, test, type Page } from '@playwright/test';
import { authenticatedUser, mockDashboard, mockLogout, mockProducts, mockSellerShop, seedAccessToken } from './support/auth';

/**
 * QA ro'yxati (C6.5, C6.6, C1.46): admin uchala imkoniyatdan panel orqali
 * foydalana oladi — curl kerak emas. Har bir TC boshidan oxirigacha: amal,
 * backendga ketgan so'rov, muvaffaqiyat xabari va ekrandagi yangi holat.
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
    if (authorization === `Bearer ${IMPERSONATION_TOKEN}`) return route.fulfill(json({ ...authenticatedUser, id: '42', name: 'Ali Valiyev', role: 'SELLER' }));
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
          user: { id: '42', name: 'Ali Valiyev', role: 'SELLER', shopId: '15' },
        }));
      });
      await page.goto('/admin/users/42');

      await page.getByRole('button', { name: 'Nomidan kirish' }).click();
      await page.getByRole('dialog', { name: 'Ali Valiyev nomidan kirilsinmi?' }).getByRole('button', { name: 'Nomidan kirish' }).click();

      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
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

    test('TC4: mahsulot sabab bilan yashiriladi va qaytariladi', async ({ page }) => {
      await mockAdmin(page, 'ADMIN');
      const state = { blocked: false, hideBodies: [] as unknown[], reactivateBodies: [] as (string | null)[] };
      const product = () => ({
        id: '12', shopId: '5', ownerUserId: '42', categoryId: '1', name: 'iPhone 16 Pro', slug: 'iphone-16-pro', description: 'Titanium, 256 GB',
        price: 14_999_000, oldPrice: null, imageUrl: null, images: [], attributes: {}, hasVariants: false, status: 'ACTIVE', rating: 0,
        createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-09-01T11:30:00.000Z', variants: [], isBlocked: state.blocked,
      });
      await page.route(/\/api\/v1\/admin\/shops\/5$/, (route) => route.fulfill(json({ id: '5', ownerUserId: '42', name: 'Texno Market', status: 'ACTIVE', stats: {} })));
      await page.route('**/api/v1/admin/categories', (route) => route.fulfill(json([{ id: '1', name: 'Smartfonlar', children: [] }])));
      await page.route('**/api/v1/admin/products/12**', (route) => {
        const url = route.request().url();
        if (url.endsWith('/hide')) { state.hideBodies.push(route.request().postDataJSON()); state.blocked = true; return route.fulfill(json({})); }
        if (url.endsWith('/reactivate')) { state.reactivateBodies.push(route.request().postData()); state.blocked = false; return route.fulfill(json({})); }
        return route.fulfill(json(product()));
      });
      await page.goto('/admin/products/12');
      const detail = page.getByTestId('detail-page');
      await expect(detail.getByRole('heading', { name: 'iPhone 16 Pro' })).toBeVisible();

      await page.getByRole('button', { name: 'Yashirish' }).click();
      const hideDialog = page.getByRole('dialog', { name: 'Mahsulot yashirilsinmi?' });
      // Sababsiz yashirib bo'lmaydi.
      await hideDialog.getByRole('button', { name: 'Yashirish' }).click();
      await expect(hideDialog.getByText('Sotuvchiga yuboriladigan sababni kiriting')).toBeVisible();
      expect(state.hideBodies).toEqual([]);
      await hideDialog.getByLabel('Yashirish sababi').fill('Marketplace qoidalariga mos emas');
      await hideDialog.getByRole('button', { name: 'Yashirish' }).click();

      await expect(page.getByText('Mahsulot yashirildi')).toBeVisible();
      expect(state.hideBodies).toEqual([{ reason: 'Marketplace qoidalariga mos emas' }]);
      await expect(detail.getByText('Yashirilgan', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Ko‘rsatish' }).click();
      await page.getByRole('dialog', { name: 'Mahsulot ko‘rsatilsinmi?' }).getByRole('button', { name: 'Ko‘rsatish' }).click();
      await expect(page.getByText('Mahsulot yana ko‘rsatiladi')).toBeVisible();
      expect(state.reactivateBodies).toEqual([null]);
      await expect(page.getByRole('button', { name: 'Yashirish' })).toBeVisible();
      await expect(detail.getByText('Yashirilgan', { exact: true })).toHaveCount(0);
    });

    test('TC5: do‘konga tavsiya belgisi qo‘yiladi va olinadi', async ({ page }) => {
      await mockAdmin(page, 'ADMIN');
      const { featureBodies } = await mockShop(page);
      await page.goto('/admin/shops');
      await page.getByRole('button', { name: 'Ali Market tafsilotlarini ko‘rish' }).click();
      const drawer = page.getByRole('dialog', { name: /Ali Market/ });

      await drawer.getByRole('button', { name: 'Tavsiya etish' }).click();
      await expect(page.getByText('Do‘kon bosh sahifaga chiqarildi')).toBeVisible();
      await expect(drawer.getByRole('button', { name: 'Tavsiyadan olish' })).toBeVisible();

      await drawer.getByRole('button', { name: 'Tavsiyadan olish' }).click();
      await expect(page.getByText('Do‘kon tavsiyalardan olib tashlandi')).toBeVisible();
      await expect(drawer.getByRole('button', { name: 'Tavsiya etish' })).toBeVisible();
      expect(featureBodies).toEqual([{ featured: true }, { featured: false }]);
    });

    test('TC6: do‘kon tarifi paneldan ko‘riladi va o‘zgartiriladi', async ({ page }) => {
      await mockAdmin(page, 'ADMIN');
      const { tariffBodies } = await mockShop(page);
      await page.goto('/admin/shops');
      await page.getByRole('button', { name: 'Ali Market tafsilotlarini ko‘rish' }).click();
      const drawer = page.getByRole('dialog', { name: /Ali Market/ });
      // Ko'rish: joriy tariflar drawer'da.
      await expect(drawer).toContainText('25 000 so‘m');
      await expect(drawer).toContainText('15 000 so‘m');

      await drawer.getByRole('button', { name: 'Tariflar' }).click();
      const dialog = page.getByRole('dialog', { name: 'Ali Market tariflari' });
      await expect(dialog.getByLabel('Uyga yetkazish tarifi')).toHaveValue('25000');
      await expect(dialog.getByLabel('Elchi markazigacha yetkazish tarifi')).toHaveValue('15000');
      await dialog.getByLabel('Uyga yetkazish tarifi').fill('30000');
      await dialog.getByLabel('Elchi markazigacha yetkazish tarifi').fill('18000');
      await dialog.getByRole('button', { name: 'Saqlash' }).click();

      await expect(page.getByText('Yetkazib berish tariflari saqlandi')).toBeVisible();
      await expect(dialog).toBeHidden();
      expect(tariffBodies).toEqual([{ tariffHome: 30000, tariffCenter: 18000 }]);
      // Saqlangach drawer backenddan qayta o'qiladi.
      await expect(drawer).toContainText('30 000 so‘m');
      await expect(drawer).toContainText('18 000 so‘m');
    });
  });
}

async function mockShop(page: Page) {
  const state = { featured: false, tariffHome: 25000, tariffCenter: 15000, featureBodies: [] as unknown[], tariffBodies: [] as unknown[] };
  const shop = () => ({
    id: '15', ownerUserId: '42', name: 'Ali Market', slug: 'ali-market', description: null, logoUrl: null, bannerUrl: null, status: 'ACTIVE',
    phone: '+998901234567', regionId: '1', districtId: '2', address: 'Toshkent', rating: 0, ordersCount: 0, elchiMarketId: null, isDeleted: false,
    isFeatured: state.featured, tariffHome: state.tariffHome, tariffCenter: state.tariffCenter, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  });
  await page.route('**/api/v1/admin/shops?**', (route) => route.fulfill(json({ items: [shop()], total: 1, page: 1, limit: 20 })));
  await page.route('**/api/v1/admin/shops/15', (route) => route.fulfill(json({ ...shop(), stats: { products: 12, orders: 28, warehouses: 2 } })));
  await page.route('**/api/v1/admin/shops/15/feature', (route) => {
    const body = route.request().postDataJSON() as { featured: boolean };
    state.featureBodies.push(body);
    state.featured = body.featured;
    return route.fulfill(json({}, 201));
  });
  await page.route('**/api/v1/admin/shops/15/tariffs', (route) => {
    const body = route.request().postDataJSON() as { tariffHome: number; tariffCenter: number };
    state.tariffBodies.push(body);
    state.tariffHome = body.tariffHome;
    state.tariffCenter = body.tariffCenter;
    return route.fulfill(json({}));
  });
  return state;
}
