import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test('settings profil tahrirlash sahifasiga yo‘naltiradi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Profilni tahrirlash' }).click();
  await expect(page).toHaveURL(/\/profile$/);
});
