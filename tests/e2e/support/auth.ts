import type { Page } from '@playwright/test';

export const ACCESS_TOKEN_KEY = 'elchi_access_token';
export const TEST_ACCESS_TOKEN = 'e2e.access.token';

export const authenticatedUser = {
  id: 'seller-e2e',
  role: 'SELLER',
  name: 'E2E Sotuvchi',
  phone: '+998901234567',
  email: 'seller@example.com',
  avatarUrl: null,
  isActive: true,
  isDeleted: false,
} as const;

export async function seedAccessToken(
  page: Page,
  accessToken = TEST_ACCESS_TOKEN,
): Promise<void> {
  await page.addInitScript(
    ({ key, token }) => sessionStorage.setItem(key, token),
    { key: ACCESS_TOKEN_KEY, token: accessToken },
  );
}

export const operatorUser = {
  ...authenticatedUser,
  id: 'operator-e2e',
  role: 'OPERATOR',
  name: 'E2E Operator',
} as const;

export async function mockCurrentUser(
  page: Page,
  user: Record<string, unknown> = authenticatedUser,
): Promise<void> {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 200, message: 'OK', data: user }),
    });
  });
}

export async function mockLogout(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: null,
      }),
    });
  });
}

export async function mockDashboard(page: Page): Promise<void> {
  await page.route('**/api/v1/seller/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ordersTotal: 42,
          revenue: 5_400_000,
          pendingShipments: 3,
          delivered: 30,
          lowStockCount: 5,
          topProducts: [{ productId: '88', name: 'Telefon', sold: 21 }],
          salesByDay: [{ date: '2026-07-20', amount: 320_000 }],
        },
      }),
    });
  });
}

/** Do'kon profili — kabinetning ko'p sahifasi shu ma'lumotga tayanadi. */
export const authenticatedShop = {
  id: '15',
  ownerUserId: 'seller-e2e',
  name: 'MarketHub Store',
  slug: 'markethub-store',
  status: 'ACTIVE',
  description: 'Original va sifatli mahsulotlar do‘koni',
  logoUrl: null,
  bannerUrl: null,
  phone: '+998 90 000 00 00',
  regionId: '1',
  districtId: '10',
  address: 'Toshkent shahri, Chilonzor tumani',
  rating: 4.8,
  ordersCount: 128,
} as const;

export async function mockSellerShop(page: Page): Promise<void> {
  await page.route('**/api/v1/sellers/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'OK',
        data: authenticatedShop,
      }),
    });
  });
}

export async function mockProducts(page: Page): Promise<void> {
  await page.route('**/api/v1/products/my**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
}

/** Kategoriya daraxti — mahsulot formasidagi tanlash ro'yxati shunga tayanadi. */
export const publicCategoryTree = [
  {
    id: '1', name: 'Elektronika', slug: 'elektronika', parentId: null,
    iconUrl: null, sortOrder: 1, isActive: true,
    children: [
      {
        id: '2', name: 'Smartfonlar', slug: 'smartfonlar', parentId: '1',
        iconUrl: null, sortOrder: 1, isActive: true, children: [],
      },
    ],
  },
  {
    id: '3', name: 'Kiyim', slug: 'kiyim', parentId: null,
    iconUrl: null, sortOrder: 2, isActive: true, children: [],
  },
] as const;

export async function mockCategories(page: Page): Promise<void> {
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 200, message: 'OK', data: publicCategoryTree }),
    });
  });
}

export async function installAuthenticatedSession(
  page: Page,
  user: Record<string, unknown> = authenticatedUser,
): Promise<void> {
  await seedAccessToken(page);
  await mockCurrentUser(page, user);
  await mockLogout(page);
  await mockProducts(page);
  await mockCategories(page);
  await mockDashboard(page);
  // Test o'zi `page.route` qo'shsa, Playwright keyingi qo'shilganini
  // birinchi ishlatadi — shuning uchun bu umumiy mock ustidan yozilaveradi.
  await mockSellerShop(page);
}
