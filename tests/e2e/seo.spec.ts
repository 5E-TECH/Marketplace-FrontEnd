import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test('login sahifasi ham admin domen bilan birga indeksdan yopiladi', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle('MarketHub Seller — sotuvchi kabinetiga kirish');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /mahsulotlar, buyurtmalar/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-markethub\.jpg$/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

test('seller kabineti qidiruv tizimlaridan yopiladi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/products');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow, noarchive',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});
