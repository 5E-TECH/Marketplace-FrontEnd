import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-26: «Buyurtmalar» (admin-buyurtmalar). Mock (src/mocks/orderStore.ts): 22 ta buyurtma — Tasdiqlandi 5 (L-1266 Murod,
 * L-1245, L-1250, L-1240, L-1210), Yig'ilmoqda 1, Qadoqlandi 3 (L-1235 Zarina, L-1222 Madina — T-0231 aktida, L-1209),
 * Yo'lda 2 (L-0964, L-1190), qaytish guruhi 5. Hammasi «Sotuvchi sahifasi» manbasidan.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const rows = (page: Page) => page.getByTestId('order-row');
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Buyurtma holatlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const section = (page: Page, name: string) => page.getByRole('tablist', { name: 'Buyurtmalar bo‘limlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const toast = (page: Page) => page.locator('.ant-notification-notice').last();

async function openOrders(page: Page, query = '') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto(`/admin/orders${query}`);
  await expect(rows(page).first()).toBeVisible();
}

test('bo‘limlar, holat guruhlari, jadval, sahifalash va izoh', async ({ page }) => {
  await openOrders(page);
  await expect(page.getByRole('status').filter({ hasText: 'Har 60 soniyada yangilanadi' })).toBeVisible();
  await expect(section(page, 'Buyurtmalar')).toHaveAttribute('aria-selected', 'true');
  await expect(section(page, 'Buyurtmalar')).toContainText('22');
  await expect(section(page, 'Rad va qaytarishlar')).toContainText('5');
  await expect(tab(page, 'Hammasi')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Tasdiqlandi')).toContainText('5');
  await expect(tab(page, 'Muammoli')).toBeDisabled();
  await expect(page.getByRole('columnheader', { name: 'Holat · o‘zgardi' })).toHaveAttribute('aria-sort', 'descending');
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByText('/ 22 ta buyurtma')).toBeVisible();
  await expect(page.getByText(/Elchi’da va keyingi holatlarni Elchi webhooki va moliya beradi/)).toBeVisible();

  await tab(page, 'Qadoqlandi').click();
  await expect(page).toHaveURL(/status=PACKED/);
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).filter({ hasText: 'L-1222' })).toContainText('T-0231 aktida');
});

test('qidiruv (lid, telefon, trek), filtrlar URL da, bo‘sh qator va bo‘lim sonlari filtrga bog‘liq emas', async ({ page }) => {
  await openOrders(page);
  const search = page.getByLabel('Buyurtmalarni qidirish');
  await search.fill('+998 90 266 66 35');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('L-1266');
  await search.fill('EL118383UZ');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Mohira');
  await search.fill('');
  await expect(rows(page)).toHaveCount(10);

  await page.goto('/admin/orders?source=SITE');
  await expect(page.getByTestId('orders-empty')).toContainText('Bu filtrlar bo‘yicha buyurtma topilmadi');
  await expect(section(page, 'Buyurtmalar')).toContainText('22');
  await page.getByTestId('orders-empty').getByRole('button', { name: 'Filtrlarni tozalash' }).click();
  await expect(rows(page)).toHaveCount(10);
  await expect(page).not.toHaveURL(/source=/);

  await page.goto('/admin/orders?status=HANDED_TO_ELCHI&period=today');
  await expect(page.getByTestId('orders-empty')).toContainText('Bu davrda yaratilgan buyurtmalardan hali birortasi Elchi’ga topshirilmagan');
  await page.getByTestId('orders-empty').getByRole('button', { name: 'Davrni tozalash' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('L-1176');
});

test('TC1: «Yo‘lda» buyurtmani bekor qilib bo‘lmaydi — band yopiq, sababi maslahatda', async ({ page }) => {
  await openOrders(page, '?status=IN_TRANSIT');
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'L-1190 amallari' }).click();
  const cancel = page.getByRole('menuitem', { name: 'Bekor qilish' });
  await expect(cancel).toHaveAttribute('aria-disabled', 'true');
  await cancel.getByText('Bekor qilish').hover();
  await expect(page.getByRole('tooltip')).toContainText('Elchi’ga topshirilgan — bekor qilib bo‘lmaydi');
  await cancel.click({ force: true });
  await expect(page.getByTestId('cancel-order-dialog')).toHaveCount(0);
});

test('TC3 va TC2: sababsiz tugma yopiq; sabab bilan bekor qilinadi — «Bekor qilindi», band bo‘shaydi', async ({ page }) => {
  await openOrders(page, '?status=CONFIRMED');
  await expect(rows(page)).toHaveCount(5);
  await page.getByRole('button', { name: 'L-1266 amallari' }).click();
  await page.getByRole('menuitem', { name: 'Bekor qilish' }).click();
  const dialog = page.getByTestId('cancel-order-dialog');
  await expect(dialog).toContainText('L-1266 ni bekor qilish');
  await expect(dialog).toContainText('Band qilingan 1 dona darhol bo‘shaydi va B-02-1 qoldig‘iga qaytadi');
  await expect(dialog).toContainText('band 1 → 0 · qoldiq +1');
  const submit = dialog.getByRole('button', { name: 'Buyurtmani bekor qilish' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Izoh/).fill('   ');
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Izoh/).fill('Mijoz qayta qo‘ng‘iroqda buyurtmadan voz kechdi');
  await submit.click();
  await expect(toast(page)).toContainText('L-1266 bekor qilindi');
  await expect(toast(page)).toContainText('Band qilingan 1 dona bo‘shadi');
  await expect(dialog).toHaveCount(0);
  await expect(rows(page)).toHaveCount(4);
  await expect(tab(page, 'Bekor qilindi')).toContainText('2');

  await tab(page, 'Bekor qilindi').click();
  const cancelled = rows(page).filter({ hasText: 'L-1266' });
  await expect(cancelled).toContainText('Bekor qilindi');
  await cancelled.getByRole('button', { name: 'L-1266 amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Bekor qilish' })).toHaveAttribute('aria-disabled', 'true');
});

