import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';

const warehouse = (id: string, name: string, isDefault: boolean) => ({
  id, ownerId: 'seller-e2e', name, regionId: '12', districtId: '140',
  address: `${name} manzili`, isDefault, isActive: true,
  createdAt: '2026-08-11T08:00:00.000Z', updatedAt: '2026-08-11T08:00:00.000Z',
});

const apiStates = new WeakMap<Page, { createBody?: Record<string, unknown>; defaultId?: string; patchBody?: Record<string, unknown>; deletedId?: string }>();

async function mockWarehouses(page: Page) {
  let items = [warehouse('1', 'Asosiy ombor', true), warehouse('2', 'Chilonzor ombori', false)];
  const state: { createBody?: Record<string, unknown>; defaultId?: string; patchBody?: Record<string, unknown>; deletedId?: string } = {};
  apiStates.set(page, state);
  await page.route('**/api/v1/inventory/warehouses', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string; regionId?: string; districtId?: string; address?: string; isDefault: boolean };
      state.createBody = body;
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
    if (route.request().method() === 'GET') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: items.find((item) => item.id === id) }) }); return; }
    if (route.request().method() === 'DELETE') { state.deletedId = id; items = items.filter((item) => item.id !== id); await route.fulfill({ status: 200, body: '{}' }); return; }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (Object.keys(body).length === 1 && body.isDefault === true) state.defaultId = id; else state.patchBody = body;
    items = items.map((item) => item.id === id ? { ...item, ...body } : body.isDefault ? { ...item, isDefault: false } : item);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: items.find((item) => item.id === id) }) });
  });
  return state;
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
  const state = apiStates.get(page);
  await page.getByRole('button', { name: 'Ombor qo‘shish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi ombor' });
  await dialog.getByLabel('Ombor nomi').fill('Sergeli ombori');
  await dialog.getByLabel('Viloyat ID').fill('12');
  await dialog.getByLabel('Tuman ID').fill('141');
  await dialog.getByLabel('Manzil').fill('Sergeli tumani');
  await dialog.getByRole('button', { name: 'Qo‘shish' }).click();

  await expect(page.getByText('Ombor qo‘shildi')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sergeli ombori', exact: true })).toBeVisible();
  expect(state?.createBody).toEqual({
    name: 'Sergeli ombori', regionId: '12', districtId: '141',
    address: 'Sergeli tumani', isDefault: false,
  });
});

test('TC2: default belgilanganda faqat bitta default ombor qoladi', async ({ page }) => {
  const state = apiStates.get(page);
  const chilonzorRow = page.getByRole('row').filter({ hasText: 'Chilonzor ombori' });
  await chilonzorRow.getByRole('button', { name: 'Asosiy qilish' }).click();
  await expect(page.getByText('Chilonzor ombori asosiy ombor qilindi')).toBeVisible();
  await expect(page.getByText('Asosiy', { exact: true })).toHaveCount(1);
  const defaultRow = page.getByRole('row').filter({ hasText: 'Chilonzor ombori' });
  await expect(defaultRow.getByText('Asosiy', { exact: true })).toBeVisible();
  expect(state?.defaultId).toBe('2');
});

test('GET detail, PATCH edit va DELETE ishlaydi', async ({ page }) => {
  const state = apiStates.get(page);
  await page.getByRole('button', { name: 'Chilonzor ombori omborini tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Omborni tahrirlash' });
  await expect(dialog.getByLabel('Ombor nomi')).toHaveValue('Chilonzor ombori');
  await dialog.getByLabel('Ombor nomi').fill('Yangilangan ombor');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => state?.patchBody).toMatchObject({ name: 'Yangilangan ombor' });
  await page.getByRole('button', { name: 'Yangilangan ombor omborini o‘chirish' }).click();
  await page.getByRole('dialog', { name: 'Ombor o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();
  await expect.poll(() => state?.deletedId).toBe('2');
});
