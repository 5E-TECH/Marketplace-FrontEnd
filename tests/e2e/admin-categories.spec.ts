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
  await page.getByRole('button', { name: 'Kategoriya qo‘shish', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Yangi kategoriya' });
  await createDialog.getByLabel('Nomi').fill('Telefonlar'); await createDialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => createBody).toMatchObject({ name: 'Telefonlar', parentId: null, sortOrder: 0, isActive: true });
  await page.getByRole('button', { name: 'Telefonlar kategoriyasini tahrirlash' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Kategoriyani tahrirlash' }); await editDialog.getByLabel('Nomi').fill('Smartfonlar'); await editDialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => patchBody).toMatchObject({ name: 'Smartfonlar' });
  await page.getByRole('button', { name: 'Smartfonlar kategoriyasini o‘chirish' }).click(); await page.getByRole('dialog', { name: 'Kategoriya o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();
  await expect.poll(() => deleted).toBe('2');
});

// Category DTO / conflict messages verified against 5E-TECH/marketplace category.service.ts.
async function setupTree(page: import('@playwright/test').Page) {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: '1', role: 'ADMIN', name: 'Admin', phone: '+998900000000', isActive: true, isDeleted: false } } }));
  page.on('pageerror', error => { throw error; });
  type Node = import('../../src/features/categories/model/categoryTypes').Category;
  let nodes: Node[] = [
    { id: '1', name: 'Elektronika', slug: 'elektronika', parentId: null, iconUrl: null, sortOrder: 1, isActive: true, children: [] },
    { id: '2', name: 'Telefonlar', slug: 'telefonlar', parentId: '1', iconUrl: 'https://cdn.example.com/phone.svg', sortOrder: 2, isActive: true, children: [] },
    { id: '3', name: 'Smartfonlar', slug: 'smartfonlar', parentId: '2', iconUrl: null, sortOrder: 3, isActive: false, children: [] },
    { id: '4', name: 'Kiyimlar', slug: 'kiyimlar', parentId: null, iconUrl: null, sortOrder: 4, isActive: true, children: [] },
  ];
  await page.route('https://cdn.example.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="8" fill="#d9f2ee"/><rect x="16" y="8" width="16" height="32" rx="3" fill="#218477"/></svg>' }));
  const requests: { method: string; id?: string; body: Record<string, unknown> }[] = [];
  const tree = (parentId: string | null): Node[] => nodes.filter(node => node.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder).map(node => ({ ...node, children: tree(node.id) }));
  await page.route('**/api/v1/admin/categories**', async route => {
    const request = route.request();
    const method = request.method();
    const id = new URL(request.url()).pathname.split('/')[5];
    if (method === 'GET') { await route.fulfill({ json: { data: tree(null) } }); return; }
    const body = method === 'DELETE' ? {} : request.postDataJSON() as Record<string, unknown>;
    requests.push({ method, id, body });
    if (method === 'DELETE') {
      if (nodes.some(node => node.parentId === id)) {
        await route.fulfill({ status: 409, json: { message: 'Ichki kategoriyalari bor kategoriyani o‘chirib bo‘lmaydi', errorCode: 'CONFLICT' } });
      } else {
        nodes = nodes.filter(node => node.id !== id);
        await route.fulfill({ json: { data: { id, deleted: true } } });
      }
      return;
    }
    const slug = String(body.name).toLowerCase().replaceAll(' ', '-');
    if (nodes.some(node => node.slug === slug && node.id !== id)) {
      await route.fulfill({ status: 409, json: { message: 'Bunday slug bilan kategoriya mavjud', errorCode: 'CONFLICT' } });
      return;
    }
    const saved = { ...(nodes.find(node => node.id === id) ?? {}), ...body, slug, id: id ?? '5', children: [] } as Node;
    nodes = method === 'POST' ? [...nodes, saved] : nodes.map(node => node.id === id ? saved : node);
    await route.fulfill({ status: method === 'POST' ? 201 : 200, json: { data: saved } });
  });
  return requests;
}

