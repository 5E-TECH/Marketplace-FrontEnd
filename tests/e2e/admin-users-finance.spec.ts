import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }) }));
});

test('admin users list, detail va block/unblock endpointlari ishlaydi', async ({ page }) => {
  const user = { id: '17', name: 'Ali Valiyev', phone: '+998901112233', role: 'BUYER', isBlocked: false, createdAt: '2026-09-04T08:00:00.000Z' };
  let blocked = false;
  await page.route('**/api/v1/admin/users**', async route => {
    const request = route.request();
    if (request.url().endsWith('/17/block')) { blocked = true; await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }); return; }
    if (request.url().endsWith('/17')) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: user }) }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [user], total: 1, page: 1, limit: 20, totalPages: 1 } }) });
  });
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Foydalanuvchi tafsilotlari' }).click();
  await expect(page.getByRole('dialog')).toContainText('Ali Valiyev');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Bloklash' }).click();
  await page.getByRole('button', { name: 'Bloklash', exact: true }).last().click();
  await expect.poll(() => blocked).toBe(true);
});

test('admin payout action va report endpointlari ishlaydi', async ({ page }) => {
  const payout = { id: '8', shopId: '7', shopName: 'Ali Market', amount: 500000, status: 'PENDING', createdAt: '2026-09-04T08:00:00.000Z' };
  let approved = false; let reports = 0; let reconciliation = 0;
  await page.route('**/api/v1/admin/finance/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/payouts/8/approve')) { approved = true; await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }); return; }
    if (url.includes('/reports/reconciliation')) { reconciliation += 1; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { netAmount: 450000 } }) }); return; }
    if (url.includes('/reports')) { reports += 1; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { grossAmount: 500000 } }) }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [payout], total: 1, page: 1, limit: 20, totalPages: 1 } }) });
  });
  await page.goto('/admin/finance');
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect.poll(() => approved).toBe(true);
  await page.getByRole('tab', { name: 'Hisobot' }).click();
  await expect.poll(() => reports).toBeGreaterThan(0);
  await expect(page.getByText('500 000')).toBeVisible();
  await page.getByRole('tab', { name: 'Reconciliation' }).click();
  await expect.poll(() => reconciliation).toBeGreaterThan(0);
  await expect(page.getByText('450 000')).toBeVisible();
});
