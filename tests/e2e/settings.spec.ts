import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

test('yangi parol minimum 4 ta belgini qabul qiladi', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/settings');
  await page.getByLabel('Joriy parol').fill('old-password');
  await page.getByLabel('Yangi parol').fill('1234');
  await page.getByRole('button', { name: 'Parolni yangilash' }).click();

  await expect(page.getByText('Kamida 4 ta belgi kiriting')).toHaveCount(0);
  await expect(page.getByText('Parolni yangilash API’i hali taqdim etilmagan')).toBeVisible();
});
