import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const adminUser = {
  id: 'admin-e2e',
  role: 'ADMIN',
  name: 'E2E Admin',
  phone: '+998901234567',
  isActive: true,
  isDeleted: false,
} as const;

const superAdminUser = {
  ...adminUser,
  id: 'superadmin-e2e',
  role: 'SUPERADMIN',
  name: 'E2E Superadmin',
} as const;

async function mockAdminDashboard(page: Page) {
  await page.route('**/api/v1/admin/dashboard', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        revenue: 1_000_000,
        gmv: 1_200_000,
        orders: { total: 20, today: 2 },
        shops: { active: 5, pending: 1 },
        users: { total: 100, buyers: 80 },
      },
    }),
  }));
  await page.route('**/api/v1/admin/shops?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 5 } }),
  }));
}

test('TC2: ADMIN login admin sidebarni ko‘radi', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await mockAdminDashboard(page);
  await page.goto('/admin/overview');

  await expect(page.getByTestId('admin-layout')).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Admin menyusi' });
  for (const item of ['Dashboard', 'Accountlar', 'Do‘konlar', 'Buyurtmalar', 'Kategoriyalar']) {
    await expect(sidebar.getByRole('menuitem', { name: item })).toBeVisible();
  }
  await expect(sidebar.getByRole('menuitem', { name: 'Moliya' })).toHaveCount(0);
  await expect(sidebar.getByRole('menuitem', { name: 'Jamoa' })).toHaveCount(0);

  await page.goto('/admin/finance');
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await page.goto('/admin/team');
  await expect(page).toHaveURL(/\/admin\/overview$/);
});

test('TC1: SELLER admin URL ga kira olmaydi va redirect qilinadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/admin/overview');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('admin-layout')).toHaveCount(0);
  await expect(page.getByText('ADMIN REJIM', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
});

test('TC3: SUPERADMIN qo‘shimcha moliya va jamoa menyularini ko‘radi', async ({ page }) => {
  await installAuthenticatedSession(page, superAdminUser);
  await mockAdminDashboard(page);
  await page.goto('/admin/overview');

  const sidebar = page.getByRole('complementary', { name: 'Admin menyusi' });
  await expect(sidebar.getByRole('menuitem', { name: 'Moliya' })).toBeVisible();
  await expect(sidebar.getByRole('menuitem', { name: 'Jamoa' })).toBeVisible();
});

test('TC4: ADMIN rejim belgisi ko‘rinadi', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await mockAdminDashboard(page);
  await page.goto('/admin/overview');

  await expect(page.getByText('ADMIN REJIM', { exact: true })).toBeVisible();
});

test('admin mobile menyusi overflow bermaydi va navigatsiya qiladi', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await mockAdminDashboard(page);
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [] }),
  }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/overview');

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menyuni ochish' }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('menuitem', { name: 'Kategoriyalar' }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('sidebar yig‘ilganda admin ikonkalari o‘lchami saqlanadi va search ikonka ixcham', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await mockAdminDashboard(page);
  await page.goto('/admin/overview');

  const dashboardIcon = page
    .getByRole('complementary', { name: 'Admin menyusi' })
    .getByRole('menuitem', { name: 'Dashboard' })
    .locator('svg');
  const expandedBox = await dashboardIcon.boundingBox();
  expect(expandedBox?.width).toBe(22);
  expect(expandedBox?.height).toBe(22);

  await page.getByRole('button', { name: 'Menyuni yopish' }).click();
  const collapsedBox = await dashboardIcon.boundingBox();
  expect(collapsedBox?.width).toBe(22);
  expect(collapsedBox?.height).toBe(22);

  const searchIconBox = await page
    .getByRole('searchbox', { name: 'Global qidiruv' })
    .locator('xpath=preceding-sibling::*[1]//*[name()="svg"]')
    .boundingBox();
  expect(searchIconBox?.width).toBeLessThanOrEqual(15);
  expect(searchIconBox?.height).toBeLessThanOrEqual(15);
});
