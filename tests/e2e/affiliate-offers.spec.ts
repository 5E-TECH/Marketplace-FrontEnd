import { expect, test, type Page } from '@playwright/test';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { installMockApi } from './support/mockApi';

/**
 * FE-05 (sotuvchi-offerlar, sotuvchi-offer, sotuvchi-sahifalarim, sotuvchi-sahifa-sozlash): offerlar,
 * bir bosishda sahifa, «Mening sahifalarim», sozlash (narx chegarasi, piksel). TC1–TC6 va qabul mezonlari.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

async function loginSeller(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('900000001');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
}

const card = (page: Page, name: string) => page.getByTestId('offer-card').filter({ has: page.getByRole('heading', { name }) });

/** Bosilgandan havola ko'ringungacha — sahifa ichidagi vaqt (Playwright kutishlarisiz). */
async function createFromCard(page: Page, name: string) {
  const button = card(page, name).getByRole('button', { name: 'Sahifa yaratish' });
  await button.waitFor();
  const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/affiliate/streams') && response.request().method() === 'POST');
  const elapsed = page.evaluate(() => new Promise<number>((resolve) => {
    const link = () => document.querySelector('[data-testid="stream-ready"] [data-testid="stream-link"]')?.textContent ?? '';
    const before = link();
    const start = performance.now();
    const observer = new MutationObserver(() => {
      if (link() && link() !== before) {
        observer.disconnect();
        resolve(performance.now() - start);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }));
  await button.click();
  const response = await created;
  await expect(page.getByTestId('stream-ready')).toBeVisible();
  const body = (await response.json()) as { data: { id: string; code: string; link: string } };
  return { elapsed: await elapsed, stream: body.data };
}

test('TC1: offer kartasida «Sahifa yaratish» → 1 s da havola ko‘rindi va nusxalandi; forma yo‘q', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/offers');
  await expect(page.getByRole('heading', { name: 'Offerlar', level: 1 })).toBeVisible();
  const { elapsed, stream } = await createFromCard(page, 'Simsiz quloqchinlar');
  expect(elapsed).toBeLessThan(1_000);
  // Bir bosish: oyna yoki forma ochilmaydi (qabul mezoni 1).
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const ready = page.getByTestId('stream-ready');
  await expect(ready.getByTestId('stream-link')).toContainText(stream.code);
  await expect(ready).toContainText('Shablon: Standart');
  await expect(ready).toContainText('Haqingiz: 65 000 so‘m');
  await ready.getByRole('button', { name: 'Nusxa olish' }).click();
  await expect(page.getByText('Havola nusxalandi')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(stream.link);
  // Pastdagi «Mening sahifalarim» da — «hozir yaratildi».
  const preview = page.getByTestId('my-pages-preview');
  await expect(preview.getByRole('row').filter({ hasText: stream.code })).toContainText('hozir yaratildi');
});

test('TC2: shu mahsulotga ikkinchi sahifa → «Mening sahifalarim» da ikkalasi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/offers');
  const first = await createFromCard(page, 'Aqlli soat');
  const second = await createFromCard(page, 'Aqlli soat');
  expect(second.stream.code).not.toBe(first.stream.code);
  await page.goto('/affiliate/pages');
  await page.getByLabel('Mahsulot:').selectOption({ label: 'Aqlli soat' });
  const rows = page.getByTestId('stream-row');
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId('streams-table')).toContainText(first.stream.code);
  await expect(page.getByTestId('streams-table')).toContainText(second.stream.code);
});

test('TC3: «Ochib ko‘rish» — sotuvchi sahifasi yangi tabda (landing buyurtma formasi bilan)', async ({ page, context }) => {
  await context.route('https://elchi.example/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Landing</title><form><label>Ismingiz<input name="name"></label><button>Buyurtma berish</button></form>' }),
  );
  await loginSeller(page);
  await page.goto('/affiliate/offers');
  const { stream } = await createFromCard(page, 'Simsiz quloqchinlar');
  const open = page.getByTestId('stream-ready').getByRole('link', { name: 'Ochib ko‘rish' });
  await expect(open).toHaveAttribute('target', '_blank');
  const [tab] = await Promise.all([context.waitForEvent('page'), open.click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe(stream.link);
  await expect(tab.getByRole('button', { name: 'Buyurtma berish' })).toBeVisible();
});

