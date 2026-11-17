import { expect, test, type Page } from '@playwright/test';
import { findClippedBlocks } from './support/layout';
import { installAuthenticatedSession, operatorUser } from './support/auth';

// Sotuvchi moliyasi — backend hisobidan: `/seller/finance/{summary,ledger,payouts,payout-schedule}`.
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type PayoutStatus = 'PENDING' | 'APPROVED' | 'HELD' | 'PAID';
const entryTypes = ['SALE', 'COMMISSION', 'COD_SALE', 'PAYOUT', 'REFUND'] as const;
const referenceTypes = ['seller_order', 'seller_order', 'cod_seller_order', 'payout', 'seller_order_refund'] as const;

/** 23 ta sentabr yozuvi (3 sahifa × 10) va 1 ta avgust yozuvi — davr filtri uchun. */
const ledger = [
  ...Array.from({ length: 23 }, (_, index) => ({
    id: String(500 + index), shopId: '7', entryType: entryTypes[index % entryTypes.length],
    amount: index % entryTypes.length === 0 || index % entryTypes.length === 2 ? 100_000 + index * 1_000 : -(10_000 + index * 100),
    balanceAfter: 1_000_000 + index * 5_000, referenceType: referenceTypes[index % referenceTypes.length], referenceId: String(1200 + index),
    createdAt: `2026-09-${String(1 + index).padStart(2, '0')}T08:00:00.000Z`,
  })),
  { id: '9001', shopId: '7', entryType: 'ADJUST', amount: 5_000, balanceAfter: 5_000, referenceType: 'manual', referenceId: '1', createdAt: '2026-08-20T08:00:00.000Z' },
];
const payouts = (['PENDING', 'APPROVED', 'HELD', 'PAID', 'PAID', 'PENDING'] as PayoutStatus[]).map((status, index) => ({
  id: String(80 + index), shopId: '7', amount: 225_000 + index * 10_000, status, method: null, referenceId: String(1300 + index),
  paidAt: status === 'PAID' ? '2026-09-15T09:00:00.000Z' : null, createdAt: '2026-09-10T09:00:00.000Z', updatedAt: '2026-09-10T09:00:00.000Z',
}));
const cod = { settlementsCount: 14, expectedCodAmount: 3_400_000, collectedCodAmount: 3_350_000, difference: -50_000, expectedCommission: 340_000, nettedCommission: 200_000, outstandingCommission: 140_000 };
const nextDate: Record<Frequency, string> = { DAILY: '2026-10-01', WEEKLY: '2026-10-05', MONTHLY: '2026-10-01' };

const money = (value: number) => `${value < 0 ? '-' : ''}${String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`;
const envelope = (data: unknown) => ({ statusCode: 200, message: 'OK', data });
const pageOf = <T,>(items: T[], params: Record<string, string>) => {
  const current = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);
  return { items: items.slice((current - 1) * limit, current * limit), total: items.length, page: current, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
};
const inRange = (createdAt: string, params: Record<string, string>) => (!params.dateFrom || createdAt.slice(0, 10) >= params.dateFrom) && (!params.dateTo || createdAt.slice(0, 10) <= params.dateTo);

interface FinanceApi {
  summary: Array<Record<string, string>>;
  ledger: Array<Record<string, string>>;
  payouts: Array<Record<string, string>>;
  scheduleUpdates: unknown[];
  balance: number;
  frequency: Frequency;
  isDefault: boolean;
  fail: boolean;
  entries?: Array<Record<string, unknown> & { createdAt: string }>;
  payoutRows?: typeof payouts;
}

