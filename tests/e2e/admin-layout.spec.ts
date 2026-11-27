import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';
import { mainNav, pageTitle } from './support/shell';

const adminUser = {
  id: 'admin-e2e',
  role: 'ADMIN',
  name: 'E2E Admin',
  phone: '+998901234567',
  isActive: true,
  isDeleted: false,
} as const;

async function mockAdminPages(page: Page) {
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({ status: 200, json: { data: [] } }));
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ status: 200, json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 } } }));
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('TC2: ADMIN desktop karkasi — navy menyu, yuqori qatorda h1, til, qo‘ng‘iroqcha va foydalanuvchi', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await page.goto('/');

  await expect(page).toHaveURL(/\/admin\/moderation$/);
  const layout = page.getByTestId('admin-layout');
  await expect(layout).toHaveAttribute('data-layout', 'desktop');
  await expect(mainNav(page)).toBeVisible();
  await expect(pageTitle(page)).toHaveText('Moderatsiya');
  // Sahifa nomi faqat yuqori qatorda — `main` ichida ikkinchi h1 yo'q.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Til: o‘zbekcha' })).toHaveText('UZ');
  await expect(page.getByRole('button', { name: 'Bildirishnomalar' })).toBeVisible();
  const userButton = page.getByTestId('user-menu-button');
  await expect(userButton).toHaveAttribute('title', 'Profil va Chiqish');
  // Yuqori qatorda qisqa ism (karkas-E 1.6): «E2E A.».
  await expect(userButton).toContainText('E2E A.');
  await expect(userButton).toContainText('Admin');

  // karkas-E: breadcrumb, «ADMIN REJIM» belgisi va global qidiruv M1 da yo'q.
  await expect(page.getByText('ADMIN REJIM', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveCount(0);

  // Menyu bandi: 44 px, ikonka 20 px.
  const item = mainNav(page).getByRole('link', { name: 'Moderatsiya' });
  await expect(item).toHaveAttribute('aria-current', 'page');
  expect((await item.boundingBox())?.height).toBe(44);
  const icon = await item.locator('svg').boundingBox();
  expect(icon?.width).toBe(20);
  expect(icon?.height).toBe(20);
});

test('TC1: sotuvchi admin URL ga kira olmaydi — o‘z karkasida 403 ko‘radi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/admin/moderation');

  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await expect(page.getByTestId('admin-layout')).toHaveCount(0);
  await expect(page.getByTestId('app-layout')).toBeVisible();
  await expect(page.getByTestId('forbidden-page')).toBeVisible();
  // Menyu o'z rolida qoladi, hech bir band tanlanmaydi (umumiy-403).
  await expect(mainNav(page).getByRole('link', { name: 'Moderatsiya' })).toHaveCount(0);
  await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);
});

test('foydalanuvchi menyusi: sarlavha, Profil, Til va Chiqish', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await page.goto('/admin/moderation');

  const userButton = page.getByTestId('user-menu-button');
  await userButton.click();
  await expect(userButton).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Profil', /^TilO‘zbekcha/, 'Chiqish']);

  await menu.getByRole('menuitem', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await expect(pageTitle(page)).toHaveText('Mening profilim');
});

test('ichki sahifa: «‹ Bo‘lim» havolasi h1 dan oldin, menyuda bo‘lim faol', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await mockAdminPages(page);
  await page.goto('/admin/products/new');

  await expect(pageTitle(page)).toHaveText('Yangi mahsulot');
  await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText('Mahsulotlar');
  await page.getByRole('link', { name: 'Orqaga: Mahsulotlar' }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
});

test('planshet (900 px): menyu chap panelda, yuqori qatorda menyu tugmasi va avatar', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await installAuthenticatedSession(page, adminUser);
  await page.goto('/admin/moderation');

  await expect(page.getByTestId('admin-layout')).toHaveAttribute('data-layout', 'tablet');
  await expect(mainNav(page)).toHaveCount(0);
  await expect(page.getByTestId('user-menu-button')).toHaveAttribute('aria-label', 'E2E A., Admin: Profil va Chiqish');
  await page.getByRole('button', { name: 'Menyu', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('navigation', { name: 'Asosiy menyu' })).toBeVisible();
});

test('admin telefon menyusi overflow bermaydi va navigatsiya qiladi', async ({ page }) => {
  await installAuthenticatedSession(page, adminUser);
  await mockAdminPages(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/moderation');

  await expect(page.getByTestId('admin-layout')).toHaveAttribute('data-layout', 'phone');
  await expect.poll(() => noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: 'Menyu', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Til', { exact: true })).toBeVisible();
  await drawer.getByRole('link', { name: 'Kategoriyalar' }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(drawer).toBeHidden();
  await expect.poll(() => noOverflow(page)).toBe(true);
});
