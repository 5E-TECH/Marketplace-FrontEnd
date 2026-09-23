import { expect, test } from '@playwright/test';
import { seedAccessToken } from './support/auth';

type BannerRow = {
  id: string; title: string; imageUrl: string; linkUrl: string | null;
  sortOrder: number; isActive: boolean; startsAt: string | null; endsAt: string | null; isVisible: boolean;
};

const banner = (overrides: Partial<BannerRow> & { id: string; title: string }): BannerRow => ({
  imageUrl: 'https://cdn.example.com/banner.jpg', linkUrl: null, sortOrder: 0,
  isActive: true, startsAt: null, endsAt: null, isVisible: true, ...overrides,
});

// Banner DTO va endpointlar 5E-TECH/marketplace banner.service.ts bo'yicha.
async function setup(page: import('@playwright/test').Page, initial: BannerRow[]) {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: '1', role: 'ADMIN', name: 'Admin', phone: '+998900000000', isActive: true, isDeleted: false } } }));
  page.on('pageerror', error => { throw error; });
  await page.route('https://cdn.example.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="28"><rect width="64" height="28" fill="#d9f2ee"/></svg>' }));

  let rows = [...initial];
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const sorted = () => [...rows].sort((left, right) => left.sortOrder - right.sortOrder || Number(left.id) - Number(right.id));

  await page.route('**/api/v1/admin/content/banners**', async route => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    if (method === 'GET') { await route.fulfill({ json: { data: sorted() } }); return; }
    const body = method === 'DELETE' ? {} : request.postDataJSON() as Record<string, unknown>;
    requests.push({ method, path, body });
    if (method === 'POST') {
      const created = banner({ id: '99', title: String(body.title), ...body as Partial<BannerRow> });
      rows = [...rows, created];
      await route.fulfill({ status: 201, json: { data: created } });
      return;
    }
    if (path.endsWith('/order')) {
      const items = body.items as { id: string; sortOrder: number }[];
      rows = rows.map(row => ({ ...row, sortOrder: items.find(item => item.id === row.id)?.sortOrder ?? row.sortOrder }));
      await route.fulfill({ json: { data: sorted() } });
      return;
    }
    const id = path.split('/').at(-1) ?? '';
    if (method === 'DELETE') { rows = rows.filter(row => row.id !== id); await route.fulfill({ json: { data: { id, deleted: true } } }); return; }
    rows = rows.map(row => row.id === id ? { ...row, ...body as Partial<BannerRow> } : row);
    await route.fulfill({ json: { data: rows.find(row => row.id === id) } });
  });
  await page.goto('/admin/banners');
  return { requests, read: () => sorted() };
}

test('admin banner qo‘shadi — POST /admin/content/banners', async ({ page }) => {
  const { requests } = await setup(page, []);
  await expect(page.getByText('Bannerlar yo‘q')).toBeVisible();
  await page.getByRole('button', { name: 'Banner qo‘shish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi banner' });
  await dialog.getByLabel('Nomi').fill('Kuzgi aksiya');
  await dialog.getByLabel('Rasm manzili').fill('https://cdn.example.com/kuz.jpg');
  await dialog.getByLabel('Havola').fill('/katalog/telefon');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => requests.find(item => item.method === 'POST')?.body).toMatchObject({
    title: 'Kuzgi aksiya', imageUrl: 'https://cdn.example.com/kuz.jpg', linkUrl: '/katalog/telefon', isActive: true,
  });
  await expect(page.getByText('Kuzgi aksiya')).toBeVisible();
});

test('ro‘yxat sortOrder tartibida va holat belgisi bilan chiqadi', async ({ page }) => {
  await setup(page, [
    banner({ id: '1', title: 'Ikkinchi', sortOrder: 20 }),
    banner({ id: '2', title: 'Birinchi', sortOrder: 5 }),
    banner({ id: '3', title: 'Muddati tugagan', sortOrder: 30, isVisible: false, endsAt: '2020-01-01T00:00:00.000Z' }),
    banner({ id: '4', title: 'Nofaol', sortOrder: 40, isActive: false, isVisible: false }),
  ]);
  await expect(page.locator('[data-banner-id]')).toHaveCount(4);
  await expect(page.locator('[data-banner-id] strong')).toHaveText(['Birinchi', 'Ikkinchi', 'Muddati tugagan', 'Nofaol']);
  await expect(page.locator('[data-banner-id="3"]')).toContainText('Muddati tugagan');
  await expect(page.locator('[data-banner-id="4"]')).toContainText('Ko‘rinmaydi');
});

test('tartiblash butun ro‘yxatni PATCH /order ga yuboradi', async ({ page }) => {
  const { requests, read } = await setup(page, [
    banner({ id: '1', title: 'Birinchi', sortOrder: 0 }),
    banner({ id: '2', title: 'Ikkinchi', sortOrder: 1 }),
  ]);
  await page.getByRole('button', { name: 'Ikkinchi bannerini yuqoriga ko‘chirish' }).click();
  await expect.poll(() => requests.find(item => item.path.endsWith('/order'))?.body).toEqual({
    items: [{ id: '2', sortOrder: 0 }, { id: '1', sortOrder: 1 }],
  });
  await expect.poll(() => read().map(row => row.title)).toEqual(['Ikkinchi', 'Birinchi']);
  await expect(page.locator('[data-banner-id] strong')).toHaveText(['Ikkinchi', 'Birinchi']);
});

test('tahrirlash PATCH, o‘chirish DELETE yuboradi', async ({ page }) => {
  const { requests } = await setup(page, [banner({ id: '7', title: 'Aksiya' })]);
  await page.getByRole('button', { name: 'Aksiya bannerini tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bannerni tahrirlash' });
  await dialog.getByLabel('Nomi').fill('Yangi kolleksiya');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => requests.find(item => item.method === 'PATCH')?.body).toMatchObject({ title: 'Yangi kolleksiya' });

  await page.getByRole('button', { name: 'Yangi kolleksiya bannerini o‘chirish' }).click();
  await page.getByRole('dialog', { name: 'Banner o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();
  await expect.poll(() => requests.find(item => item.method === 'DELETE')?.path).toBe('/api/v1/admin/content/banners/7');
  await expect(page.getByText('Bannerlar yo‘q')).toBeVisible();
});

test('teskari muddat serverga yuborilmaydi', async ({ page }) => {
  const { requests } = await setup(page, []);
  await page.getByRole('button', { name: 'Banner qo‘shish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Yangi banner' });
  await dialog.getByLabel('Nomi').fill('Xato muddat');
  await dialog.getByLabel('Rasm manzili').fill('https://cdn.example.com/x.jpg');
  await dialog.getByLabel('Boshlanishi').fill('2026-10-01 10:00:00');
  await dialog.getByLabel('Boshlanishi').press('Enter');
  await dialog.getByLabel('Tugashi').fill('2026-09-01 10:00:00');
  await dialog.getByLabel('Tugashi').press('Enter');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak')).toBeVisible();
  expect(requests.filter(item => item.method === 'POST')).toHaveLength(0);
});
