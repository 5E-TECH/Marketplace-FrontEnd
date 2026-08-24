import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test('TC1: sidebar navigation route va breadcrumbni yangilaydi', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();

  await page
    .getByRole('complementary')
    .getByRole('menuitem', { name: 'Mahsulotlar' })
    .click();

  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('heading', { name: 'Mahsulotlar' })).toBeVisible();
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
  await expect(breadcrumb).toContainText('Bosh sahifa');
  await expect(breadcrumb).toContainText('Mahsulotlar');
});

test('TC3: 375px viewportda overflow yo‘q va mobile navigation ishlaydi', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boshqaruv paneli' }),
  ).toBeVisible();

  await expect(page.locator('.ant-layout-sider')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Menyuni ochish' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await drawer.getByText('Mahsulotlar', { exact: true }).click();

  await expect(page).toHaveURL(/\/products$/);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test('akkaunt tugmasi profil sahifasini ochadi', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Akkaunt profiliga o‘tish' }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Mening profilim' })).toBeVisible();
});
