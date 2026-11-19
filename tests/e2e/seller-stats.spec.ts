import { expect, test, type Page, type Response } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { installMockApi } from './support/mockApi';

/**
 * FE-06 «Statistika» (sotuvchi-statistika, umumiy-eksport, hujjat-statistika-csv): davr, kesim va
 * sahifa filtri, raqamlar BE-28 javobi bilan bir xil, kunlik va lidlar CSV (****4567), TC1–TC4.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

interface StatsRow {
  key: string;
  clicks: number;
  leads: number;
  validLeads: number;
  confirmed: number;
  delivered: number;
  refused: number;
  incomeHold: number;
  incomeAvailable: number;
}
interface StatsBody {
  rows: StatsRow[];
  totals: StatsRow;
}

async function loginSeller(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('900000001');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
}

const statsResponse = (page: Page, match: (url: URL) => boolean) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/v1/affiliate/stats') && match(url);
  });
const statsBody = async (response: Response) => ((await response.json()) as { data: StatsBody }).data;
const digits = (text: string | null) => Number((text ?? '').replace(/\D/g, ''));
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

/** «Kesim» segmenti: antd radio inputi ko'rinmas — yorlig'i bosiladi. */
const cutOption = (page: Page, name: string) => page.locator('.ant-segmented-item', { hasText: new RegExp(`^${name}$`) });

async function openStats(page: Page) {
  await loginSeller(page);
  const response = statsResponse(page, (url) => url.searchParams.get('groupBy') === 'DAY' && !url.searchParams.has('streamId'));
  // «Sahifa sifati» sahifalar kesimini darhol so'raydi — «Kesim: Sahifa» shu keshdan (qayta so'rov yo'q).
  const byStream = statsResponse(page, (url) => url.searchParams.get('groupBy') === 'STREAM' && !url.searchParams.has('streamId'));
  await page.goto('/affiliate/stats');
  const body = await statsBody(await response);
  await expect(page.getByTestId('stats-funnel')).toBeVisible();
  return Object.assign(body, { byStream: await statsBody(await byStream) });
}

async function expectFunnel(page: Page, totals: StatsRow) {
  const funnel = page.getByTestId('stats-funnel');
  for (const field of ['clicks', 'leads', 'validLeads', 'confirmed', 'delivered', 'refused'] as const) {
    expect(digits(await funnel.locator(`[data-kpi="${field}"]`).locator('span').nth(1).textContent()), field).toBe(totals[field]);
  }
  expect(digits(await funnel.locator('[data-income="available"] b').textContent())).toBe(totals.incomeAvailable);
  expect(digits(await funnel.locator('[data-income="hold"] b').textContent())).toBe(totals.incomeHold);
}

async function download(page: Page, action: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: file.suggestedFilename(), text: (await readFile(await file.path(), 'utf8')).replace(/^\uFEFF/, '') };
}

