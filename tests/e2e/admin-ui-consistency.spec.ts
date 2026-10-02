import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';
import { findClippedBlocks } from './support/layout';

const admin = {
  id: 'ui-admin', role: 'ADMIN', name: 'UI Admin', phone: '+998901234567',
  isActive: true, isDeleted: false,
} as const;

async function mockDashboard(page: Page) {
  await page.route('**/api/v1/admin/dashboard', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      revenue: 0, gmv: 0,
      orders: { total: 2, today: 2 },
      shops: { total: 3, active: 3, pending: 0, suspended: 0, rejected: 0 },
      users: { total: 4, sellers: 3, buyers: 1, admins: 1, operators: 0 },
    } }),
  }));
  await page.route('**/api/v1/admin/shops**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 5 } }),
  }));
}

test('dashboard kartalari va jadval paneli orasida aniq bo‘shliq bor', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await mockDashboard(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/admin/overview');

  const metricGrid = page.getByRole('region', { name: 'Asosiy statistika' });
  const tablePanel = page.getByText('Tasdiq kutayotgan do‘konlar', { exact: true }).locator('xpath=ancestor::section[1]');
  const metricBox = await metricGrid.boundingBox();
  const panelBox = await tablePanel.boundingBox();
  expect(metricBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.y - (metricBox!.y + metricBox!.height)).toBeGreaterThanOrEqual(20);
});

test('detail sahifa admin content kengligidan bir xil foydalanadi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await page.route('**/api/v1/admin/users/11', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      id: '11', name: 'QA Buyurtma', phone: '+998901063014', email: null,
      role: 'BUYER', isActive: true, isBlocked: false, isDeleted: false,
      shopId: null, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-02T08:00:00.000Z',
    } }),
  }));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/admin/users/11');

  const detailPage = page.getByTestId('detail-page');
  await expect(detailPage).toBeVisible();

  const contentBox = await page.locator('.ant-layout-content').boundingBox();
  const detailBox = await detailPage.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(detailBox!.width / contentBox!.width).toBeGreaterThan(0.9);
});

test('kategoriya va audit shared panelda, sidebar va audit matni o‘qiladigan o‘lchamda', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: '1', name: 'Elektronika', slug: 'elektronika', parentId: null, iconUrl: null, sortOrder: 0, isActive: true, children: [] }] }),
  }));
  await page.goto('/admin/categories');
  const categoryPanel = page.getByText('Jami 1 ta', { exact: true }).locator('xpath=ancestor::section[1]');
  await expect(categoryPanel.getByRole('tree')).toBeVisible();

  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [{ id: '1', actorId: '2', action: 'shop.suspend', entityType: 'Shop', entityId: '3', createdAt: '2026-09-12T09:37:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 } }),
  }));
  await page.goto('/admin/audit-logs');
  const auditPanel = page.getByText('Jami 1 ta', { exact: true }).locator('xpath=ancestor::section[1]');
  await expect(auditPanel.locator('table')).toBeVisible();

  const sidebarFontSize = await page.getByRole('menuitem', { name: 'Audit loglar' }).evaluate((node) => getComputedStyle(node).fontSize);
  const tableFontSize = await auditPanel.locator('tbody td').first().evaluate((node) => getComputedStyle(node).fontSize);
  expect(Number.parseFloat(sidebarFontSize)).toBeGreaterThanOrEqual(15);
  expect(Number.parseFloat(tableFontSize)).toBeGreaterThanOrEqual(14);
});

test('1024px da sidebar bilan audit sahifasi va header kontentdan chiqib kesilmaydi', async ({ page }) => {
  await installAuthenticatedSession(page, { ...admin, name: 'Gulnora Saidakbarova-Mirzaahmedova' });
  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [{ id: '1', actorId: '2', action: 'shop.suspend', entityType: 'Shop', entityId: '3', createdAt: '2026-09-12T09:37:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 } }),
  }));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/admin/audit-logs');
  await expect(page.getByText('Jami 1 ta', { exact: true })).toBeVisible();
  expect(await findClippedBlocks(page)).toEqual([]);
});
