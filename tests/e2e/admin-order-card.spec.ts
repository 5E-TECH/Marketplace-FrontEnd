import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-26: buyurtma kartasi (admin-buyurtma-karta). Mock (src/mocks/orderStore.ts): O-1183 Mohira — «Yetkazildi», manzilni
 * operator tuzatgan (Chust → Chortoq), Elchi «Yetkazildi → Yo'lda» rad etilgan; O-1176 — posilka Elchi'da yaratilmagan;
 * O-0964 — webhook kelmagan; O-1276 — yig'ilmoqda; O-1245 — tasdiqlangan, eshikkacha; O-1235 — qadoqlangan.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const now = (page: Page) => page.getByTestId('order-now');
const toast = (page: Page) => page.locator('.ant-notification-notice').last();

async function openCard(page: Page, id: string, query = '') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto(`/admin/orders/${id}${query}`);
  await expect(now(page)).toBeVisible();
}

test('«Yetkazildi»: Hozir bloki, yo‘l, ko‘rsatkichlar, narx nusxasi, pul yozuvlari, rad etilgan o‘tish', async ({ page }) => {
  await openCard(page, 'O-1183');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Buyurtma L-1183');
  await expect(now(page)).toContainText('Mijoz oldi va to‘ladi — Elchi pulni o‘tkazishi kutilmoqda');
  await expect(now(page).getByRole('link', { name: 'L-1183' })).toHaveAttribute('href', '/admin/leads/L-1183');
  await expect(now(page).getByRole('list', { name: 'Buyurtma yo‘li' }).locator('[aria-current="step"]')).toContainText('Yetkazildi');
  await expect(now(page)).toContainText('252 000 so‘m');
  await expect(now(page)).toContainText('Ushlab turilgan');
  await expect(page.getByRole('table', { name: 'To‘rt qator taqsimoti' })).toContainText('55.8%');
  await expect(page.getByRole('table', { name: 'L-1183 pul yozuvlari' }).locator('tbody tr')).toHaveCount(6);
  const history = page.getByRole('region', { name: 'Holat tarixi' });
  await expect(history).toContainText('Yetkazildi → Yo‘lda — rad etildi');
  await expect(history).toContainText('Elchi webhook');
  await expect(page.getByRole('region', { name: 'Elchi hodisalari' })).toContainText('holat orqaga qaytmaydi');
});

test('TC5: operator tuzatgan manzil — kim va qachon; mijoz yozgani; telefon «Ko‘rsatish»', async ({ page }) => {
  await openCard(page, 'O-1183');
  const customer = page.getByRole('region', { name: 'Mijoz va manzil' });
  await expect(customer).toContainText('Namangan viloyati, Chortoq tumani');
  await expect(customer).toContainText(/Operator tuzatdi — Dilnoza R\., \d\d\.\d\d, \d\d:\d\d/);
  await expect(customer).toContainText('Mijoz yozgani: Chust tumani');
  await expect(page.getByRole('region', { name: 'Lid va manba' })).toContainText(/Dilnoza R\. · /);
  await customer.getByRole('button', { name: 'Ko‘rsatish' }).click();
  await expect(customer).toContainText(/\+998 9\d \d{3} \d\d \d\d/);
  await expect(customer.getByRole('link', { name: 'Mijoz tarixi' })).toHaveAttribute('href', /\/admin\/leads\?q=/);
});

test('qaytarish so‘rovi (`?return=1`): sababsiz — maydon xatosi; qayd etilgach «Qaytarish so‘raldi»', async ({ page }) => {
  await openCard(page, 'O-1183', '?return=1');
  const dialog = page.getByTestId('order-return-dialog');
  await expect(dialog).toContainText('L-1183 bo‘yicha qaytarish so‘rovi');
  await dialog.getByRole('button', { name: 'So‘rovni qayd etish' }).click();
  await expect(dialog.getByText('Sababni yozing — u holat tarixiga yoziladi')).toBeVisible();
  await dialog.getByLabel(/Sabab/).fill('Mijoz rangini yoqtirmadi, tovar ochilmagan');
  await dialog.getByRole('button', { name: 'So‘rovni qayd etish' }).click();
  await expect(toast(page)).toContainText('Qaytarish so‘rovi qayd etildi');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/return=1/);
  await expect(now(page)).toContainText('Qaytarish so‘rovi ko‘rib chiqilmoqda');
  await expect(now(page)).toContainText('«Mijoz rangini yoqtirmadi, tovar ochilmagan»');
});