test('TC4: narx 277 000 (chegara 276 000) → xato xabari, saqlab bo‘lmaydi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/offers');
  await createFromCard(page, 'Aqlli soat');
  await page.getByTestId('stream-ready').getByRole('link', { name: 'Sozlash' }).click();
  await expect(page.getByRole('heading', { name: 'Sahifani sozlash', level: 1 })).toBeVisible();
  const price = page.getByLabel('Sahifadagi narx', { exact: true });
  await price.fill('277000');
  const priceCard = page.getByTestId('price-card');
  await expect(priceCard.getByRole('alert')).toContainText('Narx 251 000 – 276 000 so‘m oralig‘ida bo‘lishi kerak');
  const changes = page.getByTestId('changes-card');
  await expect(changes).toContainText('Narx chegaradan tashqarida');
  await expect(changes.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  // Chegarada — saqlanadi, haq ustamaning 85% i bilan.
  await price.fill('276000');
  await expect(changes).toContainText('81 250 so‘m');
  await changes.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Sozlamalar saqlandi', { exact: true })).toBeVisible();
  await expect(changes).toContainText('Hammasi saqlangan');
});

test('TC5: filtr «Tasdiq ≥ 50%» → ro‘yxat qisqardi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/offers');
  await expect(page.getByTestId('offer-card')).toHaveCount(5);
  const filtered = page.waitForResponse((response) => response.url().includes('/affiliate/offers?') && response.url().includes('minApproveRate=50'));
  await page.getByLabel('Tasdiq ≥ 50%').click();
  await filtered;
  await expect(page.getByLabel('Tasdiq ≥ 50%')).toBeChecked();
  await expect(page.getByTestId('offer-card')).toHaveCount(2);
  await expect(page.getByTestId('offers-count')).toHaveText('2 ta offer · 5 tadan');
  await expect(page).toHaveURL(/approve=50/);
});

test('TC6: sozlashda postback URL yo‘q; piksel ID saqlandi → landing javobida shu piksel', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/pages/331');
  await expect(page.getByRole('heading', { name: 'Sahifani sozlash', level: 1 })).toBeVisible();
  await expect(page.getByText(/postback url/i)).toHaveCount(0);
  await expect(page.getByLabel(/postback/i)).toHaveCount(0);
  await page.getByLabel('Meta piksel ID').fill('1234567890');
  const saved = page.waitForResponse((response) => response.url().endsWith('/affiliate/streams/331') && response.request().method() === 'PATCH');
  await page.getByTestId('changes-card').getByRole('button', { name: 'Saqlash' }).click();
  expect((await saved).request().postDataJSON()).toEqual({ metaPixelId: '1234567890' });
  const landing = await page.evaluate(async () => (await (await fetch('/api/v1/landing/k7m2qa')).json()) as { data: { metaPixelId: string | null } });
  expect(landing.data.metaPixelId).toBe('1234567890');
});

test('mezon: qoldiq 0 offerda «Sahifa yaratish» yopiq; S1/S3 varianti ko‘rinmaydi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/offers');
  const empty = card(page, 'Bolalar termos shishasi');
  await expect(empty.getByRole('button', { name: 'Sahifa yaratish' })).toBeDisabled();
  await expect(empty).toContainText('Qoldiq tugagan');
  await page.goto('/affiliate/offers/504');
  await expect(page.getByTestId('offer-fee').getByRole('button', { name: 'Sahifa yaratish' })).toBeDisabled();
  await expect(page.getByText('Qoldiq tugagan — yangi sahifa ochilmaydi')).toBeVisible();
  for (const path of ['/affiliate/offers', '/affiliate/offers/501', '/affiliate/pages', '/affiliate/pages/331']) {
    await page.goto(path);
    await expect(page.locator('main')).not.toContainText(/\bS[13]\b/);
  }
});

test('Mening sahifalarim: tablar, qidiruv, tanlangan sahifa; saqlanmagan narx bilan chiqishda so‘raydi', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/affiliate/pages');
  await expect(page.getByTestId('stream-row')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Qidiruv' }).fill('p3v9');
  await expect(page.getByTestId('stream-row')).toHaveCount(1);
  await expect(page.getByTestId('selected-stream')).toContainText('p3v9tx');
  await expect(page.getByTestId('selected-stream')).toContainText('86 250 so‘m');
  await page.getByTestId('selected-stream').getByRole('link', { name: 'Sozlash' }).click();
  await page.getByLabel('Sahifadagi narx', { exact: true }).fill('280000');
  await page.getByRole('link', { name: 'Offerlar' }).first().click();
  const leave = page.getByRole('dialog', { name: 'O‘zgarishlar saqlanmagan' });
  await expect(leave).toContainText('Narx: 287 000 → 280 000 so‘m');
  await leave.getByRole('button', { name: 'Qolish' }).click();
  await expect(page).toHaveURL(/\/affiliate\/pages\/332$/);
});