test('TC1: davr, kesim va sahifa filtri; raqamlar BE-28 bilan bir xil; kunlik CSV', async ({ page }) => {
  const week = await openStats(page);
  await expect(page.locator('header').getByRole('status')).toContainText(/Statistika har soatda yangilanadi · \d{2}:\d{2}/);
  await expectFunnel(page, week.totals);

  // Kunlar jadvali: 7 kun + «Jami, 7 kun» — jami server `totals` bilan bir xil.
  const byDay = page.getByTestId('stats-by-day');
  await expect(byDay.locator('tbody tr')).toHaveCount(7);
  const total = byDay.locator('tfoot tr');
  await expect(total).toContainText('Jami, 7 kun');
  expect(digits(await total.locator('td').nth(1).textContent())).toBe(week.totals.clicks);
  expect(digits(await total.locator('td').nth(2).textContent())).toBe(week.totals.leads);
  await shot(page, 'stats-1440-day');

  // Kunlik CSV: sarlavha, 7 kun va jami qatori — sahifadagi raqamlar bilan bir xil.
  await page.getByRole('button', { name: 'Eksport', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Eksport — Statistika/ });
  await expect(dialog.getByTestId('stats-export-file')).toContainText(/statistika_\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{4}\.csv · 8 ta qator/);
  await shot(page, 'stats-1440-export');
  const daily = await download(page, () => dialog.getByRole('button', { name: 'Eksport qilish' }).click());
  expect(daily.name).toMatch(/^statistika_\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{4}\.csv$/);
  const lines = daily.text.trimEnd().split('\r\n');
  expect(lines[0]).toBe('Sana;Kliklar;Lidlar;Yaroqli;Tasdiqlangan;Yetkazilgan;Rad etilgan;Daromad;Ushlab turilgan;Mavjud');
  expect(lines).toHaveLength(9);
  const t = week.totals;
  expect(lines[8]).toBe(`Jami;${t.clicks};${t.leads};${t.validLeads};${t.confirmed};${t.delivered};${t.refused};${t.incomeHold + t.incomeAvailable};${t.incomeHold};${t.incomeAvailable}`);
  await expect(page.getByText(/Fayl yuklab olindi: statistika_/)).toBeVisible();

  // Davr: «Bugun» — so'rov from = to.
  const todayResponse = statsResponse(page, (url) => url.searchParams.get('from') === url.searchParams.get('to') && url.searchParams.get('groupBy') === 'DAY');
  await page.getByRole('combobox', { name: 'Davr' }).click();
  await page.getByRole('option', { name: /^Bugun \(/ }).click();
  await expectFunnel(page, (await statsBody(await todayResponse)).totals);
  await expect(page).toHaveURL(/period=today/);

  // Sahifa filtri: p3v9tx — natija va sifat faqat shu sahifa bo'yicha.
  const filtered = statsResponse(page, (url) => url.searchParams.get('streamId') === '332');
  await page.getByRole('combobox', { name: 'Sahifa' }).click();
  await page.getByRole('option', { name: /^p3v9tx/ }).click();
  const filteredBody = await statsBody(await filtered);
  await expectFunnel(page, filteredBody.totals);
  await expect(page.getByTestId('stats-quality').locator('[data-stream]')).toHaveCount(1);
  await expect(page).toHaveURL(/page=332/);

  // Filtrlar faylga ham qo'llanadi: kunlik CSV jami — p3v9tx natijasi, lidlar CSV — faqat p3v9tx lidlari.
  const f = filteredBody.totals;
  await page.getByRole('button', { name: 'Eksport', exact: true }).click();
  await expect(dialog).toContainText('Sahifa — p3v9tx');
  const dailyFiltered = await download(page, () => dialog.getByRole('button', { name: 'Eksport qilish' }).click());
  expect(dailyFiltered.text.trimEnd().split('\r\n').at(-1)).toBe(
    `Jami;${f.clicks};${f.leads};${f.validLeads};${f.confirmed};${f.delivered};${f.refused};${f.incomeHold + f.incomeAvailable};${f.incomeHold};${f.incomeAvailable}`,
  );
  await page.getByRole('button', { name: 'Eksport', exact: true }).click();
  await dialog.getByRole('radio', { name: /^Lidlar/ }).check();
  const leadsFiltered = await download(page, () => dialog.getByRole('button', { name: 'Eksport qilish' }).click());
  const leadRows = leadsFiltered.text.trimEnd().split('\r\n').slice(1);
  expect(leadRows).toHaveLength(f.leads);
  for (const row of leadRows) expect(row.split(';')[2]).toBe('p3v9tx');
});

test('qabul mezoni: har kun, sahifa sifati va sub qatorlari BE-28 javobi bilan bir xil', async ({ page }) => {
  const week = await openStats(page);
  const byDay = page.getByTestId('stats-by-day');
  for (const row of week.rows) {
    const cells = byDay.locator(`tbody tr[data-day="${row.key}"] td`);
    const values = await Promise.all([0, 1, 2, 3, 4, 5].map(async (index) => digits(await cells.nth(index).textContent())));
    expect(values, row.key).toEqual([row.clicks, row.leads, row.validLeads, row.confirmed, row.delivered, row.refused]);
    expect(digits(await cells.nth(6).locator('span').first().textContent()), `${row.key} daromad`).toBe(row.incomeHold + row.incomeAvailable);
  }
  for (const row of week.byStream.rows) {
    const item = page.getByTestId('stats-quality').locator(`[data-stream="${row.key}"]`);
    await expect(item).toContainText(`${row.leads} / 50`);
    await expect(item).toContainText(`${row.validLeads} / ${row.leads}`);
    await expect(item).toContainText(`${row.confirmed} / ${row.validLeads}`);
  }

  const bySub = statsResponse(page, (url) => url.searchParams.get('groupBy') === 'SUB1');
  await cutOption(page, 'Sub').click();
  const subs = await statsBody(await bySub);
  const subTable = page.getByTestId('stats-by-sub1');
  for (const row of subs.rows) {
    const cells = subTable.locator(`tbody tr[data-group="${row.key || 'no-sub'}"] td`);
    expect(digits(await cells.nth(0).textContent()), `${row.key} kliklar`).toBe(row.clicks);
    expect(digits(await cells.nth(1).textContent()), `${row.key} lidlar`).toBe(row.leads);
  }
  expect(digits(await subTable.locator('tfoot td').nth(1).textContent())).toBe(subs.totals.clicks);
});

test('holatlar: API xatosi — «Qayta urinish» bilan tiklanadi; davrda ma’lumot yo‘q — bo‘sh holat', async ({ page }) => {
  let failing = true;
  const zero: StatsRow = { key: 'TOTAL', clicks: 0, leads: 0, validLeads: 0, confirmed: 0, delivered: 0, refused: 0, incomeHold: 0, incomeAvailable: 0 };
  await page.route('**/api/v1/affiliate/stats?*', async (route) => {
    const url = new URL(route.request().url());
    if (failing && url.searchParams.get('groupBy') === 'DAY') {
      await route.fulfill({ status: 500, json: { statusCode: 500, message: 'Ichki xato' } });
      return;
    }
    await route.fulfill({ json: { statusCode: 200, message: 'OK', data: { rows: [], totals: zero } } });
  });
  await loginSeller(page);
  await page.goto('/affiliate/stats');
  const retry = page.getByRole('button', { name: 'Qayta urinish' }).first();
  await expect(retry).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('stats-quality')).toBeVisible();
  failing = false;
  await retry.click();
  await expect(page.getByText('Bu davrda klik yo‘q')).toBeVisible();
  await expectFunnel(page, zero);
});

