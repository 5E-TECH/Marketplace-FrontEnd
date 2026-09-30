import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test('settings profil tahrirlash sahifasiga yo‘naltiradi', async ({ page }) => {
  await installAuthenticatedSession(page);
  // Sahifa faol sessiyalarni so'raydi — mock bo'lmasa so'rov haqiqiy API'ga ketardi.
  await page.route('**/api/v1/auth/sessions', (route) => route.fulfill({ json: { data: [{ id: 's1', userAgent: 'Chrome · Linux', ipAddress: '127.0.0.1', createdAt: '2026-09-28T10:00:00.000Z', lastUsedAt: '2026-09-28T10:00:00.000Z', current: true }] } }));
  await page.goto('/settings');
  await expect(page.getByText('Joriy qurilma')).toBeVisible();
  await page.getByRole('button', { name: 'Profilni tahrirlash' }).click();
  await expect(page).toHaveURL(/\/profile$/);
});
