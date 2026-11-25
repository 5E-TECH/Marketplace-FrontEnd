import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';
import { mainNav, pageTitle } from './support/shell';

const superadmin = {
  id: 'navigation-superadmin', role: 'SUPERADMIN', name: 'Navigation Admin',
  phone: '+998901234567', isActive: true, isDeleted: false,
} as const;

/** karkas-E 2.4–2.5: M1 admin menyusi, guruhlar bilan. */
const ADMIN_GROUPS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ['Ish', [['Moderatsiya', '/admin/moderation'], ['Lidlar', '/admin/leads'], ['Buyurtmalar', '/admin/orders']]],
  ['Katalog', [['Mahsulotlar', '/admin/products'], ['Kategoriyalar', '/admin/categories'], ['Qoldiq', '/admin/inventory']]],
  ['Hamkorlar', [['Sotuvchilar', '/admin/sellers'], ['Optoviklar', '/admin/wholesalers']]],
  ['Nazorat', [['Qo‘ng‘iroq yozuvlari', '/admin/recordings'], ['Audit jurnali', '/admin/audit-logs']]],
  ['Tizim', [['Foydalanuvchilar', '/admin/users'], ['Integratsiyalar', '/admin/integrations'], ['Sozlamalar', '/admin/settings']]],
];
const ADMIN_ITEMS = ADMIN_GROUPS.flatMap(([, items]) => items);

/** Sahifa o'z aniqroq nomini bersa, `h1` — o'sha nom (masalan Qoldiq → «Platforma qoldig‘i»). */
const PAGE_TITLES: Record<string, string> = { Qoldiq: 'Platforma qoldig‘i' };

/** M2 va «?» bandlari M1 build'da chiqmaydi (karkas-E 1.9). */
const HIDDEN_ITEMS = ['Boshqaruv paneli', 'Hisobotlar', 'Sayt kontenti', 'Firibgarlik markazi', 'Murojaatlar', 'Moliya', 'Dashboard'];

async function mockAdminEndpoints(page: Page) {
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({ status: 200, json: { data: [] } }));
  await page.route('**/api/v1/admin/audit**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
  await page.route('**/api/v1/admin/inventory/**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0, warnings: [], searchTruncated: false } } }));
}

test('SUPERADMIN menyusi: guruhlar va M1 bandlari, har biri ochiladi va faol bo‘ladi', async ({ page }) => {
  test.setTimeout(60_000);
  await installAuthenticatedSession(page, superadmin);
  await mockAdminEndpoints(page);
  await page.goto('/admin/moderation');

  const nav = mainNav(page);
  await expect(nav.locator('p')).toHaveText(ADMIN_GROUPS.map(([group]) => group));
  await expect(nav.getByRole('link')).toHaveText(ADMIN_ITEMS.map(([label]) => label));
  for (const label of HIDDEN_ITEMS) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }

  for (const [label, path] of ADMIN_ITEMS) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(pageTitle(page)).toHaveText(PAGE_TITLES[label] ?? label);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(label);
    await expect(page.getByTestId('not-found-page')).toHaveCount(0);
    await expect(page.getByTestId('forbidden-page')).toHaveCount(0);
  }
});

test('sahifasi qurilmagan bandlar «Bo‘lim tayyorlanmoqda» holatini ko‘rsatadi', async ({ page }) => {
  await installAuthenticatedSession(page, superadmin);
  await page.goto('/admin/sellers');
  await expect(page.getByTestId('placeholder-page')).toContainText('Bo‘lim tayyorlanmoqda');
});

test('yashirin va eski admin URL’lari 404 ga tushadi', async ({ page }) => {
  test.setTimeout(60_000);
  await installAuthenticatedSession(page, superadmin);
  for (const path of ['/admin/payout-history', '/admin/brands', '/admin/attributes', '/admin/transactions', '/admin/warehouses', '/admin/stock', '/admin/promocodes', '/admin/reviews', '/admin/team']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByTestId('not-found-page')).toBeVisible();
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);
  }
});