for (const width of [1440, 768, 375]) {
  test(`kategoriya daraxti, ikonka, qidiruv va responsive UI (${width}px)`, async ({ page }, testInfo) => {
    await setupTree(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/admin/categories');
    await expect(page.getByText('Smartfonlar', { exact: true })).toBeVisible();
    await expect(page.locator('[data-category-id="3"] > div').first()).toContainText('Nofaol');
    await expect(page.locator('[data-category-id="2"] > div').first().locator('img')).toBeVisible();
    await expect.poll(async () => {
      const scroller = await page.getByTestId('category-tree-scroll').boundingBox();
      const root = await page.getByTestId('category-tree-root').boundingBox();
      return Boolean(scroller && root && root.x >= scroller.x && root.x + root.width <= scroller.x + scroller.width);
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`categories-${width}.png`), fullPage: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Barchasini yopish' }).click();
    await expect(page.getByText('Smartfonlar', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Barchasini ochish' }).click();
    await expect(page.getByText('Smartfonlar', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Nom yoki slug bo‘yicha qidirish' }).fill('smartfonlar');
    await expect(page.getByText('Elektronika', { exact: true })).toBeVisible();
    await expect(page.getByText('Telefonlar', { exact: true })).toBeVisible();
    await expect(page.getByText('Smartfonlar', { exact: true })).toBeVisible();
    await expect(page.getByText('Kiyimlar', { exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Nom yoki slug bo‘yicha qidirish' }).fill('topilmaydi');
    await expect(page.getByText('Kategoriya topilmadi', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Kategoriya qo‘shish', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`category-form-${width}.png`), fullPage: true });
    await expect.poll(() => page.getByRole('dialog').evaluate(node => node.getBoundingClientRect().width <= innerWidth)).toBe(true);
  });
}

test('ichki kategoriya yaratish va ikonka, tartib, faol holatini tahrirlash', async ({ page }) => {
  const requests = await setupTree(page);
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Telefonlar ichiga kategoriya qo‘shish' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Telefonlar');
  await dialog.getByLabel('Nomi').fill('Aksessuarlar');
  await dialog.getByLabel('Ikonka URL manzili').fill('https://cdn.example.com/phone.svg');
  await dialog.getByLabel('Tartib raqami').fill('7');
  await dialog.getByRole('switch').click();
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog).toBeHidden();
  expect(requests[0]).toEqual({ method: 'POST', id: undefined, body: { name: 'Aksessuarlar', parentId: '2', iconUrl: 'https://cdn.example.com/phone.svg', sortOrder: 7, isActive: false } });
  const row = page.locator('[data-category-id="5"] > div').first();
  await expect(row).toContainText('Nofaol');
  await expect(row.locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Aksessuarlar kategoriyasini tahrirlash' }).click();
  await expect(dialog.getByLabel('Nomi')).toHaveValue('Aksessuarlar');
  await expect(dialog.getByLabel('Tartib raqami')).toHaveValue('7');
  await dialog.getByLabel('Nomi').fill('Yangi aksessuarlar');
  await dialog.getByLabel('Ikonka URL manzili').clear();
  await dialog.getByLabel('Tartib raqami').fill('0');
  await dialog.getByRole('switch').click();
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog).toBeHidden();
  expect(requests[1]).toEqual({ method: 'PATCH', id: '5', body: { name: 'Yangi aksessuarlar', parentId: '2', iconUrl: null, sortOrder: 0, isActive: true } });
  await expect(page.locator('[data-category-id="5"] > div').first()).toContainText('Faol');
});

for (const edit of [false, true]) {
  test(`dublikat slug: ${edit ? 'PATCH' : 'POST'} 409 xatosi, forma saqlanadi va qayta yuboriladi`, async ({ page }) => {
    const requests = await setupTree(page);
    await page.goto('/admin/categories');
    await page.getByRole('button', { name: edit ? 'Kiyimlar kategoriyasini tahrirlash' : 'Kategoriya qo‘shish', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nomi').fill('Elektronika');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog.getByRole('alert').first()).toContainText('Bunday slug bilan kategoriya mavjud');
    await expect(dialog.getByLabel('Nomi')).toHaveValue('Elektronika');
    await dialog.getByLabel('Nomi').fill('Kitoblar');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Kitoblar', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0].method).toBe(edit ? 'PATCH' : 'POST');
    expect(requests[0].body).not.toHaveProperty('slug');
  });
}

test('ota kategoriya o‘zini va avlodlarini tanlamaydi, boshqa daraxtga ko‘chadi', async ({ page }) => {
  const requests = await setupTree(page);
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Elektronika kategoriyasini tahrirlash' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ota kategoriya').click();
  const options = page.locator('.ant-select-dropdown:visible');
  await expect(options.getByText('Elektronika', { exact: true })).toHaveCount(0);
  await expect(options.getByText('Telefonlar', { exact: true })).toHaveCount(0);
  await expect(options.getByText('Smartfonlar', { exact: true })).toHaveCount(0);
  await options.getByText('Kiyimlar', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog).toBeHidden();
  expect(requests[0].body.parentId).toBe('4');
  await expect(page.getByText('Smartfonlar', { exact: true })).toBeVisible();
});

test('DELETE tasdiqlanadi, ichki kategoriyali tugun xatosi va bargni o‘chirish', async ({ page }) => {
  const requests = await setupTree(page);
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Elektronika kategoriyasini o‘chirish' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Elektronika');
  expect(requests).toHaveLength(0);
  await dialog.getByRole('button', { name: 'O‘chirish', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Ichki kategoriyalari bor kategoriyani o‘chirib bo‘lmaydi');
  await dialog.getByRole('button', { name: 'Bekor', exact: true }).click();
  await page.getByRole('button', { name: 'Smartfonlar kategoriyasini o‘chirish' }).click();
  await dialog.getByRole('button', { name: 'Bekor', exact: true }).click();
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Smartfonlar kategoriyasini o‘chirish' }).click();
  await dialog.getByRole('button', { name: 'O‘chirish', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Smartfonlar', { exact: true })).toHaveCount(0);
  expect(requests[1]).toMatchObject({ method: 'DELETE', id: '3' });
});

test('loading, API xatosidan tiklanish, bo‘sh daraxt va majburiy nom', async ({ page }) => {
  await setupTree(page);
  let release: (() => void) | undefined;
  let fail = true;
  await page.route('**/api/v1/admin/categories', async route => {
    if (fail) {
      await new Promise<void>(resolve => { release = resolve; });
      await route.fulfill({ status: 400, json: { message: 'Kategoriyalarni yuklab bo‘lmadi' } });
    } else await route.fulfill({ json: { data: [] } });
  });
  await page.goto('/admin/categories');
  await expect(page.locator('.ant-skeleton')).toBeVisible();
  await expect.poll(() => Boolean(release)).toBe(true);
  release!();
  await expect(page.locator('.ant-result-error')).toBeVisible();
  fail = false;
  await page.locator('.ant-result-extra button').click();
  await expect(page.getByText('Kategoriyalar yo‘q')).toBeVisible();
  await page.getByRole('button', { name: 'Kategoriya qo‘shish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Kategoriya nomini kiriting', { exact: true })).toBeVisible();
});
