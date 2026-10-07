import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

test.beforeEach(async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }) }));
});

test('TC3: block tugmasi confirm modal ochadi va faqat tasdiqdan keyin request yuboradi', async ({ page }) => {
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
    if (request.url().endsWith('/17/unblock')) {
      blocked = false;
      user = { ...user, isBlocked: false };
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

  await expect(page.getByText('Ali Valiyev')).toBeVisible();
  await expect(page.getByText('+998901112233')).toBeVisible();
  await expect(page.getByText('Xaridor')).toBeVisible();
  await expect(page.getByText('Faol', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bloklash' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tafsilotlar' })).toBeVisible();
  await page.getByRole('button', { name: 'Bloklash' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Ali Valiyev');
  expect(blocked).toBe(false);
  await dialog.getByRole('button', { name: 'Bloklash', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => blocked).toBe(true);
  await expect(page.getByRole('table').getByText('Bloklangan', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blokdan chiqarish' })).toBeVisible();

  await page.getByRole('button', { name: 'Blokdan chiqarish' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Blokdan chiqarish', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => blocked).toBe(false);
  await expect(page.getByText('Faol', { exact: true })).toBeVisible();

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

  await page.getByLabel('To‘liq ism').fill('Yangi Sotuvchi');
  await page.getByLabel('Telefon raqami').fill('+998901234568');
  await page.getByLabel('Email').fill('seller@example.com');
  await page.getByLabel('Foydalanuvchi roli').click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'Sotuvchi' }).click();
  await page.getByLabel('Parol', { exact: true }).fill('Secret123');
  await page.getByLabel('Parolni tasdiqlash').fill('Secret123');
  await page.getByRole('button', { name: 'Foydalanuvchi yaratish' }).click();

  await expect(page).toHaveURL(/\/admin\/users$/);
  expect(requestBody).toEqual({
    name: 'Yangi Sotuvchi',
    phone: '+998901234568',
    email: 'seller@example.com',
    role: 'SELLER',
    password: 'Secret123',
  });
});

test('TC1: users jadvali, qidiruv va pagination backend bilan ishlaydi', async ({ page }) => {
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
  const lastPageRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('page') === '3');
  await page.getByTitle('3').click();
  await lastPageRequest;
  await expect(page.getByText('Noyob Admin User')).toBeVisible();
});

test('TC2: rol va holat filtrlari backend querylariga ulanadi', async ({ page }) => {
  let requestedUrl = '';
  const blockedBuyer = { id: '31', name: 'Bloklangan Xaridor', phone: '+998901110031', email: null, avatarUrl: null, role: 'BUYER', isActive: true, isBlocked: true, isDeleted: false, shopId: null, createdAt: '2026-09-06T08:00:00.000Z', updatedAt: '2026-09-06T08:00:00.000Z' };
  await page.route('**/api/v1/admin/users**', async route => {
    requestedUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [blockedBuyer], total: 1, page: 1, limit: 20, totalPages: 1 } }) });
  });

  await page.goto('/admin/users');
  await page.getByLabel('Foydalanuvchi roli').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Xaridor' }).click();
  await expect.poll(() => new URL(requestedUrl).searchParams.get('role')).toBe('BUYER');

  await page.getByLabel('Blok holati').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Bloklangan' }).click();
  await expect.poll(() => new URL(requestedUrl).searchParams.get('blocked')).toBe('true');
  await expect(page.getByText('Bloklangan Xaridor')).toBeVisible();
  await expect(page.getByRole('table').getByText('Bloklangan', { exact: true })).toBeVisible();
});

test('TC4: bloklangan user holati jadvalda ko‘rinadi', async ({ page }) => {
  const blockedUser = { id: '44', name: 'Aziza Karimova', phone: '+998901110044', email: null, avatarUrl: null, role: 'SELLER', isActive: true, isBlocked: true, isDeleted: false, shopId: '7', createdAt: '2026-09-07T08:00:00.000Z', updatedAt: '2026-09-07T08:00:00.000Z' };
  await page.route('**/api/v1/admin/users**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [blockedUser], total: 1, page: 1, limit: 20, totalPages: 1 } }),
  }));

  await page.goto('/admin/users');
  const row = page.getByRole('row', { name: /Aziza Karimova/ });
  await expect(row).toContainText('Sotuvchi');
  await expect(row.getByText('Bloklangan', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Blokdan chiqarish' })).toBeVisible();
});

