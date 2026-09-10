import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }) }));
});

test('admin user list, detail va block oqimlari backend kontraktiga mos ishlaydi', async ({ page }) => {
  let user = { id: '17', name: 'Ali Valiyev', phone: '+998901112233', email: 'ali@example.com', avatarUrl: null, role: 'BUYER', isActive: true, isBlocked: false, isDeleted: false, shopId: null, createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-05T09:30:00.000Z' };
  let blocked = false;
  let unsupportedRequestSent = false;
  await page.route('**/api/v1/admin/users**', async route => {
    const request = route.request();
    if (request.url().endsWith('/17/block')) {
      blocked = true;
      user = { ...user, isBlocked: true };
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      return;
    }
    if (request.method() === 'PATCH' || request.method() === 'DELETE') {
      unsupportedRequestSent = true;
      await route.fulfill({ status: 405, contentType: 'application/json', body: '{}' });
      return;
    }
    if (request.url().endsWith('/17')) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: user }) }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [user], total: 1, page: 1, limit: 20, totalPages: 1 } }) });
  });
  await page.goto('/admin/users');

  await expect(page.getByRole('button', { name: 'Bloklash' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'O‘chirish — backend endpoint mavjud emas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tafsilotlar' })).toBeVisible();
  await page.getByRole('button', { name: 'Bloklash' }).click();
  await page.getByRole('button', { name: 'Bloklash', exact: true }).last().click();
  await expect.poll(() => blocked).toBe(true);

  await page.getByRole('button', { name: 'Tafsilotlar' }).click();
  await expect(page).toHaveURL(/\/admin\/users\/17$/);
  await expect(page.getByRole('heading', { name: 'Foydalanuvchi tafsilotlari' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ali Valiyev' })).toBeVisible();
  await expect(page.getByText('ali@example.com').first()).toBeVisible();
  await expect(page.getByText('Biriktirilmagan')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  await expect(page.getByText('Backend kontraktida foydalanuvchini tahrirlash va o‘chirish endpointlari mavjud emas')).toBeVisible();
  expect(unsupportedRequestSent).toBe(false);
});

test('admin alohida sahifada yangi foydalanuvchi yaratadi', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route('**/api/v1/admin/users**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }),
  }));
  await page.route('**/api/v1/auth/register', async route => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accessToken: 'created-user-token' } }),
    });
  });

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Foydalanuvchi qo‘shish' }).click();
  await expect(page).toHaveURL(/\/admin\/users\/new$/);
  await expect(page.getByRole('heading', { name: 'Yangi foydalanuvchi' })).toBeVisible();

  await page.getByLabel('To‘liq ism').fill('Yangi Operator');
  await page.getByLabel('Telefon raqami').fill('+998901234568');
  await page.getByLabel('Email').fill('operator@example.com');
  await page.getByLabel('Foydalanuvchi roli').click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'Operator' }).click();
  await page.getByLabel('Parol', { exact: true }).fill('Secret123');
  await page.getByLabel('Parolni tasdiqlash').fill('Secret123');
  await page.getByRole('button', { name: 'Foydalanuvchi yaratish' }).click();

  await expect(page).toHaveURL(/\/admin\/users$/);
  expect(requestBody).toEqual({
    name: 'Yangi Operator',
    phone: '+998901234568',
    email: 'operator@example.com',
    role: 'OPERATOR',
    password: 'Secret123',
  });
});

test('admin user search va pagination querylari backendga yuboriladi', async ({ page }) => {
  let requestedUrl = '';
  const users = Array.from({ length: 21 }, (_, index) => ({ id: String(index + 1), name: index === 20 ? 'Noyob Admin User' : `User ${index + 1}`, phone: `+9989012345${String(index).padStart(2, '0')}`, email: null, avatarUrl: null, role: 'BUYER', isActive: true, isBlocked: false, isDeleted: false, shopId: null, createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T08:00:00.000Z' }));
  await page.route('**/api/v1/admin/users**', async route => {
    const url = new URL(route.request().url());
    requestedUrl = url.toString();
    const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('uz');
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const filtered = users.filter(user => !search || `${user.name} ${user.phone}`.toLocaleLowerCase('uz').includes(search));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: filtered.slice((pageNumber - 1) * limit, pageNumber * limit), total: filtered.length, page: pageNumber, limit, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) } }) });
  });
  await page.goto('/admin/users');
  await page.getByPlaceholder('Ism yoki telefon...').fill('Noyob Admin');
  await expect.poll(() => requestedUrl).toContain('search=Noyob+Admin');
  await expect(page.getByText('Noyob Admin User')).toBeVisible();

  await page.getByPlaceholder('Ism yoki telefon...').clear();
  const secondPageRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('page') === '2');
  await page.getByTitle('2').click();
  await secondPageRequest;
  await expect(page.getByText('Noyob Admin User')).toBeVisible();
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
  await page.getByRole('tab', { name: 'Solishtirish' }).click();
  await expect.poll(() => reconciliation).toBeGreaterThan(0);
  await expect(page.getByText('450 000')).toBeVisible();
});