async function mockFinance(page: Page, overrides: Partial<FinanceApi> = {}): Promise<FinanceApi> {
  const api: FinanceApi = { summary: [], ledger: [], payouts: [], scheduleUpdates: [], balance: 1_180_000, frequency: 'WEEKLY', isDefault: true, fail: false, ...overrides };
  const params = (url: string) => Object.fromEntries(new URL(url).searchParams);
  const failed = { status: 500, json: { statusCode: 500, message: 'Server xatosi' } };
  await page.route('**/api/v1/seller/finance/summary**', (route) => {
    const query = params(route.request().url());
    api.summary.push(query);
    if (api.fail) return route.fulfill(failed);
    const paid = payouts.filter(({ status, paidAt }) => status === 'PAID' && paidAt && inRange(paidAt, query)).reduce((total, { amount }) => total + amount, 0);
    return route.fulfill({ json: envelope({ shopId: '7', balance: api.balance, pendingPayoutAmount: 450_000, heldPayoutAmount: 245_000, paidPayoutAmount: paid, cod, payoutSchedule: api.frequency, nextPayoutDate: nextDate[api.frequency] }) });
  });
  await page.route('**/api/v1/seller/finance/ledger**', (route) => {
    const query = params(route.request().url());
    api.ledger.push(query);
    if (api.fail) return route.fulfill(failed);
    return route.fulfill({ json: envelope(pageOf((api.entries ?? ledger).filter(({ createdAt }) => inRange(createdAt, query)), query)) });
  });
  await page.route('**/api/v1/seller/finance/payouts**', (route) => {
    const query = params(route.request().url());
    api.payouts.push(query);
    if (api.fail) return route.fulfill(failed);
    return route.fulfill({ json: envelope(pageOf((api.payoutRows ?? payouts).filter(({ status }) => !query.status || status === query.status), query)) });
  });
  await page.route('**/api/v1/seller/finance/payout-schedule', (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { frequency: Frequency };
      api.scheduleUpdates.push(body);
      api.frequency = body.frequency;
      api.isDefault = false;
    }
    return route.fulfill({ json: envelope({ frequency: api.frequency, isDefault: api.isDefault, nextPayoutDate: nextDate[api.frequency], updatedAt: api.isDefault ? null : '2026-09-30T05:00:00.000Z' }) });
  });
  return api;
}

async function openFinance(page: Page, overrides: Partial<FinanceApi> = {}, url = '/finance') {
  // Standart davr — joriy oy: sana qotiriladi.
  await page.clock.setFixedTime(new Date('2026-09-30T10:00:00+05:00'));
  await installAuthenticatedSession(page);
  const api = await mockFinance(page, overrides);
  await page.goto(url);
  return api;
}

const summaryRegion = (page: Page) => page.getByRole('region', { name: 'Moliya jamlanmasi' });
const card = (page: Page, title: string) => summaryRegion(page).locator('article').filter({ hasText: title });
const openTab = (page: Page, name: string) => page.getByRole('tab', { name }).click();
const panel = (page: Page, title: string) => page.locator('section').filter({ has: page.getByText(title, { exact: true }) }).last();

