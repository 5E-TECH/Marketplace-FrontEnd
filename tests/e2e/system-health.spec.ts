import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

test('health va readiness holatlari ko‘rsatiladi, webhook brauzerdan chaqirilmaydi', async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'admin-e2e', role: 'SUPERADMIN', name: 'Super Admin', phone: '+998901234567', isActive: true, isDeleted: false } }) }));
  let healthCalls = 0; let readinessCalls = 0; let webhookCalls = 0;
  await page.route('**/api/v1/health/readiness', route => { readinessCalls += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', database: 'up' }) }); });
  await page.route('**/api/v1/health', route => { healthCalls += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }); });
  await page.route('**/api/v1/webhooks/elchi', route => { webhookCalls += 1; return route.fulfill({ status: 201, body: '{}' }); });
  await page.goto('/admin/system-settings');
  await expect(page.getByText('API Gateway', { exact: true })).toBeVisible();
  await expect(page.getByText('Tayyor servislar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mikroservislar' })).toBeVisible();
  await expect(page.getByText('ready')).toBeVisible();
  await expect.poll(() => healthCalls).toBeGreaterThan(0);
  await expect.poll(() => readinessCalls).toBeGreaterThan(0);
  expect(webhookCalls).toBe(0);
});
