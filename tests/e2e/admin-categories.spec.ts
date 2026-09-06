import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

test('admin categories tree create, PATCH va DELETE endpointlari ishlaydi', async ({ page }) => {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '1', role: 'ADMIN', name: 'Admin', phone: '+998900000000', email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false } }) }));
  let items = [{ id: '1', name: 'Elektronika', slug: 'elektronika', parentId: null, iconUrl: null, sortOrder: 1, isActive: true, children: [] }];
  let createBody: Record<string, unknown> | null = null; let patchBody: Record<string, unknown> | null = null; let deleted = '';
  await page.route('**/api/v1/admin/categories', async (route) => {
    if (route.request().method() === 'POST') { createBody = route.request().postDataJSON() as Record<string, unknown>; const created = { id: '2', slug: 'telefonlar', children: [], ...createBody }; items = [...items, created as typeof items[number]]; await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: created }) }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: items }) });
  });
  await page.route('**/api/v1/admin/categories/*', async (route) => { const id = route.request().url().split('/').at(-1) ?? ''; if (route.request().method() === 'PATCH') { patchBody = route.request().postDataJSON() as Record<string, unknown>; const updated = { ...items.find((item) => item.id === id), ...patchBody }; items = items.map((item) => item.id === id ? updated as typeof item : item); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: updated }) }); return; } deleted = id; items = items.filter((item) => item.id !== id); await route.fulfill({ status: 200, body: '{}' }); });
  await page.goto('/admin/categories');
  await expect(page.getByText('Elektronika', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kategoriya qo‘shish' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Yangi kategoriya' });
  await createDialog.getByLabel('Nomi').fill('Telefonlar'); await createDialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => createBody).toMatchObject({ name: 'Telefonlar', parentId: null, sortOrder: 0, isActive: true });
  await page.getByRole('button', { name: 'Telefonlar kategoriyasini tahrirlash' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Kategoriyani tahrirlash' }); await editDialog.getByLabel('Nomi').fill('Smartfonlar'); await editDialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => patchBody).toMatchObject({ name: 'Smartfonlar' });
  await page.getByRole('button', { name: 'Smartfonlar kategoriyasini o‘chirish' }).click(); await page.getByRole('dialog', { name: 'Kategoriya o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();
  await expect.poll(() => deleted).toBe('2');
});