test('TC1: jamlanma kartalari backend qiymatlarini ko‘rsatadi, davr backendga ketadi', async ({ page }) => {
  const api = await openFinance(page);
  await expect(page.getByRole('menuitem', { name: 'Moliya' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moliya', level: 1 })).toBeVisible();
  await expect(card(page, 'Balans')).toContainText(money(1_180_000));
  await expect(card(page, 'Balans')).toContainText('Platforma sizga to‘laydigan summa');
  await expect(card(page, 'Kutilayotgan to‘lovlar')).toContainText(money(450_000));
  await expect(card(page, 'Kutilayotgan to‘lovlar')).toContainText('Keyingi to‘lov: 05.10.2026');
  await expect(card(page, 'Ushlab turilgan')).toContainText(money(245_000));
  await expect(card(page, 'Davrda to‘langan')).toContainText(money(255_000 + 265_000));
  // Joriy oy: summary va ledger bir xil davr bilan so'raladi; shopId yuborilmaydi (token'dan).
  expect(api.summary[0]).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  // Davr yig'indisi davrdagi barcha ledger yozuvlaridan (100 tadan sahifalab) olinadi.
  await expect.poll(() => api.ledger[0]).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30', page: '1', limit: '100' });
  await expect(page.getByText(/Balans, kutilayotgan va ushlab turilgan to‘lovlar — hozirgi holat, sanaga bog‘liq emas/)).toBeVisible();
});

test('TC9: davr hisobi — jami tushum, komissiya, qaytarish, qo‘lga tegadigan summa va har buyurtma bo‘yicha', async ({ page }) => {
  // finance-service qoidalari: online — SALE/COMMISSION, COD — COD_SALE/COD_SETTLEMENT/COMMISSION, qaytarish — REFUND.
  const row = (id: string, entryType: string, amount: number, referenceType: string, referenceId: string, day: string) => ({ id, shopId: '7', entryType, amount, balanceAfter: 0, referenceType, referenceId, createdAt: `2026-09-${day}T08:00:00.000Z` });
  const entries = [
    row('1', 'SALE', 200_000, 'seller_order', '64', '10'), row('2', 'COMMISSION', -20_000, 'seller_order', '64', '10'),
    row('3', 'COD_SALE', 150_000, 'cod_seller_order', '65', '12'), row('4', 'COD_SETTLEMENT', -150_000, 'cod_seller_order', '65', '12'), row('5', 'COMMISSION', -15_000, 'cod_seller_order', '65', '12'),
    row('6', 'REFUND', -45_000, 'return_request', '7', '14'),
    row('7', 'PAYOUT', -180_000, 'payout', '90', '15'),
  ];
  const payoutRows = [{ id: '90', shopId: '7', amount: 180_000, status: 'PAID' as PayoutStatus, method: null, referenceId: '64', paidAt: '2026-09-15T09:00:00.000Z', createdAt: '2026-09-10T09:00:00.000Z', updatedAt: '2026-09-15T09:00:00.000Z' }];
  await openFinance(page, { entries, payoutRows });
  const period = (title: string) => page.getByRole('region', { name: 'Davr bo‘yicha hisob' }).locator('article').filter({ has: page.getByText(title, { exact: true }) });
  await expect(period('Jami tushum')).toContainText(money(350_000));
  await expect(period('Jami tushum')).toContainText('2 ta buyurtma');
  await expect(period('Ushlangan komissiya')).toContainText(money(35_000));
  await expect(period('Ushlangan komissiya')).toContainText('Tushumning 10%');
  await expect(period('Qaytarishlar')).toContainText(money(45_000));
  await expect(period('Qo‘lga tegadigan summa')).toContainText(money(270_000));
  // Har buyurtma bo'yicha (standart tab): COD_SETTLEMENT va PAYOUT tushumga kirmaydi.
  const online = page.getByRole('row').filter({ hasText: 'Posilka #64' });
  await expect(online).toContainText('Online');
  await expect(online).toContainText(money(200_000));
  await expect(online).toContainText(`−${money(20_000)}`);
  await expect(online).toContainText(money(180_000));
  await expect(online).toContainText('To‘langan');
  const codRow = page.getByRole('row').filter({ hasText: 'Posilka #65' });
  await expect(codRow).toContainText('Naqd (COD)');
  await expect(codRow).toContainText(money(135_000));
  await expect(codRow).toContainText('Naqd sizda (COD)');
  await expect(page.getByRole('row').filter({ hasText: 'Qaytarish so‘rovi #7' })).toContainText(money(-45_000));
  await expect(page.getByText('Jami 3 ta')).toBeVisible();
});

test('TC2: manfiy balans — komissiya qarzi sifatida ko‘rsatiladi', async ({ page }) => {
  await openFinance(page, { balance: -120_000 });
  await expect(card(page, 'Balans')).toContainText(money(-120_000));
  await expect(card(page, 'Balans')).toContainText('Komissiya qarzi — keyingi to‘lovdan ushlanadi');
});

test('TC3: COD hisob-kitobi paneli', async ({ page }) => {
  await openFinance(page);
  const codPanel = panel(page, 'Naqd (COD) hisob-kitobi');
  await expect(codPanel).toContainText('Hisob-kitob qilingan posilkalar14');
  await expect(codPanel).toContainText(money(3_400_000));
  await expect(codPanel).toContainText(money(3_350_000));
  await expect(codPanel).toContainText(money(-50_000));
  await expect(codPanel).toContainText(money(140_000));
});

test('TC4: hisob yozuvlari — tur, asos, ishorali summa va sahifalash', async ({ page }) => {
  const api = await openFinance(page);
  await openTab(page, 'Hisob yozuvlari');
  const sale = page.getByRole('row').filter({ hasText: '#1200' });
  await expect(sale).toContainText('Sotuv');
  await expect(sale).toContainText('Buyurtma #1200');
  await expect(sale).toContainText(`+${money(100_000)}`);
  const commission = page.getByRole('row').filter({ hasText: '#1201' });
  await expect(commission).toContainText('Komissiya');
  await expect(commission).toContainText(money(-10_100));
  await expect(page.getByRole('row').filter({ hasText: '#1203' })).toContainText('To‘lov #1203');
  await expect(page.getByText('Jami 23 ta')).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(11);
  await page.getByTitle('3', { exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '#1222' })).toBeVisible();
  await expect.poll(() => api.ledger.some(({ page: current, limit }) => current === '3' && limit === '10')).toBe(true);
});

test('TC5: sana filtri summary va ledgerga ketadi, URL’da saqlanadi va tozalanadi', async ({ page }) => {
  const api = await openFinance(page);
  await openTab(page, 'Hisob yozuvlari');
  await expect(page.getByText('Jami 23 ta')).toBeVisible();

  const start = page.getByLabel('Boshlanish sanasi');
  await start.fill('2026-08-01');
  await start.press('Enter');
  await expect(page).toHaveURL(/from=2026-08-01&to=2026-09-30/);
  await expect(page.getByText('Jami 24 ta')).toBeVisible();
  expect(api.summary.some(({ dateFrom, dateTo }) => dateFrom === '2026-08-01' && dateTo === '2026-09-30')).toBe(true);
  expect(api.ledger.some(({ dateFrom, page: current }) => dateFrom === '2026-08-01' && current === '1')).toBe(true);

  // Sahifa yangilansa davr saqlanadi.
  await page.reload();
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('2026-08-01');
  await openTab(page, 'Hisob yozuvlari');
  await expect(page.getByText('Jami 24 ta')).toBeVisible();

  await page.getByRole('button', { name: 'Tozalash' }).click();
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByLabel('Boshlanish sanasi')).toHaveValue('2026-09-01');
  await expect(page.getByText('Jami 23 ta')).toBeVisible();
});

test('TC6: to‘lovlar — ro‘yxat va holat filtri', async ({ page }) => {
  const api = await openFinance(page);
  await page.getByRole('tab', { name: 'To‘lovlar' }).click();
  const first = page.getByRole('row').filter({ hasText: '#80' });
  await expect(first).toContainText(money(225_000));
  await expect(first).toContainText('#1300');
  await expect(first).toContainText('Kutilmoqda');
  await expect(page.getByText('Jami 6 ta')).toBeVisible();
  // To'lovlar sana bo'yicha filtrlanmaydi — kontraktda davr parametri yo'q.
  expect(api.payouts.some((query) => JSON.stringify(query) === JSON.stringify({ page: '1', limit: '10' }))).toBe(true);

  await page.getByLabel('To‘lov holati').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'To‘langan' }).click();
  await expect(page.getByText('Jami 2 ta')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '#83' })).toContainText(/15\.09\.2026/);
  await expect.poll(() => api.payouts.at(-1)).toEqual({ page: '1', limit: '10', status: 'PAID' });
});

