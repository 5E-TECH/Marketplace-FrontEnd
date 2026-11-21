import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';
import { findClippedBlocks } from './support/layout';
import { mainNav } from './support/shell';

const admin = {
  id: 'ui-admin', role: 'ADMIN', name: 'UI Admin', phone: '+998901234567',
  isActive: true, isDeleted: false,
} as const;

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

  const contentBox = await page.locator('[data-app-main]').boundingBox();
  const detailBox = await detailPage.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(detailBox!.width / contentBox!.width).toBeGreaterThan(0.9);
});

test('kategoriya va audit shared panelda, menyu va audit matni o‘qiladigan o‘lchamda', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: '1', name: 'Elektronika', slug: 'elektronika', parentId: null, iconUrl: null, sortOrder: 0, isActive: true, children: [] }] }),
  }));
  await page.goto('/admin/categories');
  await expect(page.getByTestId('category-table').getByText('Elektronika', { exact: true })).toBeVisible();

  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [{ id: '1', actorId: '2', action: 'shop.suspend', entityType: 'Shop', entityId: '3', createdAt: '2026-09-12T09:37:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 } }),
  }));
  await page.goto('/admin/audit-logs');
  const auditPanel = page.getByText('Jami 1 ta', { exact: true }).locator('xpath=ancestor::section[1]');
  await expect(auditPanel.locator('table')).toBeVisible();

  const sidebarFontSize = await mainNav(page).getByRole('link', { name: 'Audit jurnali' }).evaluate((node) => getComputedStyle(node).fontSize);
  const tableFontSize = await auditPanel.locator('tbody td').first().evaluate((node) => getComputedStyle(node).fontSize);
  // karkas-E 1.3: menyu bandi 14/21.
  expect(Number.parseFloat(sidebarFontSize)).toBe(14);
  expect(Number.parseFloat(tableFontSize)).toBeGreaterThanOrEqual(14);
});

test('1024px da menyu bilan audit sahifasi va yuqori qator kontentdan chiqib kesilmaydi', async ({ page }) => {
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