test('admin moliya: payout amali, do‘kon nomi, ledger va COD solishtirish backend DTO bilan', async ({ page }) => {
  // Kontrakt: FinancePayoutDto / FinanceLedgerEntryDto / FinanceReconciliationReportDto — do'kon nomi DTO'da yo'q.
  const payout = { id: '8', shopId: '7', amount: 500000, status: 'PENDING', method: null, referenceId: '1203', paidAt: null, createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T08:00:00.000Z' };
  const entries = [
    { id: '501', shopId: '7', entryType: 'SALE', amount: 250000, balanceAfter: 1180000, referenceType: 'seller_order', referenceId: '1203', createdAt: '2026-09-28T10:15:00.000Z' },
    { id: '502', shopId: '7', entryType: 'COMMISSION', amount: -25000, balanceAfter: 1155000, referenceType: 'seller_order', referenceId: '1203', createdAt: '2026-09-28T10:16:00.000Z' },
  ];
  const report = { settlementsCount: 14, expectedCodAmount: 3400000, collectedCodAmount: 3350000, difference: -50000, expectedCommission: 340000, nettedCommission: 200000, outstandingCommission: 140000 };
  let approved = false; const ledgerQueries: Array<Record<string, string>> = []; const reconciliationQueries: Array<Record<string, string>> = [];
  await page.route('**/api/v1/admin/shops/7', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '7', name: 'Ali Market', slug: 'ali', status: 'ACTIVE', ownerUserId: '1', phone: '+998901234567', createdAt: '2026-09-01T00:00:00.000Z' } }) }));
  await page.route('**/api/v1/admin/finance/**', async route => {
    const url = new URL(route.request().url());
    const page_ = (items: unknown[]) => JSON.stringify({ data: { items, total: items.length, page: 1, limit: 10, totalPages: 1 } });
    if (url.pathname.endsWith('/payouts/8/approve')) { approved = true; await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { ...payout, status: 'APPROVED' } }) }); return; }
    if (url.pathname.endsWith('/ledger')) { ledgerQueries.push(Object.fromEntries(url.searchParams)); await route.fulfill({ status: 200, contentType: 'application/json', body: page_(entries) }); return; }
    if (url.pathname.endsWith('/reports/reconciliation')) { reconciliationQueries.push(Object.fromEntries(url.searchParams)); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: report }) }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: page_([payout]) });
  });
  await page.goto('/admin/finance');
  const payoutRow = page.getByRole('row').filter({ hasText: '#8' });
  await expect(payoutRow).toContainText('Ali Market');
  await expect(payoutRow).toContainText('500 000 UZS');
  await payoutRow.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect.poll(() => approved).toBe(true);

  await page.getByRole('tab', { name: 'Hisob yozuvlari' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Sotuv' })).toContainText('+250 000 UZS');
  await expect(page.getByRole('row').filter({ hasText: 'Komissiya' })).toContainText('-25 000 UZS');
  await expect(page.getByRole('row').filter({ hasText: 'Sotuv' })).toContainText('Ali Market');
  await page.getByLabel('Do‘kon ID').fill('7');
  await expect.poll(() => ledgerQueries.at(-1)).toEqual({ page: '1', limit: '10', shopId: '7' });

  await page.getByRole('tab', { name: 'Solishtirish' }).click();
  const reconciliation = page.getByRole('region', { name: 'Solishtirish' });
  await expect(reconciliation).toContainText('Hisob-kitob qilingan posilkalar14');
  await expect(reconciliation).toContainText('-50 000 UZS');
  await expect(reconciliation).toContainText('140 000 UZS');
  expect(reconciliationQueries.at(-1)).toEqual({ shopId: '7' });
});

test('SUPERADMIN administratorni /admin/team orqali qo‘shadi, operator varianti yo‘q', async ({ page }) => {
  let teamBody: Record<string, unknown> | undefined;
  let registerCalled = false;
  await page.route('**/api/v1/admin/users**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } }) }));
  await page.route('**/api/v1/auth/register', route => { registerCalled = true; return route.fulfill({ status: 400, body: '{}' }); });
  await page.route('**/api/v1/admin/team', async route => {
    expect(route.request().method()).toBe('POST');
    teamBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: '90' } }) });
  });
  await page.goto('/admin/users/new');
  await page.getByLabel('To‘liq ism').fill('Yangi Admin');
  await page.getByLabel('Telefon raqami').fill('+998901234569');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Foydalanuvchi roli').click();
  const options = page.locator('.ant-select-dropdown:visible .ant-select-item-option');
  await expect(options.filter({ hasText: /^Operator$/ })).toHaveCount(0);
  await options.filter({ hasText: /^Administrator$/ }).click();
  await page.getByLabel('Parol', { exact: true }).fill('Secret123');
  await page.getByLabel('Parolni tasdiqlash').fill('Secret123');
  await page.getByRole('button', { name: 'Foydalanuvchi yaratish' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  // CreateAdminTeamMemberDto'da email yo'q.
  expect(teamBody).toEqual({ name: 'Yangi Admin', phone: '+998901234569', role: 'ADMIN', password: 'Secret123' });
  expect(registerCalled).toBe(false);
});

test('oddiy ADMIN yangi foydalanuvchiga faqat xaridor yoki sotuvchi rolini bera oladi', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'admin-2', role: 'ADMIN', name: 'Admin', phone: '+998901234560', isActive: true, isDeleted: false } }) }));
  await page.goto('/admin/users/new');
  await page.getByLabel('Foydalanuvchi roli').click();
  await expect(page.locator('.ant-select-dropdown:visible .ant-select-item-option')).toHaveText(['Xaridor', 'Sotuvchi']);
});