test('TC7: to‘lov jadvalini sotuvchi o‘zi tanlaydi', async ({ page }) => {
  const api = await openFinance(page);
  const schedule = panel(page, 'To‘lov jadvali');
  await expect(schedule).toContainText('Keyingi to‘lov: 05.10.2026');
  await expect(schedule).toContainText('Har hafta');
  await expect(schedule).toContainText('platforma standarti');
  const save = schedule.getByRole('button', { name: 'Saqlash' });
  await expect(save).toBeDisabled();

  await schedule.getByRole('combobox').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Har kuni' }).click();
  await expect(save).toBeEnabled();
  const summaryCalls = api.summary.length;
  await save.click();
  await expect(page.getByText('To‘lov jadvali saqlandi')).toBeVisible();
  expect(api.scheduleUpdates).toEqual([{ frequency: 'DAILY' }]);
  await expect(schedule).toContainText('Keyingi to‘lov: 01.10.2026');
  await expect(schedule).not.toContainText('platforma standarti');
  await expect(save).toBeDisabled();
  // Jamlanmadagi keyingi to'lov kuni ham yangilanadi.
  await expect.poll(() => api.summary.length).toBeGreaterThan(summaryCalls);
  await expect(card(page, 'Kutilayotgan to‘lovlar')).toContainText('Keyingi to‘lov: 01.10.2026');
});

