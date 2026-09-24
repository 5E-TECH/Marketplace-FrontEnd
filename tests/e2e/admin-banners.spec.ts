import { expect, test, type Page } from '@playwright/test';
import { seedAccessToken } from './support/auth';

type BannerRow = {
  id: string; title: string; imageUrl: string; linkUrl: string | null;
  sortOrder: number; isActive: boolean; startsAt: string | null; endsAt: string | null; isVisible: boolean;
};

const MEDIA = 'https://api.elchimarket.uz/media/marketplace-media/banners';
const UPLOADED = `${MEDIA}/1727000000000-uuid.jpg`;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const banner = (overrides: Partial<BannerRow> & { id: string; title: string }): BannerRow => ({
  imageUrl: `${MEDIA}/banner.jpg`, linkUrl: null, sortOrder: 0,
  isActive: true, startsAt: null, endsAt: null, isVisible: true, ...overrides,
});

type Request = { method: string; path: string; body: Record<string, unknown> };

// Banner DTO va endpointlar 5E-TECH/marketplace banner.service.ts bo'yicha.
async function setup(page: Page, initial: BannerRow[], options: { failReorderOnce?: boolean } = {}) {
  await seedAccessToken(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: '1', role: 'ADMIN', name: 'Admin', phone: '+998900000000', isActive: true, isDeleted: false } } }));
  page.on('pageerror', error => { throw error; });
  await page.route('https://api.elchimarket.uz/media/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="28"><rect width="64" height="28" fill="#d9f2ee"/></svg>' }));

  let rows = [...initial];
  let failReorder = Boolean(options.failReorderOnce);
  const requests: Request[] = [];
  let listCalls = 0;
  const sorted = () => [...rows].sort((left, right) => left.sortOrder - right.sortOrder || Number(left.id) - Number(right.id));

  await page.route('**/api/v1/admin/content/banners**', async route => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    if (method === 'GET') { listCalls += 1; await route.fulfill({ json: { data: sorted() } }); return; }
    if (path.endsWith('/image')) {
      requests.push({ method, path, body: { contentType: request.headers()['content-type'] ?? '' } });
      await route.fulfill({ status: 201, json: { data: { url: UPLOADED, objectName: 'banners/1727000000000-uuid.jpg', bucket: 'marketplace-media', mimeType: 'image/jpeg', size: JPEG.length } } });
      return;
    }
    const body = method === 'DELETE' ? {} : request.postDataJSON() as Record<string, unknown>;
    requests.push({ method, path, body });
    if (method === 'POST') {
      const created = banner({ id: '99', title: String(body.title), ...body as Partial<BannerRow> });
      rows = [...rows, created];
      await route.fulfill({ status: 201, json: { data: created } });
      return;
    }
    if (path.endsWith('/order')) {
      if (failReorder) {
        failReorder = false;
        rows = rows.slice(1); // boshqa admin shu orada birinchi bannerni o'chirdi
        await route.fulfill({ status: 404, json: { statusCode: 404, message: 'Bannerlardan biri topilmadi', errorCode: 'NOT_FOUND' } });
        return;
      }
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
  return { requests, read: () => sorted(), listCalls: () => listCalls };
}

const openCreate = async (page: Page) => {
  await page.getByRole('button', { name: 'Banner qo‘shish', exact: true }).click();
  return page.getByRole('dialog', { name: 'Yangi banner' });
};
const uploadImage = (page: Page, file = { name: 'kuz.jpg', mimeType: 'image/jpeg', buffer: JPEG }) =>
  page.getByRole('dialog').locator('input[type=file]').setInputFiles(file);

test('admin rasmni yuklab banner qo‘shadi — yuklangan manzil POST ga ketadi', async ({ page }) => {
  const { requests } = await setup(page, []);
  await expect(page.getByText('Bannerlar yo‘q')).toBeVisible();
  const dialog = await openCreate(page);
  await uploadImage(page);
  await expect.poll(() => requests.find(item => item.path.endsWith('/image'))?.body.contentType).toContain('multipart/form-data');
  await expect(dialog.getByRole('button', { name: 'Rasmni almashtirish' })).toBeVisible();
  await expect(dialog.getByText('Kompyuterda')).toBeVisible();
  await expect(dialog.getByText('Telefonda')).toBeVisible();

  await dialog.getByLabel('Banner sarlavhasi').fill('Kuzgi aksiya');
  await dialog.getByLabel('Havola').fill('/katalog/telefon');
  // Sarlavha preview'da rasm ustida chiqadi (desktop va telefon).
  await expect(dialog.getByText('Kuzgi aksiya')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => requests.find(item => item.method === 'POST' && !item.path.endsWith('/image'))?.body).toMatchObject({
    title: 'Kuzgi aksiya', imageUrl: UPLOADED, linkUrl: '/katalog/telefon', isActive: true,
  });
  await expect(page.locator('[data-banner-id] strong')).toHaveText(['Kuzgi aksiya']);
});

test('rasmsiz banner saqlanmaydi', async ({ page }) => {
  const { requests } = await setup(page, []);
  const dialog = await openCreate(page);
  await dialog.getByLabel('Banner sarlavhasi').fill('Rasmsiz');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Banner rasmini yuklang')).toBeVisible();
  expect(requests.filter(item => item.method === 'POST')).toHaveLength(0);
});

test('noto‘g‘ri turdagi yoki 5 MB dan katta fayl serverga yuborilmaydi', async ({ page }) => {
  const { requests } = await setup(page, []);
  const dialog = await openCreate(page);
  await uploadImage(page, { name: 'hujjat.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(dialog.getByText('Faqat JPEG, PNG yoki WEBP rasm yuklash mumkin')).toBeVisible();
  await uploadImage(page, { name: 'katta.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(dialog.getByText('Fayl 5 MB dan katta')).toBeVisible();
  expect(requests.filter(item => item.path.endsWith('/image'))).toHaveLength(0);
});

for (const link of ['katalog/telefon', 'elchimarket.uz/aksiya', '/storefront/products?categoryId=7', '//evil.example.com']) {
  test(`storefront bosa olmaydigan havola saqlanmaydi: ${link}`, async ({ page }) => {
    const { requests } = await setup(page, []);
    const dialog = await openCreate(page);
    await uploadImage(page);
    await expect(dialog.getByRole('button', { name: 'Rasmni almashtirish' })).toBeVisible();
    await dialog.getByLabel('Banner sarlavhasi').fill('Aksiya');
    await dialog.getByLabel('Havola').fill(link);
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog.getByText('Havola / bilan boshlanuvchi sayt yo‘li')).toBeVisible();
    expect(requests.filter(item => item.method === 'POST' && !item.path.endsWith('/image'))).toHaveLength(0);
  });
}

test('sichqoncha bilan tanlangan sana "OK" bosilmasa ham saqlanadi', async ({ page }) => {
  const { requests } = await setup(page, []);
  const dialog = await openCreate(page);
  await uploadImage(page);
  await expect(dialog.getByRole('button', { name: 'Rasmni almashtirish' })).toBeVisible();
  await dialog.getByLabel('Banner sarlavhasi').fill('Rejalashtirilgan');
  await dialog.getByLabel('Boshlanishi').click();
  const cell = page.locator('.ant-picker-dropdown:visible .ant-picker-cell-in-view').last();
  const picked = await cell.getAttribute('title');
  await cell.click();
  // "OK" bosilmaydi — to'g'ridan-to'g'ri saqlash.
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => requests.find(item => item.method === 'POST' && !item.path.endsWith('/image'))?.body.startsAt).not.toBeNull();
  const startsAt = String(requests.find(item => item.method === 'POST' && !item.path.endsWith('/image'))?.body.startsAt);
  const local = new Date(startsAt);
  const day = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  expect(day).toBe(picked);
});

test('yangi banner ro‘yxat oxiriga tushadi (eng katta tartib + 1)', async ({ page }) => {
  const { requests } = await setup(page, [
    banner({ id: '1', title: 'Birinchi', sortOrder: 0 }),
    banner({ id: '2', title: 'Ikkinchi', sortOrder: 7 }),
  ]);
  const dialog = await openCreate(page);
  await uploadImage(page);
  await expect(dialog.getByRole('button', { name: 'Rasmni almashtirish' })).toBeVisible();
  await dialog.getByLabel('Banner sarlavhasi').fill('Uchinchi');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => requests.find(item => item.method === 'POST' && !item.path.endsWith('/image'))?.body.sortOrder).toBe(8);
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

test('tartiblash xato bersa ro‘yxat qayta olinadi — eskirgan ro‘yxatda qolib ketmaydi', async ({ page }) => {
  const { listCalls } = await setup(page, [
    banner({ id: '1', title: 'O‘chirilgan', sortOrder: 0 }),
    banner({ id: '2', title: 'Qolgan', sortOrder: 1 }),
    banner({ id: '3', title: 'Uchinchi', sortOrder: 2 }),
  ], { failReorderOnce: true });
  await expect(page.locator('[data-banner-id]')).toHaveCount(3);
  const before = listCalls();
  await page.getByRole('button', { name: 'Uchinchi bannerini yuqoriga ko‘chirish' }).click();
  await expect(page.getByText('Bannerlardan biri topilmadi')).toBeVisible();
  await expect.poll(listCalls).toBeGreaterThan(before);
  await expect(page.locator('[data-banner-id] strong')).toHaveText(['Qolgan', 'Uchinchi']);
});

test('tahrir faqat o‘zgargan maydonni yuboradi, tartibga tegmaydi', async ({ page }) => {
  const { requests } = await setup(page, [banner({ id: '7', title: 'Aksiya', sortOrder: 3, isActive: true })]);
  await page.getByRole('button', { name: 'Aksiya bannerini tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bannerni tahrirlash' });
  await expect(dialog.getByLabel('Tartib')).toHaveCount(0);
  await dialog.getByLabel('Banner sarlavhasi').fill('Yangi kolleksiya');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect.poll(() => requests.find(item => item.method === 'PATCH')?.body).toEqual({ title: 'Yangi kolleksiya' });
});

test('o‘chirish DELETE yuboradi va banner ro‘yxatdan yo‘qoladi', async ({ page }) => {
  const { requests } = await setup(page, [banner({ id: '7', title: 'Aksiya' })]);
  await page.getByRole('button', { name: 'Aksiya bannerini o‘chirish' }).click();
  await page.getByRole('dialog', { name: 'Banner o‘chirilsinmi?' }).getByRole('button', { name: 'O‘chirish' }).click();
  await expect.poll(() => requests.find(item => item.method === 'DELETE')?.path).toBe('/api/v1/admin/content/banners/7');
  await expect(page.getByText('Bannerlar yo‘q')).toBeVisible();
});

test('teskari muddat serverga yuborilmaydi', async ({ page }) => {
  const { requests } = await setup(page, []);
  const dialog = await openCreate(page);
  await uploadImage(page);
  await expect(dialog.getByRole('button', { name: 'Rasmni almashtirish' })).toBeVisible();
  await dialog.getByLabel('Banner sarlavhasi').fill('Xato muddat');
  await dialog.getByLabel('Boshlanishi').fill('2026-10-01 10:00:00');
  await dialog.getByLabel('Boshlanishi').press('Enter');
  await dialog.getByLabel('Tugashi').fill('2026-09-01 10:00:00');
  await dialog.getByLabel('Tugashi').press('Enter');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak')).toBeVisible();
  expect(requests.filter(item => item.method === 'POST' && !item.path.endsWith('/image'))).toHaveLength(0);
});

test('bannerlar chegarasiga yetganda yangi qo‘shib bo‘lmaydi', async ({ page }) => {
  await setup(page, Array.from({ length: 100 }, (_, index) => banner({ id: String(index + 1), title: `B${index + 1}`, sortOrder: index })));
  await expect(page.locator('[data-banner-id]')).toHaveCount(100);
  await expect(page.getByRole('button', { name: 'Banner qo‘shish', exact: true })).toBeDisabled();
  await expect(page.getByText('Bannerlar soni 100 taga yetdi')).toBeVisible();
});
