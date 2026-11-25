import { expect, test, type Page } from '@playwright/test';
import { orderStore } from '../../src/mocks/orderStore';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-26: nazoratchi buyurtmalari (nazoratchi-buyurtmalar). Mock: mijoz so'rovlari — R-31 L-1250 bekor qilish, R-32 L-1240
 * manzil (Urganch → Xonqa), R-29 L-1176 bekor qilish (posilka Elchi'ga topshirilgan — kech qolgan). Nazoratchi — Rustam Q.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const rows = (page: Page) => page.getByTestId('order-row');
const requests = (page: Page) => page.getByTestId('customer-request');
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Buyurtma holatlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const toast = (page: Page) => page.locator('.ant-notification-notice').last();

async function openOrders(page: Page, query = '') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000004');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/supervisor/);
  await page.goto(`/supervisor/orders${query}`);
  await expect(rows(page).first()).toBeVisible();
}

test('mijoz so‘rovlari, «Omborda — bekor qilish mumkin», «Bekor qilish» ustuni; CSV va bo‘limlar yo‘q', async ({ page }) => {
  await openOrders(page);
  await expect(requests(page)).toHaveCount(3);
  await expect(requests(page).nth(0)).toContainText('Bekor qilishni so‘radi');
  await expect(requests(page).nth(0)).toContainText('Mijoz izohi: «Boshqa joydan oldim»');
  await expect(requests(page).nth(1)).toContainText('Manzilni o‘zgartirishni so‘radi');
  await expect(requests(page).nth(1)).toContainText('Xonqa tumani');
  await expect(requests(page).nth(2)).toContainText('Elchi’ga topshirilgan — bekor qilib bo‘lmaydi');
  await expect(page.getByText('Omborda — bekor qilish mumkin')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tasdiqlagan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSV eksport' })).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Buyurtmalar bo‘limlari' })).toHaveCount(0);
  await expect(page.getByText(/Mijoz telefoni ko‘rinmaydi; CSV eksport — faqat adminda/)).toBeVisible();
});

test('TC1 (nazoratchi): «Yo‘lda» — bekor qilish mumkin emas, sababi ustunda', async ({ page }) => {
  await openOrders(page, '?status=IN_TRANSIT');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('mumkin emas');
  await expect(rows(page).first()).toContainText('Elchi’ga topshirilgan');
  await expect(rows(page).first().getByRole('button', { name: /^Bekor qilish/ })).toHaveCount(0);
});