test('TC8: ma’lumot yo‘q holati — bo‘sh jadval xabarlari', async ({ page }) => {
  await openFinance(page, {}, '/finance?from=2026-07-01&to=2026-07-31');
  await expect(page.getByText('Bu davrda hisob-kitob yo‘q')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Davr bo‘yicha hisob' }).locator('article').filter({ hasText: 'Jami tushum' })).toContainText(money(0));
  await openTab(page, 'Hisob yozuvlari');
  await expect(page.getByText('Bu davrda hisob yozuvlari yo‘q')).toBeVisible();
});

test('API xato bersa xabar va qayta urinish ishlaydi', async ({ page }) => {
  const api = await openFinance(page, { fail: true });
  await expect(page.getByText('Moliya jamlanmasini yuklab bo‘lmadi')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Buyurtmalar bo‘yicha hisobni yuklab bo‘lmadi').first()).toBeVisible();
  api.fail = false;
  // Jamlanma va davr hisobi alohida yuklanadi — har birining o'z "Qayta urinish" tugmasi bor.
  const retry = page.getByRole('button', { name: /Qayta urinish/ });
  for (let attempt = 0; attempt < 4 && await retry.count(); attempt++) await retry.first().click();
  await expect(card(page, 'Balans')).toContainText(money(1_180_000));
});

test('operator moliya bo‘limini ko‘rmaydi va ocha olmaydi', async ({ page }) => {
  await installAuthenticatedSession(page, operatorUser);
  const api = await mockFinance(page);
  await page.route('**/api/v1/seller/orders**', (route) => route.fulfill({ json: envelope({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 }) }));
  await page.goto('/orders');
  await expect(page.getByRole('menuitem', { name: 'Buyurtmalar' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Moliya' })).toHaveCount(0);
  await page.goto('/finance');
  await expect(page.getByText('Bu bo‘lim sizga ochiq emas')).toBeVisible();
  await expect(summaryRegion(page)).toHaveCount(0);
  expect(api.summary).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px ekranda moliya sahifasi sig‘adi`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openFinance(page);
    await expect(card(page, 'Balans')).toContainText(money(1_180_000));
    await expect(page.getByRole('row').filter({ hasText: 'Posilka #1222' })).toBeVisible();
    await expect(panel(page, 'To‘lov jadvali')).toContainText('Har hafta');
    expect(await findClippedBlocks(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`finance-${viewport.width}.png`), fullPage: true });
  });
}
