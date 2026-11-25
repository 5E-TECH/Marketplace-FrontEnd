import { expect, test, type Page } from '@playwright/test';
import { seeded } from '../../src/mocks/utils';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-26: «Lidlar» (admin-lidlar) — admin va nazoratchi. Mock (src/mocks/handlers/leadOrders.ts): operator navbati
 * lidlari + tarixiy lidlar (L-1279/L-1272 — Dilnoza R. dagi rejalashtirilgan qo'ng'iroqlar, L-1270 rad etilgan,
 * L-1268 yaroqsiz, 7 ta «Tekshiruvda» ariza h2q7vz) va buyurtmalar lidlari. Operatorlar: Umida S., Sabina X., Temur K.,
 * Shohruh M. — onlayn; Feruza Y., Jamshid E. — tanaffusda; Lola A. — oflayn.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function signIn(page: Page, phone: string, home: RegExp) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(home);
}

const rows = (page: Page) => page.getByTestId('lead-row');
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Lid holatlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const toast = (page: Page) => page.locator('.ant-notification-notice').last();

async function openLeads(page: Page, query = '') {
  await signIn(page, '900000007', /\/admin\//);
  await page.goto(`/admin/leads${query}`);
  await expect(rows(page).first()).toBeVisible();
}

test('admin: tablar sonlari, «Tekshiruvda» banneri va tabi, real vaqt qatori, izoh', async ({ page }) => {
  await openLeads(page);
  await expect(page.getByText('Real vaqtda yangilanadi')).toBeVisible();
  await expect(tab(page, 'Hammasi')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Tekshiruvda')).toContainText('7');
  const banner = page.getByRole('status').filter({ hasText: '7 ta ariza tekshiruvda — navbatga tushmagan' });
  await expect(banner).toContainText('sahifa h2q7vz · Firdavs O.');
  await banner.getByRole('button', { name: 'Tekshiruvdagi arizalarni ochish' }).click();
  await expect(page).toHaveURL(/tab=REVIEW/);
  await expect(tab(page, 'Tekshiruvda')).toHaveAttribute('aria-selected', 'true');
  await expect(rows(page)).toHaveCount(7);
  await expect(banner).toHaveCount(0);
  await expect(page.getByText(/bir IP dan 10 daqiqada 5 tadan ortiq kelgan arizalar/)).toBeVisible();
});

test('TC4: sotuvchi va davr filtri — faqat shu sotuvchi lidlari, raqam niqoblangan; tozalash', async ({ page }) => {
  await openLeads(page);
  await page.getByLabel('Sotuvchi:').selectOption({ label: 'Sherzod A.' });
  await page.getByLabel('Davr:').selectOption({ index: 1 });
  await expect(page).toHaveURL(/affiliate=U-0101/);
  await expect(page).toHaveURL(/period=today/);
  await expect(rows(page).filter({ hasNotText: 'Sherzod A.' })).toHaveCount(0);
  await expect(rows(page).first()).toContainText('Sherzod A.');
  // Ro'yxatda to'liq raqam yo'q (BE-42): jadvalda telefon ustuni ham faqat telefon bo'yicha qidiruvda.
  await expect(page.getByRole('columnheader', { name: 'Telefon' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sotuvchi filtrini tozalash' })).toBeVisible();
  await page.getByRole('button', { name: 'Filtrlarni tozalash' }).click();
  await expect(page).not.toHaveURL(/affiliate=/);
  await expect(page.getByLabel('Davr:')).toHaveValue('');
});

test('saralash: «Narx» bosilsa — kamayish, yana bosilsa — o‘sish', async ({ page }) => {
  await openLeads(page);
  const price = page.getByRole('columnheader', { name: /Narx/ });
  await expect(page.getByRole('columnheader', { name: /Keldi/ })).toHaveAttribute('aria-sort', 'descending');
  await price.getByRole('button').click();
  await expect(price).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveURL(/sort=-price/);
  await price.getByRole('button').click();
  await expect(price).toHaveAttribute('aria-sort', 'ascending');
});

test('ommaviy o‘tkazish: ikkita rejalashtirilgan qo‘ng‘iroq — vaqtlari saqlanadi, bronlar o‘zgarmaydi', async ({ page }) => {
  await openLeads(page, '?tab=ACTIVE&operator=U-0003');
  await page.getByRole('checkbox', { name: 'L-1279 ni tanlash' }).check();
  await page.getByRole('checkbox', { name: 'L-1272 ni tanlash' }).check();
  const selection = page.getByTestId('lead-selection');
  await expect(selection).toContainText('2 ta lid tanlandi');
  await expect(selection).toContainText('ikkalasi — Dilnoza R. dagi rejalashtirilgan qo‘ng‘iroq');
  await selection.getByRole('button', { name: 'Boshqa operatorga o‘tkazish' }).click();
  const dialog = page.getByTestId('transfer-dialog');
  await expect(dialog).toContainText('2 ta lidni boshqa operatorga o‘tkazish');
  await expect(dialog).toContainText('Tanaffusdagi (Feruza Y., Jamshid E.) va oflayn (Lola A.) operatorga o‘tkazib bo‘lmaydi.');
  await expect(dialog.getByText('Dilnoza R.', { exact: true })).toHaveCount(0);
  await dialog.getByText('Umida S.', { exact: true }).click();
  await expect(dialog).toContainText('rejalashtirilgan +1 → +3');
  await expect(dialog).toContainText('1/5 — o‘zgarmaydi');
  await expect(dialog).toContainText('saqlanadi');
  await dialog.getByLabel('Izoh').fill('Dilnoza R. kasal');
  await dialog.getByRole('button', { name: 'Umida S.ga o‘tkazish' }).click();
  await expect(toast(page)).toContainText('2 ta lid o‘tkazildi');
  await expect(toast(page)).toContainText('Qo‘ng‘iroq vaqtlari saqlandi');
  await expect(selection).toHaveCount(0);
  await page.goto('/admin/leads?q=L-1279');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Umida S.');
  await expect(rows(page)).toContainText('Qayta qo‘ng‘iroq');
});

test('bitta lid: operator tanlanmasa — maydon xatosi; tanlansa — bronga tushadi', async ({ page }) => {
  await openLeads(page, '?tab=ACTIVE&status=NEW');
  const first = rows(page).first();
  const id = (await first.getByRole('link').first().textContent()) ?? '';
  await first.getByRole('button', { name: `${id} amallari` }).click();
  await page.getByRole('menuitem', { name: 'Boshqa operatorga o‘tkazish' }).click();
  const dialog = page.getByTestId('transfer-dialog');
  await expect(dialog).toContainText(`${id} ni operatorga o‘tkazish`);
  await expect(dialog).toContainText(/navbatda \d+-o‘rin/);
  await dialog.getByRole('button', { name: 'O‘tkazish', exact: true }).click();
  await expect(dialog.getByText('Operatorni tanlang — bu maydon majburiy')).toBeVisible();
  await expect(dialog.getByLabel(/Yangi operator/)).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel(/Yangi operator/).selectOption({ label: 'Temur K. — 1/5 bron' });
  await dialog.getByRole('button', { name: 'O‘tkazish', exact: true }).click();
  await expect(toast(page)).toContainText(`${id} o‘tkazildi`);
  await expect(dialog).toHaveCount(0);
});

test('qator menyusi: yopilgan lidni o‘tkazib bo‘lmaydi; «Rad etildi» — sabab bilan qayta ochiladi', async ({ page }) => {
  await openLeads(page, '?q=L-1268');
  await page.getByRole('button', { name: 'L-1268 amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Boshqa operatorga o‘tkazish' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: 'Qayta ochish' })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');

  await page.getByLabel('Lidlarni qidirish').fill('L-1270');
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'L-1270 amallari' }).click();
  await page.getByRole('menuitem', { name: 'Qayta ochish' }).click();
  const dialog = page.getByTestId('reopen-dialog');
  await expect(dialog).toContainText('L-1270 · Nilufar');
  await expect(dialog).toContainText('«Qimmat»');
  await expect(dialog).toContainText('Rad etilganiga 3 kun bo‘lmagan');
  await dialog.getByRole('button', { name: 'Qayta ochish' }).click();
  await expect(dialog.getByText('Sababni yozing — lid tarixiga yoziladi')).toBeVisible();
  await dialog.getByLabel(/Sabab/).fill('Mijoz o‘ylab ko‘rib, buyurtma berishga rozi bo‘ldi');
  await dialog.getByRole('button', { name: 'Qayta ochish' }).click();
  await expect(toast(page)).toContainText('L-1270 qayta ochildi');
  await expect(rows(page)).toContainText('Yangi');
  await expect(page.getByRole('tab', { name: /^Rad etildi/ })).toContainText('0');
});

test('CSV eksport (faqat admin): ustunlar, telefon ko‘rinishi, fon ishi', async ({ page }) => {
  await openLeads(page, '?tab=CONFIRMED');
  await page.getByRole('button', { name: 'CSV eksport' }).click();
  const dialog = page.getByTestId('csv-dialog');
  await expect(dialog).toContainText('Joriy filtrlar: hamma vaqt · hamma holat');
  await expect(dialog.getByRole('checkbox', { name: 'sub1–sub5 va utm' })).not.toBeChecked();
  await expect(dialog.getByRole('radio', { name: /oxirgi 4 raqam/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'CSV yuklab olish' }).click();
  await expect(toast(page)).toContainText('Eksport tayyorlanmoqda');
  await expect(dialog).toHaveCount(0);
});

test('telefon bo‘yicha qidiruv (admin): «Telefon» ustuni, davr — hamma vaqt, audit izohi', async ({ page }) => {
  await openLeads(page, '?period=last7');
  const phone = `+998 90 128 84 ${seeded('L-1284', 10, 99)}`;
  await page.getByLabel('Lidlarni qidirish').fill(phone);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole('columnheader', { name: 'Telefon' })).toBeVisible();
  await expect(page.getByText(`${phone} raqamidan 1 ta lid`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mijoz tarixi' })).toBeVisible();
  await expect(page.getByLabel('Davr:')).toBeDisabled();
  await expect(page.getByText(/Har qidiruv audit jurnaliga yoziladi/)).toBeVisible();
});

test('bo‘sh holatlar: filtr bo‘yicha topilmadi va xato qatori', async ({ page }) => {
  await openLeads(page);
  await page.goto('/admin/leads?status=NO_CONTACT&period=today');
  await expect(page.getByTestId('leads-empty')).toContainText('Bugun kelgan lid hali «Aloqa bo‘lmadi» bo‘la olmaydi');
  await page.getByTestId('leads-empty').getByRole('button', { name: 'Tozalash' }).click();
  await expect(rows(page).first()).toBeVisible();

  await page.route((url) => url.pathname.endsWith('/api/v1/admin/leads'), (route) => route.fulfill({ status: 500, json: { statusCode: 500, message: 'Xato', errorCode: 'INTERNAL_ERROR' } }));
  await page.goto('/admin/leads?tab=CLOSED');
  await expect(page.getByTestId('load-error')).toContainText('Ma’lumotni yuklab bo‘lmadi');
});

test('nazoratchi: o‘qish va o‘tkazish — «Tekshiruvda», CSV, «Manba» va qayta ochish yo‘q', async ({ page }) => {
  await signIn(page, '900000004', /\/supervisor/);
  await page.goto('/supervisor/leads');
  await expect(rows(page).first()).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Nazoratchi lidlarni ko‘radi va boshqa operatorga o‘tkazadi');
  await expect(tab(page, 'Tekshiruvda')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CSV eksport' })).toHaveCount(0);
  await expect(page.getByLabel('Manba:')).toHaveCount(0);
  await expect(page.getByLabel('Lidlarni qidirish')).toHaveAttribute('placeholder', 'Lid, ism yoki sahifa kodi');
  await rows(page).first().getByRole('button', { name: /amallari$/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Qayta ochish' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Boshqa operatorga o‘tkazish' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Lidni ochish' }).click();
  await expect(page).toHaveURL(/\/supervisor\/leads\/L-\d+$/);
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kartalar, «Yana 10 ta lid», amallar varag‘i va tanlash rejimi', async ({ page }) => {
    await openLeads(page);
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByText(/^10 \/ \d+ ta lid ko‘rsatildi$/)).toBeVisible();
    await page.getByRole('button', { name: 'Yana 10 ta lid' }).click();
    await expect(rows(page)).toHaveCount(20);
    await page.getByRole('button', { name: 'Filtrlar' }).click();
    await page.getByRole('dialog').getByLabel('Holat').selectOption({ label: 'Qayta qo‘ng‘iroq' });
    await page.getByRole('dialog').getByRole('button', { name: /ta lidni ko‘rsatish$/ }).click();
    await expect(page.getByRole('button', { name: 'Holat filtrini olib tashlash' })).toBeVisible();
    await page.getByRole('button', { name: 'Lidlar: boshqa amallar' }).click();
    await page.getByRole('menuitem', { name: 'Lidlarni tanlash' }).click();
    await page.getByRole('checkbox', { name: 'L-1279 ni tanlash' }).check();
    await expect(page.getByTestId('lead-selection')).toContainText('1 ta lid tanlandi');
    await page.getByRole('button', { name: 'Boshqa operatorga o‘tkazish' }).click();
    await expect(page.getByTestId('transfer-dialog')).toBeVisible();
  });
});
