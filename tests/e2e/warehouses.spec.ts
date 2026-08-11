import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const warehouse = (id: string, name: string, isDefault: boolean) => ({
  id, ownerId: 'seller-e2e', name, regionId: '12', districtId: '140',
  address: `${name} manzili`, isDefault, isActive: true,
  createdAt: '2026-08-11T08:00:00.000Z', updatedAt: '2026-08-11T08:00:00.000Z',
});

async function mockWarehouses(page: Page) {
  let items = [warehouse('1', 'Asosiy ombor', true), warehouse('2', 'Chilonzor ombori', false)];
  await page.route('**/api/v1/inventory/warehouses', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string; regionId?: string; districtId?: string; address?: string; isDefault: boolean };
      const created = { ...warehouse('3', body.name, body.isDefault), ...body };
      if (created.isDefault) items = items.map((item) => ({ ...item, isDefault: false }));
      items.push(created);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: created }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: items }) });
  });
  await page.route('**/api/v1/inventory/warehouses/*', async (route) => {
    const id = route.request().url().split('/').at(-1);
    items = items.map((item) => ({ ...item, isDefault: item.id === id }));
    const updated = items.find((item) => item.id === id);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: updated }) });
  });
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
  await mockWarehouses(page);
  await page.goto('/warehouses');
});

test('omborlar ro‘yxati API dan chiqadi', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Asosiy ombor', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Chilonzor ombori', exact: true })).toBeVisible();
});

test('TC1: ombor yaratishdan keyin ro‘yxatda chiqadi', async ({ page }) => {
  await page.getByRole('button', { name: 'Ombor qo‘shish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi ombor' });
  await dialog.getByLabel('Ombor nomi').fill('Sergeli ombori');
  await dialog.getByLabel('Viloyat ID').fill('12');
  await dialog.getByLabel('Tuman ID').fill('141');
  await dialog.getByLabel('Manzil').fill('Sergeli tumani');
  await dialog.getByRole('button', { name: 'Qo‘shish' }).click();

  await expect(page.getByText('Ombor qo‘shildi')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sergeli ombori', exact: true })).toBeVisible();
});

test('TC2: default belgilanganda faqat bitta default ombor qoladi', async ({ page }) => {
  await page.getByRole('button', { name: 'Asosiy qilish' }).click();
  await expect(page.getByText('Chilonzor ombori asosiy ombor qilindi')).toBeVisible();
  await expect(page.getByText('Asosiy', { exact: true })).toHaveCount(1);
  const defaultRow = page.getByRole('row').filter({ hasText: 'Chilonzor ombori' });
  await expect(defaultRow.getByText('Asosiy', { exact: true })).toBeVisible();
});