test('nizoli: belgilash — yozuv 1 yil saqlanadi; nizoni yopish', async ({ page }) => {
  await openCard(page, 'O-1183');
  await now(page).getByRole('button', { name: 'Nizoli deb belgilash' }).click();
  const dialog = page.getByTestId('order-dispute-dialog');
  await dialog.getByLabel(/Sabab/).fill('Mijoz: operator yetkazish bepul deb aytgan');
  await dialog.getByRole('button', { name: 'Nizoli deb belgilash' }).click();
  await expect(toast(page)).toContainText('Nizoli deb belgilandi');
  const dispute = page.getByTestId('order-dispute');
  await expect(dispute).toContainText('Qo‘ng‘iroq yozuvi 1 yil saqlanadi');
  await expect(dispute.getByRole('link', { name: 'Yozuvni tinglash' })).toHaveAttribute('href', '/admin/leads/L-1183?listen=1');
  await dispute.getByRole('button', { name: 'Nizoni yopish' }).click();
  await expect(toast(page)).toContainText('Nizo yopildi');
  await expect(dispute).toHaveCount(0);
});

test('posilka Elchi’da yaratilmadi: urinishlar; qayta yuborilgach — posilka yaratildi', async ({ page }) => {
  await openCard(page, 'O-1176');
  await expect(now(page)).toContainText('Posilka Elchi’da hali yaratilmadi — so‘rov navbatda');
  await expect(now(page).getByRole('alert')).toContainText('Elchi API javob bermadi');
  await expect(now(page)).toContainText('3-urinish');
  await now(page).getByRole('button', { name: 'Elchi’ga qayta yuborish' }).click();
  const dialog = page.getByTestId('order-resend-dialog');
  await expect(dialog).toContainText('2 ta · oxirgisi');
  await dialog.getByRole('button', { name: 'Qayta yuborish' }).click();
  await expect(toast(page)).toContainText('Posilka so‘rovi yuborildi');
  await expect(now(page)).toContainText('Elchi’da posilka yaratildi — «Yo‘lda» kutilmoqda');
});

test('webhook kelmagan «Yo‘lda»: ogohlantirish va Elchi’dan holat so‘rash', async ({ page }) => {
  await openCard(page, 'O-0964');
  await expect(now(page)).toContainText(/Elchi’dan \d\d\.\d\d\.\d{4} dan beri yangi holat kelmadi/);
  await expect(now(page)).toContainText('webhook kelmagan');
  await now(page).getByRole('button', { name: 'Elchi’dan holatni so‘rash' }).click();
  await expect(toast(page)).toContainText('Holat so‘raldi');
});

test('manzilni tuzatish (topshirilgunga qadar): izoh majburiy; yetkazish turi va summa o‘zgaradi', async ({ page }) => {
  await openCard(page, 'O-1245');
  await now(page).getByRole('button', { name: 'Manzilni tuzatish' }).click();
  const dialog = page.getByTestId('order-address-dialog');
  await dialog.getByRole('radio', { name: /Markazgacha/ }).click();
  await expect(dialog).toContainText('312 000 → 292 000');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('Izohni yozing — u holat tarixiga yoziladi')).toBeVisible();
  await dialog.getByLabel(/Izoh/).fill('Mijoz punktdan olishini aytdi');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(toast(page)).toContainText('Manzil tuzatildi');
  const customer = page.getByRole('region', { name: 'Mijoz va manzil' });
  await expect(customer).toContainText('Markazgacha');
  await expect(customer).toContainText(/Operator tuzatdi — Nodira K\./);
  await expect(now(page)).toContainText('292 000 so‘m');
});

test('yig‘ilayotgan buyurtmani bekor qilish: omborchi ogohlantirishi, «Bekor qilindi»', async ({ page }) => {
  await openCard(page, 'O-1276');
  await now(page).getByRole('button', { name: 'Bekor qilish' }).click();
  const dialog = page.getByTestId('cancel-order-dialog');
  await expect(dialog).toContainText(/hozir yig‘moqda/);
  await dialog.getByLabel(/Izoh/).fill('Mijoz qayta qo‘ng‘iroqda voz kechdi');
  await dialog.getByRole('button', { name: 'Buyurtmani bekor qilish' }).click();
  await expect(toast(page)).toContainText('L-1276 bekor qilindi');
  await expect(now(page)).toContainText('bekor qildi — band bo‘shadi');
  await expect(now(page)).toContainText('«Mijoz qayta qo‘ng‘iroqda voz kechdi»');
});

test('topilmagan buyurtma', async ({ page }) => {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
  await page.goto('/admin/orders/O-9999');
  await expect(page.getByTestId('order-not-found')).toContainText('O-9999 topilmadi');
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pastki paneldagi asosiy amal va ⋯ varag‘i', async ({ page }) => {
    await openCard(page, 'O-1183');
    await expect(page.getByRole('button', { name: 'Qaytarish so‘rovini qayd etish' })).toBeVisible();
    await page.getByRole('button', { name: 'L-1183 boshqa amallari' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('menuitem', { name: 'Lidni ochish' })).toBeVisible();
    await expect(sheet.getByRole('menuitem', { name: 'Bekor qilish' })).toHaveAttribute('aria-disabled', 'true');
    await sheet.getByRole('menuitem', { name: 'Nizoli deb belgilash' }).click();
    await expect(page.getByTestId('order-dispute-dialog')).toBeVisible();
  });
});