test('tafsilot paneli: holat zanjiri, akt, telefon «Ko‘rsatish», sarlavha havolasi', async ({ page }) => {
  await openOrders(page, '?status=PACKED');
  await rows(page).filter({ hasText: 'L-1222' }).getByText('Madina').click();
  const panel = page.getByTestId('order-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buyurtma L-1222 · Madina' })).toHaveAttribute('href', '/admin/orders/O-1222');
  await expect(panel.getByRole('list', { name: 'Buyurtma holatlari zanjiri' }).locator('[aria-current="step"]')).toContainText('Qadoqlandi');
  await expect(panel).toContainText(/akt T-0231 ochiq · \d+-posilka, \d\d:\d\d/);
  await expect(panel).toContainText('Jami — mijoz to‘laydi');
  await panel.getByRole('button', { name: 'Ko‘rsatish' }).click();
  await expect(panel).toContainText(/\+998 9\d \d{3} \d\d \d\d/);
  await page.getByRole('button', { name: 'Yopish' }).click();
  await expect(panel).toHaveCount(0);
});

test('CSV eksport: joriy filtrlar, standart ustunlar, oxirgi 4 raqam, fon ishi', async ({ page }) => {
  await openOrders(page, '?status=CONFIRMED');
  await page.getByRole('button', { name: 'CSV eksport' }).click();
  const dialog = page.getByTestId('orders-csv-dialog');
  await expect(dialog).toContainText('Buyurtmalarni CSV faylga yuklab olish');
  await expect(dialog).toContainText('Joriy filtrlar: hamma vaqt · Tasdiqlandi — 5 ta buyurtma');
  await expect(dialog.getByRole('checkbox', { name: 'Holat va vaqti' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Narx nusxasi (4 qator)' })).not.toBeChecked();
  await expect(dialog.getByRole('radio', { name: /oxirgi 4 raqam/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'CSV yuklab olish' }).click();
  await expect(toast(page)).toContainText('Eksport tayyorlanmoqda');
  await expect(toast(page)).toContainText('5 ta qator');
  await expect(dialog).toHaveCount(0);
});

test('yorliqni qayta chop etish: sababsiz yopiq, sabab auditga yoziladi, PDF yuklab olinadi', async ({ page }) => {
  await openOrders(page, '?status=PACKED');
  await page.getByRole('button', { name: 'L-1235 amallari' }).click();
  await page.getByRole('menuitem', { name: 'Yorliqni qayta chop etish' }).click();
  const dialog = page.getByTestId('order-label-dialog');
  await expect(dialog).toContainText('L-1235 · Qadoqlandi · topshirish aktiga hali qo‘shilmagan');
  await expect(dialog.getByTestId('print-preview')).toBeVisible();
  const pdf = dialog.getByRole('button', { name: 'PDF yuklab olish' });
  await expect(pdf).toBeDisabled();
  await dialog.getByLabel(/Sabab/).fill('Yorliq qadoqda yirtilgan');
  const download = page.waitForEvent('download');
  await pdf.click();
  expect((await download).suggestedFilename()).toBe('yorliq-L-1235.pdf');
  await expect(toast(page)).toContainText('Yorliq chop etildi');
  await expect(dialog).toContainText(/L-1235 yorlig‘i bugun \d\d:\d\d da chop etilgan \(Nodira K\.\)/);
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kartalar, «Yana 10 ta buyurtma», «Filtrlar» varag‘i va chiplar', async ({ page }) => {
    await openOrders(page);
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByText('10 / 22 ta buyurtma ko‘rsatildi')).toBeVisible();
    await page.getByRole('button', { name: 'Yana 10 ta buyurtma' }).click();
    await expect(rows(page)).toHaveCount(20);
    await page.getByRole('button', { name: 'Filtrlar' }).click();
    await page.getByRole('dialog').getByLabel('Yetkazish').selectOption({ label: 'Eshikkacha' });
    await page.getByRole('dialog').getByRole('button', { name: /ta buyurtmani ko‘rsatish$/ }).click();
    await expect(page.getByRole('button', { name: 'Yetkazish filtrini olib tashlash' })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText('1 / 1 ta buyurtma — hammasi ko‘rsatildi')).toBeVisible();
    await expect(rows(page).getByRole('link')).toHaveAttribute('href', '/admin/orders/O-1245');
    await page.getByRole('button', { name: 'Buyurtmalar: boshqa amallar' }).click();
    await page.getByRole('menuitem', { name: 'CSV eksport' }).click();
    await expect(page.getByTestId('orders-csv-dialog')).toBeVisible();
  });
});