test('TC2: lidlar CSV da mijoz faqat ****4567; to‘liq raqam sahifada ham, faylda ham yo‘q', async ({ page }) => {
  const week = await openStats(page);
  await page.getByRole('button', { name: 'Eksport', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Eksport — Statistika/ });
  await dialog.getByRole('radio', { name: /^Lidlar/ }).check();
  await expect(dialog.getByTestId('stats-export-file')).toContainText(`lidlar_`);
  await expect(dialog.getByTestId('stats-export-file')).toContainText(`· ${week.totals.leads} ta qator`);
  await expect(dialog.getByText('****4567').first()).toBeVisible();
  const file = await download(page, () => dialog.getByRole('button', { name: 'Eksport qilish' }).click());
  expect(file.name).toMatch(/^lidlar_.*\.csv$/);
  const rows = file.text.trimEnd().split('\r\n');
  expect(rows[0]).toBe('Keldi;Lid;Sahifa;sub1;Mijoz;Lid holati;Buyurtma;Haq;Haq holati');
  expect(rows.length - 1).toBe(week.totals.leads);
  for (const row of rows.slice(1)) {
    expect(row.split(';')[4]).toMatch(/^\*{4}\d{4}$/);
  }
  // To'liq raqam (998…, 9 xonali) hech qayerda yo'q.
  expect(file.text).not.toMatch(/\d{9}/);
  // Sahifada ham: telefon ko'rinishi (90 123 45 67, 998901234567) yo'q — pul summalari 3 xonali guruhlarda.
  const visible = await page.locator('body').innerText();
  expect(visible).not.toMatch(/\b\d{2} \d{3} \d{2} \d{2}\b/);
  expect(visible).not.toMatch(/998\d{9}|\b9\d{8}\b/);
});

