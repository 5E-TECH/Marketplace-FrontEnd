import { expect, test, type Page } from '@playwright/test';
import { installAuthenticatedSession, operatorUser, roleUsers } from './support/auth';
import { mainNav, pageTitle } from './support/shell';

/** Karkas-E (FE-01): desktop, planshet, telefon, omborchi relsi va operator ish joyi. */
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('TC1: menyu bandi route va yuqori qatordagi h1 ni yangilaydi, faol band belgilanadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/settings');
  await expect(pageTitle(page)).toHaveText('Sozlamalar');
  // Sozlamalar menyuda yo'q — hech bir band faol emas.
  await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);

  await mainNav(page).getByRole('link', { name: 'Lidlar' }).click();
  await expect(page).toHaveURL(/\/affiliate\/leads$/);
  await expect(pageTitle(page)).toHaveText('Lidlar');
  await expect(mainNav(page).getByRole('link', { name: 'Lidlar' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('placeholder-page')).toBeVisible();
});

test('TC3: 375 px da overflow yo‘q, 56 px yuqori qator va chap panel navigatsiyasi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/settings');
  await expect(pageTitle(page)).toHaveText('Sozlamalar');
  await expect(page.getByTestId('app-layout')).toHaveAttribute('data-layout', 'phone');
  expect((await page.locator('[data-app-main]').locator('xpath=preceding-sibling::header').boundingBox())?.height).toBe(56);
  await expect.poll(() => noOverflow(page)).toBe(true);

  await page.getByRole('button', { name: 'Menyu', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: 'Bosh sahifa' }).click();

  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(drawer).toBeHidden();
  await expect.poll(() => noOverflow(page)).toBe(true);
});

test('telefonda ichki sahifada menyu tugmasi o‘rnida orqaga tugmasi', async ({ page }) => {
  await installAuthenticatedSession(page, roleUsers.ADMIN);
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ json: { data: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 } } }));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/admin/users/new');

  await expect(page.getByRole('button', { name: 'Menyu', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Orqaga: Foydalanuvchilar' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('button', { name: 'Menyu', exact: true })).toBeVisible();
});

test('foydalanuvchi tugmasi rol nomini ko‘rsatadi, menyudagi Profil profil sahifasini ochadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/');
  const account = page.getByTestId('user-menu-button');
  await expect(account).toContainText('Sotuvchi');
  await account.click();
  await page.getByRole('menuitem', { name: 'Profil' }).click();

  await expect(page).toHaveURL(/\/profile$/);
  // Sotuvchi profili (FE-04, sotuvchi-profil) — sarlavha «Profil».
  await expect(pageTitle(page)).toHaveText('Profil');
});

test('til foydalanuvchi menyusidan almashtiriladi: menyu va sarlavha shu tilda', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/affiliate');
  await page.getByTestId('user-menu-button').click();
  // Ichki menyu hover bilan ochiladi; sahifa ma'lumoti shu payt kelib qayta chizilsa hover yo'qolishi mumkin.
  const russian = page.getByRole('menuitem', { name: 'Русский' });
  await expect(async () => {
    await page.getByRole('menuitem', { name: /^Til/ }).hover();
    await expect(russian).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await russian.click();

  await expect(pageTitle(page)).toHaveText('Главная');
  await expect(page.getByRole('navigation', { name: 'Главное меню' }).getByRole('link', { name: 'Офферы' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Язык: русский' })).toHaveText('RU');
});

test('omborchi 768–1279 px: 96 px relsi, qisqa yorliqlar, menyu tugmasi yo‘q', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await installAuthenticatedSession(page, roleUsers.WAREHOUSE);
  await page.goto('/warehouse/stock');

  await expect(page.getByTestId('app-layout')).toHaveAttribute('data-layout', 'rail');
  const rail = mainNav(page);
  expect((await rail.boundingBox())?.width).toBe(96);
  await expect(rail.getByRole('link')).toHaveText(['Qabul', 'SKU', 'Qoldiq', 'Yig‘ish', 'Topshirish', 'Qaytganlar', 'Optovikka']);
  await expect(rail.getByRole('link', { name: 'Postavka qabuli' })).toBeVisible();
  await expect(rail.locator('[aria-current="page"]')).toHaveAttribute('aria-label', 'Qoldiq');
  await expect(page.getByRole('button', { name: 'Menyu', exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('app-layout')).toHaveAttribute('data-layout', 'desktop');
  await expect(mainNav(page).getByRole('link', { name: 'Postavka qabuli' })).toContainText('Postavka qabuli');
});

test('operator: 1280 px dan tor ekranda planshet karkasi, telefonda «Ish joyi faqat kompyuterda»', async ({ page }) => {
  await installAuthenticatedSession(page, operatorUser);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/operator');
  await expect(page.getByTestId('app-layout')).toHaveAttribute('data-shell', 'workspace');
  await expect(page.getByTestId('app-layout')).toHaveAttribute('data-layout', 'tablet');

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByTestId('desktop-only')).toContainText('Ish joyi faqat kompyuterda');
  await page.goto('/operator/calls');
  await expect(page.getByTestId('desktop-only')).toHaveCount(0);
});
