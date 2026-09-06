import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test('login sahifasi indekslanadigan to‘liq metadata beradi', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle('MarketHub Seller — sotuvchi kabinetiga kirish');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /mahsulotlar, buyurtmalar/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/login$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-markethub\.jpg$/);
  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(structuredData ?? '{}')).toMatchObject({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MarketHub Seller',
  });
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