test('TC3: «Kesim: Sahifa» — ikki sotuvchi sahifasi, har biri o‘z kliklari va lidlari bilan; «Sub» — sub1 qatorlari', async ({ page }) => {
  const { byStream: body } = await openStats(page);
  await cutOption(page, 'Sahifa').click();
  await expect(page).toHaveURL(/cut=STREAM/);
  const table = page.getByTestId('stats-by-stream');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  for (const row of body.rows) {
    const line = table.locator(`tbody tr[data-group="${row.key}"]`);
    expect(digits(await line.locator('td').nth(0).textContent())).toBe(row.clicks);
    expect(digits(await line.locator('td').nth(1).textContent())).toBe(row.leads);
  }
  expect(body.rows.map((row) => row.key).sort()).toEqual(['k7m2qa', 'p3v9tx']);
  expect(body.rows[0].clicks).not.toBe(body.rows[1].clicks);
  await expect(table.locator('thead')).toContainText('Sotilish');
  await expect(table.locator('thead')).toContainText('EPC');
  await shot(page, 'stats-1440-stream');

  const bySub = statsResponse(page, (url) => url.searchParams.get('groupBy') === 'SUB1');
  await cutOption(page, 'Sub').click();
  const subs = await statsBody(await bySub);
  const subTable = page.getByTestId('stats-by-sub1');
  await expect(subTable.locator('tbody tr')).toHaveCount(subs.rows.length);
  await expect(subTable.locator('tbody tr[data-group="no-sub"]')).toContainText('sub yo‘q');
});

test('TC4: yetkazilgan buyurtma daromadi «ushlab turilgan»da; Elchi pulni o‘tkazgach «mavjud»ga o‘tadi (MOL-2)', async ({ page }) => {
  let transferred = false;
  const day = (hold: boolean): StatsRow => ({
    key: '', clicks: 120, leads: 10, validLeads: 9, confirmed: 5, delivered: 1, refused: 0, incomeHold: hold ? 65000 : 0, incomeAvailable: hold ? 0 : 65000,
  });
  await page.route('**/api/v1/affiliate/stats?*', async (route) => {
    const url = new URL(route.request().url());
    const totals = { ...day(!transferred), key: 'TOTAL' };
    const rows = url.searchParams.get('groupBy') === 'DAY' ? [{ ...day(!transferred), key: url.searchParams.get('to') ?? '' }] : [];
    await route.fulfill({ json: { statusCode: 200, message: 'OK', data: { rows, totals } } });
  });
  await loginSeller(page);
  await page.goto('/affiliate/stats');
  const funnel = page.getByTestId('stats-funnel');
  await expect(funnel.locator('[data-income="hold"]')).toContainText('65 000');
  await expect(funnel.locator('[data-income="available"]')).toContainText('0');
  await expect(page.getByTestId('stats-by-day').locator('tbody tr').first()).toContainText('ushlab turilgan');

  transferred = true;
  await page.reload();
  await expect(funnel.locator('[data-income="available"]')).toContainText('65 000');
  expect(digits(await funnel.locator('[data-income="hold"] b').textContent())).toBe(0);
  await expect(page.getByTestId('stats-by-day').locator('tbody tr').first()).not.toContainText('ushlab turilgan');
});

test('planshet (768) va telefon (390): toshish yo‘q; telefonda eksport oynasi pastdan, fayl yuklanadi', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openStats(page);
  await expect(page.getByTestId('stats-by-day')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, 'stats-768-day');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('stats-by-day')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, 'stats-390-day');
  await page.getByRole('button', { name: 'Eksport', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Eksport — Statistika/ });
  await expect(dialog).toBeVisible();
  const sheet = page.locator('.ant-modal').filter({ hasText: 'Eksport — Statistika' });
  await expect.poll(async () => { const box = await sheet.boundingBox(); return Math.round((box?.y ?? 0) + (box?.height ?? 0)); }).toBe(844);
  await dialog.getByRole('radio', { name: /^Lidlar/ }).check();
  await shot(page, 'stats-390-export');
  const file = await download(page, () => dialog.getByRole('button', { name: 'Eksport qilish' }).click());
  expect(file.name).toMatch(/^lidlar_/);
});
