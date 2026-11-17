import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, authenticatedUser, roleUsers } from './support/auth';

for (const scenario of ['retry-server-error', 'refresh-server-error'] as const) {
  test(`${scenario}: vaqtinchalik server xatosi sessiyani yopmaydi`, async ({ page }) => {
    await installAuthenticatedSession(page, roleUsers.ADMIN);
    let calls = 0;
    await page.route('**/api/v1/auth/refresh', route => route.fulfill({
      status: scenario === 'refresh-server-error' ? 503 : 200,
      json: scenario === 'refresh-server-error' ? { message: 'Server vaqtincha ishlamayapti' } : { accessToken: 'new.token' },
    }));
    await page.route('**/api/v1/admin/audit**', route => {
      calls += 1;
      return route.fulfill({ status: calls === 1 ? 401 : 500, json: { message: 'Server xatosi' } });
    });
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('button', { name: /Qayta/ })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/audit-logs$/);
    expect(await page.evaluate(() => sessionStorage.getItem('elchi_access_token'))).toBeTruthy();
  });
}

test('ulanmagan admin bo‘limi placeholder o‘rniga 404 ko‘rsatadi', async ({ page }) => {
  await installAuthenticatedSession(page, { ...authenticatedUser, role: 'ADMIN' });
  await page.goto('/admin/brands');
  await expect(page.getByText('Sahifa topilmadi')).toBeVisible();
  await expect(page.getByText('Bu bo‘lim hali mavjud emas')).toHaveCount(0);
  await expect(page.getByText('Asosiy yozuv', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tahrirlash' })).toHaveCount(0);
});
