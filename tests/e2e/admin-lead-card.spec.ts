import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-26: lid kartasi (admin-lid-karta). Mock (src/mocks/handlers/leadOrders.ts): L-1284 — Dilnoza R. bronida va
 * suhbatda; L-1270 — bugun rad etilgan; L-1019 — 4 kun oldin rad etilgan; L-1276 — tasdiqlangan, yozuvi bor;
 * L-1267 — dublikat (L-1163); L-1067 — 6 urinishda aloqa bo'lmadi; L-1209 — yozuvsiz qo'ng'iroq.
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

const card = (page: Page) => page.getByTestId('lead-card');
const now = (page: Page) => page.getByTestId('lead-now');
const toast = (page: Page) => page.locator('.ant-notification-notice').last();

async function openCard(page: Page, id: string, base = '/admin/leads') {
  await page.goto(`${base}/${id}`);
  await expect(card(page)).toBeVisible();
}

const admin = (page: Page) => signIn(page, '900000007', /\/admin\//);

test('bronda: «Hozir», lid yo‘li, ko‘rsatkichlar, to‘liq raqam, tarix', async ({ page }) => {
  await admin(page);
  await openCard(page, 'L-1284');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('L-1284');
  await expect(now(page)).toContainText(/Dilnoza R\. qo‘ng‘iroq qilmoqda — natija \d\d:\d\d gacha kiritilishi kerak/);
  const path = page.getByRole('list', { name: 'Lid yo‘li' });
  await expect(path.locator('[aria-current="step"]')).toContainText('1-urinish');
  await expect(path.locator('[aria-current="step"]')).toContainText('yozib olinmoqda');
  await expect(now(page)).toContainText('1 / 6');
  await expect(now(page)).toContainText(/\d\d:\d\d qoldi/);
  await expect(card(page).getByText('to‘liq raqam faqat adminga ko‘rinadi')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Raqamni nusxalash' })).toBeVisible();
  await expect(card(page).getByRole('link', { name: 'Mijoz tarixi' })).toBeVisible();
  await expect(card(page).getByText('Qisman rejim: markazgacha 30 000 so‘m')).toBeVisible();
  await expect(card(page).getByText('Dublikat yo‘q')).toBeVisible();
  await expect(card(page).getByText('L-0736')).toBeVisible();
  await expect(card(page).getByText('Natija kiritilishi kerak')).toBeVisible();
  await expect(card(page).getByText('Buyurtma hali yo‘q')).toBeVisible();
});

test('kartadan o‘tkazish: operator suhbatda — ogohlantirish, ikkala operator broni', async ({ page }) => {
  await admin(page);
  await openCard(page, 'L-1284');
  await now(page).getByRole('button', { name: 'Boshqa operatorga o‘tkazish' }).click();
  const dialog = page.getByTestId('transfer-dialog');
  await expect(dialog).toContainText('L-1284 ni boshqa operatorga o‘tkazish');
  await expect(dialog).toContainText('hozir Dilnoza R. da');
  await expect(dialog.getByRole('note')).toContainText('Dilnoza R. hozir suhbatda');
  await dialog.getByText('Umida S.', { exact: true }).click();
  await expect(dialog).toContainText('bronlar 1/5 → 2/5');
  await expect(dialog).toContainText('bronlar 1/5 → 0/5');
  await dialog.getByRole('button', { name: 'Umida S.ga o‘tkazish' }).click();
  await expect(toast(page)).toContainText('L-1284 o‘tkazildi');
  await expect(now(page)).toContainText('Umida S. da bronda');
  await expect(card(page).getByText('Boshqa operatorga o‘tkazildi')).toBeVisible();
});

test('bronni bo‘shatish (admin): sabab majburiy, lid navbatga qaytadi', async ({ page }) => {
  await admin(page);
  await openCard(page, 'L-1284');
  await now(page).getByRole('button', { name: 'Bronni bo‘shatish' }).click();
  const dialog = page.getByTestId('release-dialog');
  await expect(dialog).toContainText('Dilnoza R. hozir suhbatda — u natija kirita olmaydi.');
  await dialog.getByRole('button', { name: 'Bronni bo‘shatish' }).click();
  await expect(dialog.getByText('Sababni yozing — lid tarixiga yoziladi')).toBeVisible();
  await dialog.getByLabel(/Sabab/).fill('Operator smenasi tugadi, lid kutib qolmasin');
  await dialog.getByRole('button', { name: 'Bronni bo‘shatish' }).click();
  await expect(toast(page)).toContainText('L-1284 navbatga qaytdi');
  await expect(now(page)).toContainText('Navbatda');
  await expect(card(page).getByText('Bron bo‘shatildi')).toBeVisible();
});

test('rad etilgan: 3 kun ichida qayta ochiladi; 3 kundan keyin — yopiq', async ({ page }) => {
  await admin(page);
  await openCard(page, 'L-1019');
  await expect(now(page)).toContainText(/\d kun oldin rad etilgan — qayta ochilmaydi/);
  await expect(now(page).getByRole('button', { name: 'Qayta ochish' })).toBeDisabled();
  await expect(now(page)).toContainText('«Kerak emas»');

  await openCard(page, 'L-1270');
  await expect(now(page)).toContainText('Rad etdi — 3 kun ichida faqat admin qayta ochadi');
  await now(page).getByRole('button', { name: 'Qayta ochish' }).click();
  const dialog = page.getByTestId('reopen-dialog');
  await dialog.getByLabel(/Sabab/).fill('Mijoz o‘ylab ko‘rib, buyurtma berishga rozi bo‘lganini aytdi');
  await dialog.getByRole('button', { name: 'Qayta ochish' }).click();
  await expect(toast(page)).toContainText('L-1270 qayta ochildi');
  await expect(now(page)).toContainText(/Qayta ochilgan · \d\d:\d\d/);
  await expect(card(page).getByText('Qayta ochildi', { exact: true })).toBeVisible();
});

test('yozuv: tinglash va yuklab olish tasdig‘i (admin); ro‘yxatdan «Yozuvni tinglash»', async ({ page }) => {
  await admin(page);
  await openCard(page, 'L-1276');
  await expect(now(page)).toContainText('Buyurtma yaratildi, tovar band qilindi');
  await expect(now(page).getByRole('link', { name: 'Buyurtmani ochish' })).toHaveAttribute('href', '/admin/orders/O-1276');
  await card(page).getByRole('button', { name: '1-urinish yozuvini tinglash' }).click();
  const listen = page.getByTestId('listen-dialog');
  await expect(listen).toContainText('L-1276 · Simsiz quloqchinlar · Tasdiqlandi');
  await expect(listen).toContainText('ofis softfoni · ikki kanal: operator va mijoz');
  await listen.getByRole('button', { name: 'Yuklab olish' }).click();
  const download = page.getByTestId('download-dialog');
  await expect(download).toContainText('Mijoz ovozi — shaxsiy ma’lumot');
  await download.getByRole('button', { name: 'Yuklab olish' }).click();
  await expect(toast(page)).toContainText('Yozuv yuklab olindi');
  await page.keyboard.press('Escape');

  await page.goto('/admin/leads?q=L-1276');
  await page.getByRole('button', { name: 'L-1276 amallari' }).click();
  await page.getByRole('menuitem', { name: 'Yozuvni tinglash' }).click();
  await expect(page).toHaveURL(/\/admin\/leads\/L-1276\?listen=1/);
  await expect(page.getByTestId('listen-dialog')).toBeVisible();
  await page.getByTestId('listen-dialog').getByRole('button', { name: 'Yopish' }).last().click();
  await expect(page).toHaveURL(/\/admin\/leads\/L-1276$/);
});

test('dublikat, aloqa bo‘lmadi va yozuvsiz urinish holatlari', async ({ page }) => {
  await admin(page);
  await openCard(page, 'L-1267');
  await expect(card(page).getByRole('note')).toContainText('Bu lid dublikat — L-1163 ga birlashtirilgan');
  await expect(card(page)).toContainText('Lid birinchi sotuvchiniki bo‘lib qoladi: buyurtma va haq — Sherzod A. ga.');
  await expect(card(page).getByRole('link', { name: 'Asosiy lidni ochish' }).first()).toHaveAttribute('href', '/admin/leads/L-1163');

  await openCard(page, 'L-1067');
  await expect(now(page)).toContainText(/6 urinishda javob bo‘lmadi — lid \d\d\.\d\d da yopildi/);
  await expect(card(page).locator('#lead-attempts tbody tr')).toHaveCount(6);
  await expect(card(page)).toContainText('6 urinish yoki 3 kun — qaysi biri oldin kelsa');

  await openCard(page, 'L-1209');
  await expect(card(page).getByRole('alert')).toContainText('Yozuvsiz qo‘ng‘iroq — hisobotda xato');
  await expect(card(page).getByText('Yozuv topilmadi — hisobotda xato')).toBeVisible();
});

test('nazoratchi: raqam yashirin, bronni bo‘shatish va yuklab olish yo‘q', async ({ page }) => {
  await signIn(page, '900000004', /\/supervisor/);
  await openCard(page, 'L-1284', '/supervisor/leads');
  await expect(card(page).getByText('Raqam yashirin — qo‘ng‘iroq tizim orqali')).toBeVisible();
  await expect(card(page).getByRole('link', { name: 'Mijoz tarixi' })).toHaveCount(0);
  await expect(now(page).getByRole('button', { name: 'Bronni bo‘shatish' })).toHaveCount(0);
  await expect(now(page)).toContainText('Qayta ochish va yozuvni yuklab olish — faqat admin.');
  await expect(now(page).getByRole('button', { name: 'Boshqa operatorga o‘tkazish' })).toBeVisible();
  await openCard(page, 'L-1276', '/supervisor/leads');
  await card(page).getByRole('button', { name: '1-urinish yozuvini tinglash' }).click();
  await expect(page.getByTestId('listen-dialog').getByRole('button', { name: 'Yuklab olish' })).toHaveCount(0);
});

test('topilmagan lid', async ({ page }) => {
  await admin(page);
  await page.goto('/admin/leads/L-9999');
  await expect(page.getByTestId('lead-not-found')).toContainText('L-9999 topilmadi');
  await page.getByRole('link', { name: 'Lidlarga qaytish' }).click();
  await expect(page).toHaveURL(/\/admin\/leads$/);
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('⋯ varag‘i va pastki «Boshqa operatorga o‘tkazish» paneli', async ({ page }) => {
    await admin(page);
    await openCard(page, 'L-1284');
    await page.getByRole('button', { name: 'L-1284 amallari' }).click();
    const sheet = page.getByRole('dialog', { name: 'L-1284 — amallar' });
    await expect(sheet.getByRole('menuitem', { name: 'Qayta ochish' })).toHaveAttribute('aria-disabled', 'true');
    await expect(sheet).toContainText('Faqat «Rad etildi» lidda, 3 kun ichida.');
    await sheet.getByRole('menuitem', { name: 'Bronni bo‘shatish' }).click();
    await expect(page.getByTestId('release-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Boshqa operatorga o‘tkazish' }).last().click();
    await expect(page.getByTestId('transfer-dialog')).toBeVisible();
  });
});
