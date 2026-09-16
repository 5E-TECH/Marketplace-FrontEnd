import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const admin = {
  id: 'audit-admin', role: 'ADMIN', name: 'Audit Admin', phone: '+998901234567',
  isActive: true, isDeleted: false,
} as const;

const superadmin = {
  ...admin, id: 'audit-superadmin', role: 'SUPERADMIN', name: 'Audit Superadmin',
} as const;

const auditLogs = Array.from({ length: 21 }, (_, index) => ({
  id: String(index + 1),
  actorId: index === 20 ? '77' : '15',
  actor: {
    id: index === 20 ? '77' : '15',
    name: index === 20 ? 'Nodir Admin' : 'Ali Admin',
  },
  action: index === 20 ? 'product.price.update' : 'shop.suspend',
  entityType: index === 20 ? 'product' : 'shop',
  entityId: String(100 + index),
  createdAt: `2026-09-${String((index % 14) + 1).padStart(2, '0')}T08:30:00.000Z`,
}));

async function mockAudit(page: Page) {
  const requestedUrls: string[] = [];
  await page.route('**/api/v1/admin/audit**', async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url.toString());
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const actorId = url.searchParams.get('actorId');
    const action = url.searchParams.get('action');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const filtered = auditLogs.filter((log) => {
      const date = log.createdAt.slice(0, 10);
      return (!actorId || log.actorId === actorId)
        && (!action || log.action === action)
        && (!dateFrom || date >= dateFrom)
        && (!dateTo || date <= dateTo);
    });
    const start = (pageNumber - 1) * limit;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items: filtered.slice(start, start + limit),
          total: filtered.length,
          page: pageNumber,
          limit,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
      }),
    });
  });
  return requestedUrls;
}

test('TC1: audit jurnali chiqadi va sahifalanadi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  const requestedUrls = await mockAudit(page);
  await page.goto('/admin/audit-logs');

  await expect(page.getByRole('heading', { name: 'Audit jurnali' })).toBeVisible();
  await expect(page.getByText('Ali Admin').first()).toBeVisible();
  await expect(page.getByText('shop.suspend').first()).toBeVisible();
  await expect(page.getByText('shop').first()).toBeVisible();
  await page.getByTitle('2').click();
  await expect.poll(() => requestedUrls.at(-1)).toContain('page=2');
  await expect(page.getByText('Nodir Admin')).toBeVisible();
});

test('TC2: foydalanuvchi va amal turi backend querylari bilan filtrlanadi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  const requestedUrls = await mockAudit(page);
  await page.goto('/admin/audit-logs');

  await page.getByLabel('Foydalanuvchi ID').fill('77');
  await expect.poll(() => requestedUrls.at(-1)).toContain('actorId=77');
  await expect(page.getByText('Nodir Admin')).toBeVisible();
  await expect(page.getByText('Ali Admin')).toHaveCount(0);

  await page.getByLabel('Amal turi').fill('product.price.update');
  await expect.poll(() => requestedUrls.at(-1)).toContain('action=product.price.update');
  await expect(page.getByText('product.price.update')).toBeVisible();
});

test('TC3: sana oralig‘i dateFrom va dateTo bilan filtrlanadi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  const requestedUrls = await mockAudit(page);
  await page.goto('/admin/audit-logs');

  await page.getByLabel('Boshlanish sanasi').fill('2026-09-10');
  await page.getByLabel('Boshlanish sanasi').press('Enter');
  await page.getByLabel('Tugash sanasi').fill('2026-09-12');
  await page.getByLabel('Tugash sanasi').press('Enter');
  await expect.poll(() => requestedUrls.at(-1)).toContain('dateFrom=2026-09-10');
  await expect.poll(() => requestedUrls.at(-1)).toContain('dateTo=2026-09-12');
  await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(3);
});

test('TC4: faqat ADMIN va SUPERADMIN audit jurnalini ochadi', async ({ page }) => {
  await installAuthenticatedSession(page, superadmin);
  await mockAudit(page);
  await page.goto('/admin/audit-logs');
  await expect(page.getByRole('heading', { name: 'Audit jurnali' })).toBeVisible();

  await installAuthenticatedSession(page);
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('admin-layout')).toHaveCount(0);
});

test('bo‘sh va xato holatlari ko‘rsatiladi', async ({ page }) => {
  await installAuthenticatedSession(page, admin);
  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } }),
  }));
  await page.goto('/admin/audit-logs');
  await expect(page.getByText('Audit yozuvlari topilmadi')).toBeVisible();

  await page.unroute('**/api/v1/admin/audit**');
  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Audit service unavailable' }),
  }));
  await page.reload();
  await expect(page.getByText('Audit jurnalini yuklab bo‘lmadi')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Qayta urinish' })).toBeVisible();
});
