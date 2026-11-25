import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-26: «Mening buyurtmalarim» (operator-buyurtmalarim; taklif `GET /operator/orders`). Operator — Dilnoza R.
 * (900000003): o'zi tasdiqlagan buyurtmalar; L-1258 — o'zi bekor qilgan, L-1183 — yetkazilgan, L-1245 — eshikkacha.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const rows = (page: Page) => page.getByTestId('order-row');
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Buyurtma holatlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const toast = (page: Page) => page.locator('.ant-notification-notice').last();

async function openOrders(page: Page, query = '') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000003');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/operator/);
  await page.goto(`/operator/orders${query}`);
}

test('o‘z buyurtmalari: guruhlar («Bekor qilindi» Omborda), «Tovar» ustuni, o‘zi bekor qilgani, statistikaga havola', async ({ page }) => {
  await openOrders(page);
  await expect(rows(page).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Siz tasdiqlagan buyurtmalar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sotilish foizi — Statistikam' })).toHaveAttribute('href', '/operator/stats');
  await expect(page.getByText('Omborda · bekor qilish mumkin')).toBeVisible();
  await expect(tab(page, 'Muammoli')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Tovar' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tasdiqlagan' })).toHaveCount(0);
  await expect(rows(page).filter({ hasText: 'L-1258' })).toContainText('siz bekor qildingiz');
  await expect(rows(page).filter({ hasText: 'L-1235' })).toContainText(/tasdiq bugun, \d\d:\d\d/);
  await expect(page.getByText(/Mijoz raqami ko‘rinmaydi: qidiruv buyurtma raqami yoki ism bo‘yicha/)).toBeVisible();
});

test('TC1 (operator): yetkazilgan buyurtma — qulf va sababi, tugma yo‘q', async ({ page }) => {
  await openOrders(page);
  const delivered = rows(page).filter({ hasText: 'L-1183' });
  await expect(delivered).toContainText('Yetkazilgan');
  await expect(delivered).toContainText(': Mijoz olgan — bekor qilib bo‘lmaydi');
  await expect(delivered.getByRole('button', { name: /bekor qilish/i })).toHaveCount(0);
  await delivered.getByText('Yetkazilgan').hover();
  await expect(page.getByRole('tooltip')).toContainText('Mijoz olgan — bekor qilib bo‘lmaydi');
});

test('TC2/TC3 (operator): izohsiz tugma yopiq; bekor qilingach «siz bekor qildingiz»', async ({ page }) => {
  await openOrders(page, '?status=CONFIRMED');
  await expect(tab(page, 'Tasdiqlandi')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'L-1266 ni bekor qilish' }).click();
  const dialog = page.getByTestId('cancel-order-dialog');
  const submit = dialog.getByRole('button', { name: 'Buyurtmani bekor qilish' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Izoh/).fill('Mijoz buyurtmadan voz kechdi: boshqa joydan oldi');
  await submit.click();
  await expect(toast(page)).toContainText('L-1266 bekor qilindi');
  await tab(page, 'Bekor qilindi').click();
  await expect(rows(page).filter({ hasText: 'L-1266' })).toContainText('siz bekor qildingiz');
  await expect(tab(page, 'Bekor qilindi')).toContainText('2');
});

test('raqam bosilsa panel: bekor qilish mumkin, raqam yashirin, to‘lov, «siz tasdiqlagansiz»; pastda bekor qilish', async ({ page }) => {
  await openOrders(page, '?status=PACKED');
  await page.getByRole('button', { name: 'Buyurtma L-1235 tafsiloti' }).click();
  const panel = page.getByTestId('order-panel');
  await expect(panel).toContainText('Bekor qilish mumkin');
  await expect(panel).toContainText('Raqam yashirin');
  await expect(panel).toContainText('tovarni olganda');
  await expect(panel).toContainText('L-1235 · siz tasdiqlagansiz');
  await expect(panel).toContainText(/bugun, \d\d:\d\d · siz/);
  await page.getByRole('button', { name: 'Buyurtmani bekor qilish' }).click();
  await expect(page.getByTestId('cancel-order-dialog')).toContainText('L-1235 ni bekor qilish');
});

test('filtrlar: «Yetkazish: Eshikkacha» — faqat L-1245; qidiruv ism bo‘yicha', async ({ page }) => {
  await openOrders(page, '?where=ADDRESS');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('L-1245');
  await page.goto('/operator/orders');
  await page.getByLabel('Buyurtmalarni qidirish').fill('Mohira');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('L-1183');
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('ish joyi faqat kompyuterda: holat, bronlar, bugun tasdiqlaganlari', async ({ page }) => {
    await openOrders(page);
    const stub = page.getByTestId('operator-phone');
    await expect(stub).toContainText('Ish joyi faqat kompyuterda');
    await expect(stub).toContainText('Bronlarim');
    await expect(stub).toContainText(/Bugun tasdiqlaganingiz\s*\d+ ta buyurtma/);
    await expect(rows(page)).toHaveCount(0);
  });
});