test('TC2/TC3 (nazoratchi): so‘rov bo‘yicha bekor qilish — izohsiz yopiq; bajarilgach «Bajarildi»', async ({ page }) => {
  await openOrders(page);
  await requests(page).nth(0).getByRole('button', { name: 'Bekor qilish: L-1250' }).click();
  const dialog = page.getByTestId('cancel-order-dialog');
  await expect(dialog).toContainText('Mijoz so‘rovi');
  await expect(dialog).toContainText('«Bajarildi» deb yopiladi');
  const submit = dialog.getByRole('button', { name: 'Buyurtmani bekor qilish' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Izoh/).fill('Mijoz saytdan so‘radi: boshqa joydan olgan');
  await submit.click();
  await expect(toast(page)).toContainText('L-1250 bekor qilindi');
  await expect(toast(page)).toContainText('Mijoz so‘rovi «Bajarildi» deb yopildi');
  await expect(requests(page).nth(2)).toContainText(/Bajarildi · \d\d:\d\d · Rustam Q\./);
  await expect(tab(page, 'Bekor qilindi')).toContainText('2');
});

test('so‘rov bo‘yicha manzilni o‘zgartirish: tuman va izoh oldindan to‘ldirilgan', async ({ page }) => {
  await openOrders(page);
  await requests(page).nth(1).getByRole('button', { name: 'Manzilni o‘zgartirish' }).click();
  const dialog = page.getByTestId('order-address-dialog');
  await expect(dialog.getByLabel('Tuman yoki shahar')).toHaveValue('1733230');
  await expect(dialog.getByLabel(/Izoh/)).toHaveValue(/Mijoz so‘rovi bo‘yicha \(saytdan, \d\d:\d\d\)/);
  await expect(dialog).toContainText('hali chop etilmagan — yangi manzil bilan chiqadi');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(toast(page)).toContainText('L-1240 manzili o‘zgardi');
  await expect(requests(page).filter({ hasText: 'L-1240' })).toContainText(/Bajarildi · /);
});

test('kech qolgan so‘rovni yopish: izoh majburiy; «Yopilgan so‘rovlar» da javob bilan', async ({ page }) => {
  await openOrders(page);
  await requests(page).nth(2).getByRole('button', { name: 'So‘rovni yopish' }).click();
  const dialog = page.getByTestId('close-request-dialog');
  await expect(dialog).toContainText('Bekor qilib bo‘lmaydi');
  await dialog.getByRole('button', { name: 'So‘rovni yopish' }).click();
  await expect(dialog.getByText('Mijozga nima deyilganini yozing')).toBeVisible();
  await dialog.getByLabel(/Mijozga nima deyildi/).fill('Qo‘ng‘iroq qilindi: posilka yo‘lda, bekor qilib bo‘lmasligi tushuntirildi');
  await dialog.getByRole('button', { name: 'So‘rovni yopish' }).click();
  await expect(toast(page)).toContainText('So‘rov yopildi');
  await expect(requests(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Yopilgan so‘rovlar' }).click();
  await expect(requests(page).first()).toContainText(/Yopildi · \d\d:\d\d · Rustam Q\./);
  await expect(requests(page).first()).toContainText('Mijozga aytildi: «Qo‘ng‘iroq qilindi');
});

test('409: oyna ochiq turganda posilka topshirildi — «bekor qilib bo‘lmadi», hozirgi va oldingi holat', async ({ page }) => {
  await openOrders(page, '?status=PACKED');
  await rows(page).filter({ hasText: 'L-1222' }).getByRole('button', { name: 'Bekor qilish: L-1222' }).click();
  const dialog = page.getByTestId('cancel-order-dialog');
  await dialog.getByLabel(/Izoh/).fill('Mijoz voz kechdi');
  const order = orderStore().orders.get('O-1222');
  if (!order) throw new Error('O-1222 mock buyurtmasi yo‘q');
  order.status = 'HANDED_TO_ELCHI';
  order.statusAt = new Date().toISOString();
  await dialog.getByRole('button', { name: 'Buyurtmani bekor qilish' }).click();
  await expect(dialog).toContainText('L-1222 ni bekor qilib bo‘lmadi');
  await expect(dialog).toContainText('Holat siz oynani ochganingizdan keyin o‘zgardi');
  await expect(dialog.getByText('Elchi’ga topshirildi')).toBeVisible();
  await expect(dialog.getByText('Qadoqlandi')).toBeVisible();
  await expect(toast(page)).toContainText('L-1222 bekor qilinmadi');
});

test('qator bosilganda panel: so‘rov belgisi va izohi, zanjir izohlari, pastda bekor qilish va manzil', async ({ page }) => {
  await openOrders(page, '?status=CONFIRMED');
  await rows(page).filter({ hasText: 'L-1240' }).getByText('Dilfuza').click();
  const panel = page.getByTestId('order-panel');
  await expect(page.getByText('So‘rov: manzil')).toBeVisible();
  await expect(panel).toContainText('Mijoz manzilni o‘zgartirishni so‘radi');
  await expect(panel).toContainText('shu paytgacha bekor qilish mumkin');
  await expect(panel).toContainText('keyin: Pul o‘tkazildi → Yopildi');
  await expect(panel).toContainText('B-02-1 · 1 dona band');
  await expect(panel.getByRole('link', { name: 'Yozuvni tinglash' })).toHaveAttribute('href', '/supervisor/leads/L-1240?listen=1');
  await page.getByRole('button', { name: 'Manzilni o‘zgartirish' }).last().click();
  await expect(page.getByTestId('order-address-dialog')).toBeVisible();
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('so‘rovlar ustma-ust, buyurtma kartasi pastki panelda bekor qilish va manzil', async ({ page }) => {
    await openOrders(page);
    await expect(requests(page).first().getByRole('link', { name: 'L-1250, Nodir — buyurtmani ochish' })).toBeVisible();
    await requests(page).first().getByRole('link', { name: 'L-1250, Nodir — buyurtmani ochish' }).click();
    await expect(page).toHaveURL(/\/supervisor\/orders\/O-1250$/);
    await expect(page.getByTestId('order-now')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bekor qilish' }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Manzilni o‘zgartirish' }).last().click();
    await expect(page.getByTestId('order-address-dialog')).toBeVisible();
  });
});
