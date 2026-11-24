import { expect, test, type Page } from '@playwright/test';
import { bookMockLead } from '../../src/mocks/handlers/operator';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-09: operator — mijoz manzilini tasdiqlash, buyurtma formasi va mijozga aytiladigan summa
 * (operator-buyurtma-formasi, operator-lid-kartasi). Mock (src/mocks/handlers/operator.ts): Aziza (L-1284, bron) —
 * Simsiz quloqchinlar 262 000, 0.3 kg, qisman rejim, Farg‘ona — Qo‘qon shahri; holatlar uchun lidlar test oldidan
 * bron qilinadi: Kamron (qoldiq 1, 2 dona), Gulchehra (qora ro‘yxat), Bekzod (changyutgich 5.6 kg, alohida),
 * Sevinch (bepul rejim), Ulug‘bek (og‘irlik yo‘q — summa hisoblanmaydi), Zuhra (Bag‘dod — eshikkacha yo‘q).
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function signInOperator(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000003');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/operator$/);
  const online = page.getByRole('radio', { name: 'Onlayn' });
  await online.click();
  await expect(online).toHaveAttribute('aria-checked', 'true');
}

const card = (page: Page) => page.getByTestId('lead-card');
const form = (page: Page) => page.getByTestId('order-form');
const sum = (page: Page) => page.getByTestId('order-sum');
const confirm = (page: Page) => page.getByTestId('footer-action');
/** Tugma ostidagi sabab — ko'rinib turgani (desktopda to'liq, planshetda qisqa). */
const reason = (page: Page) => page.getByTestId('footer-reason').locator('span:visible');

/** Bron ro'yxatidan lidni ochib, «Buyurtma tasdiqlandi» (Alt+1). */
async function openOrder(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await expect(card(page).getByRole('heading', { level: 2 })).toContainText(name);
  await page.keyboard.press('Alt+1');
  await expect(form(page)).toBeVisible();
}

test('TC1 + mezon: qisman rejim — 262 000 + 30 000 = 292 000 (server summasi)', async ({ page }) => {
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await expect(form(page).getByTestId('order-mode')).toHaveText('qisman rejim');
  await expect(sum(page)).toContainText('Tovar 262 000 so‘m');
  await expect(sum(page)).toContainText('Yetkazish (markazgacha) 30 000 so‘m');
  await expect(sum(page)).toContainText('Jami 292 000 so‘m');
  await expect(form(page)).toContainText('Markazgacha 30 000 so‘m · eshikkacha 50 000 so‘m');
  await expect(form(page).getByTestId('weight-note')).toContainText('Jami og‘irlik 0.3 kg — 3 kg gacha tarif.');
  // Lid kartasi (DZ-12): manzil va yetkazish «formadan», narx rejim bilan.
  await expect(card(page).getByTestId('lead-address')).toContainText('Farg‘ona viloyati, Qo‘qon shahri, Turkiston ko‘chasi, 27-uy (formadan)');
  await expect(card(page).getByTestId('lead-delivery')).toHaveText('Markazgacha (formadan)');
  await expect(card(page)).toContainText('262 000 so‘m + yetkazish 30 000 so‘m (qisman rejim)');
});

test('TC2: eshikkacha — yetkazish 50 000, jami 312 000; «Operator o‘zgartirdi»', async ({ page }) => {
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await expect(form(page).getByTestId('delivery-provenance')).toHaveText('Mijoz tanlagan');
  await form(page).getByRole('radio', { name: 'Eshikkacha' }).click();
  await expect(sum(page)).toContainText('Yetkazish (eshikkacha) 50 000 so‘m');
  await expect(sum(page)).toContainText('Jami 312 000 so‘m');
  await expect(form(page).getByTestId('delivery-provenance')).toHaveText('Operator o‘zgartirdi');
  await expect(form(page)).toContainText('Eshikkacha 50 000 so‘m · markazgacha 30 000 so‘m — Elchi Pochta kuryeri manzilga olib boradi.');
  await expect(form(page)).toContainText('Mijoz formada markazgacha tanlagan. Yangi summani mijozga ayting.');
});

test('TC3: 14 dona = 4.2 kg — yetkazish qayta hisoblandi (30 000 → 38 000)', async ({ page }) => {
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await form(page).getByLabel('Miqdor').fill('14');
  await expect(form(page).getByTestId('weight-changed')).toContainText('Og‘irlik oshdi: 4.2 kg. Yetkazish qayta hisoblandi: 30 000 → 38 000 so‘m (30 000 + 2 × 4 000). Mijozga yangi jamini ayting.');
  await expect(sum(page)).toContainText('Yetkazish (markazgacha, 4.2 kg) 38 000 so‘m');
  await expect(sum(page)).toContainText('Jami 3 706 000 so‘m');
  await expect(form(page)).toContainText('262 000 so‘m × 14');
});

test('og‘ir tovar, alohida rejim: 5.6 kg → 40 000 + 3 × 4 000 = 52 000; 2 dona → 76 000', async ({ page }) => {
  bookMockLead('L-1244');
  await signInOperator(page);
  await openOrder(page, 'Bekzod');
  await expect(form(page).getByTestId('order-mode')).toHaveText('alohida rejim');
  await expect(form(page).getByTestId('weight-note')).toContainText('Jami og‘irlik 5.6 kg — 3 kg dan og‘ir. Yetkazish: 40 000 + 3 × 4 000 = 52 000 so‘m (markazgacha).');
  await form(page).getByRole('button', { name: /Ko‘paytirish/ }).click();
  await expect(form(page).getByTestId('weight-changed')).toContainText('52 000 → 76 000 so‘m (40 000 + 9 × 4 000)');
  await expect(sum(page)).toContainText('Yetkazish (markazgacha, 11.2 kg) 76 000 so‘m');
  await expect(sum(page)).toContainText('Jami 904 000 so‘m');
});

test('TC4: manzil to‘liq emas — «Buyurtmani tasdiqlash» yopiq, sababi tugma ostida', async ({ page }) => {
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await expect(confirm(page)).toBeEnabled();
  await form(page).getByLabel('Ko‘cha, uy').fill('');
  await expect(form(page).getByText('Ko‘cha va uyni kiriting')).toBeVisible();
  await expect(form(page).getByText('Mijoz yozgani: «Turkiston ko‘chasi, 27-uy». Tuzatish lid tarixiga yoziladi.')).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await expect(reason(page)).toHaveText('Manzil kiritilmaguncha «Buyurtmani tasdiqlash» o‘chiq.');
  await form(page).getByLabel('Ko‘cha, uy').fill('Turkiston ko‘chasi, 27-uy');
  // Viloyat almashsa tuman tozalanadi — tuman tanlanmaguncha yopiq.
  await form(page).getByLabel('Viloyat').selectOption({ label: 'Andijon viloyati' });
  await expect(confirm(page)).toBeDisabled();
  await expect(reason(page)).toHaveText('Tuman tanlanmaguncha «Buyurtmani tasdiqlash» o‘chiq.');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('order-done')).toHaveCount(0);
});

test('TC4: server «manzil tasdiqlanmagan» (400) qaytarsa — xabar ko‘rinadi, buyurtma yaratilmaydi', async ({ page }) => {
  await page.route('**/api/v1/operator/leads/*/result', (route) => route.fulfill({
    status: 400,
    json: { statusCode: 400, message: 'Manzil tasdiqlanmagan: avval mijoz manzilini tasdiqlang', errorCode: 'ADDRESS_NOT_CONFIRMED' },
  }));
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await page.keyboard.press('Control+Enter');
  const alert = page.getByTestId('order-alert');
  await expect(alert).toContainText('Manzil tasdiqlanmadi');
  await expect(alert).toContainText('buyurtma yaratilmadi');
  await expect(page.getByTestId('order-done')).toHaveCount(0);
  await expect(card(page).getByText('Bronda').first()).toBeVisible();
});

test('TC5 + mezon: operator tumanni tuzatdi — lid tarixida eski va yangi tuman, kartada «operator tuzatdi»', async ({ page }) => {
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await expect(form(page).getByTestId('address-provenance')).toHaveText('Mijoz yozgan');
  await form(page).getByRole('combobox', { name: 'Tuman / shahar' }).click();
  await page.getByRole('searchbox', { name: 'Tuman qidirish' }).fill('farg‘ona sh');
  await page.keyboard.press('Enter');
  await expect(form(page).getByRole('combobox', { name: 'Tuman / shahar' })).toHaveText('Farg‘ona shahri');
  await expect(form(page).getByTestId('address-provenance')).toHaveText('Operator tuzatdi');
  await expect(form(page).getByText('Mijoz yozgani: «Qo‘qon shahri». Tuzatish lid tarixiga yoziladi.')).toBeVisible();

  await page.keyboard.press('Control+Enter');
  const done = page.getByTestId('order-done');
  await expect(done).toContainText('Buyurtma yaratildi');
  await expect(done).toContainText('Farg‘ona viloyati, Farg‘ona shahri, Turkiston ko‘chasi, 27-uy · markazgacha');
  await expect(done).toContainText('262 000 + 30 000 = 292 000 so‘m');
  await expect(done).toContainText('Simsiz quloqchinlar band qilindi: mavjud 119');
  await expect(card(page).getByTestId('lead-address')).toContainText('Farg‘ona shahri, Turkiston ko‘chasi, 27-uy (operator tuzatdi)');
  const change = card(page).getByTestId('history-address-change');
  await expect(change).toHaveText('Tuman: Qo‘qon shahri → Farg‘ona shahri');
  await expect(card(page)).toContainText('Manzil tuzatildi — Dilnoza R.');
  await expect(card(page)).toContainText(/Buyurtma tasdiqlandi — L-1284 yaratildi/);
  await expect(page.getByTestId('order-done-status')).toContainText('Mijoz bilan xayrlashib, qo‘ng‘iroqni yakunlang.');
});

test('mezon: manzil tasdiqlanmaguncha buyurtma yaratilmaydi — avval manzil (PATCH), keyin natija', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (/\/operator\/leads\/L-1284\/(address|result)$/.test(request.url())) calls.push(`${request.method()} ${request.url().split('/').pop()}`);
  });
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('order-done')).toBeVisible();
  expect(calls).toEqual(['PATCH address', 'POST result']);
});

test('qoldiq: 2 dona so‘ralgan, 1 bor — xato va yopiq; 1 dona — oxirgi dona band bo‘ldi', async ({ page }) => {
  bookMockLead('L-1233');
  await signInOperator(page);
  await openOrder(page, 'Kamron');
  await expect(form(page).getByTestId('order-available')).toHaveText('1');
  await expect(form(page).getByText('Omborda 1 dona bor — miqdorni 1 ga tushiring')).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await expect(reason(page)).toHaveText('Miqdor qoldiqdan ko‘p — tasdiqlash o‘chiq.');
  await form(page).getByRole('button', { name: /Kamaytirish/ }).click();
  await expect(confirm(page)).toBeEnabled();
  await page.keyboard.press('Control+Enter');
  const alert = page.getByTestId('order-alert');
  await expect(alert).toContainText('Tovar band qilinmadi');
  await expect(alert).toContainText('Oxirgi dona shu soniyada boshqa buyurtmaga band bo‘ldi');
  await expect(form(page).getByTestId('order-available')).toHaveText('0');
  await expect(confirm(page)).toBeDisabled();
});

test('qora ro‘yxat — yetkazish puli oldindan; bepul rejim; eshikkacha yo‘q tuman', async ({ page }) => {
  bookMockLead('L-1241');
  bookMockLead('L-1246');
  bookMockLead('L-1249');
  await signInOperator(page);

  await openOrder(page, 'Gulchehra');
  await expect(form(page).getByRole('note')).toContainText('Mijoz qora ro‘yxatda — 2 marta posilkani olmagan');
  await expect(sum(page)).toContainText('Oldindan 30 000 so‘m');
  await expect(reason(page)).toHaveText('Tasdiqlangach buyurtma oldindan to‘lovni kutadi.');
  await page.keyboard.press('Alt+6');
  await page.getByRole('dialog').getByRole('button', { name: /Yaroqsiz deb saqlash/ }).click();

  await openOrder(page, 'Sevinch');
  await expect(form(page).getByTestId('order-mode')).toHaveText('bepul rejim');
  await expect(sum(page)).toContainText('Yetkazish (markazgacha) bepul');
  await expect(sum(page)).toContainText('Jami 294 000 so‘m');
  await page.keyboard.press('Alt+6');
  await page.getByRole('dialog').getByRole('button', { name: /Yaroqsiz deb saqlash/ }).click();

  await openOrder(page, 'Zuhra');
  await expect(form(page).getByRole('radio', { name: 'Eshikkacha' })).toBeDisabled();
  await expect(form(page).getByTestId('no-door')).toHaveText('Elchi Pochta bu tumanda eshikkacha olib bormaydi. Mijoz tuman markazidagi punktdan oladi.');
});

test('summa hisoblanmadi — mijozga summa aytilmaydi, «Qayta hisoblash», tasdiqlash yopiq', async ({ page }) => {
  bookMockLead('L-1248');
  await signInOperator(page);
  await openOrder(page, 'Ulug‘bek');
  const error = page.getByTestId('quote-error');
  await expect(error).toContainText('Summani hisoblab bo‘lmadi');
  await expect(error).toContainText('Narx serverdan kelmadi. Mijozga summa aytmang — qayta urining.');
  await expect(sum(page)).toHaveCount(0);
  await expect(confirm(page)).toBeDisabled();
  await error.getByRole('button', { name: 'Qayta hisoblash' }).click();
  await expect(error).toBeVisible();
});

test('planshet 768: forma to‘liq kenglikda, sabab tugma ostida qisqa', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await signInOperator(page);
  await openOrder(page, 'Aziza');
  await form(page).getByLabel('Ko‘cha, uy').fill('');
  await expect(reason(page)).toHaveText('Manzil kiritilmaguncha o‘chiq');
  const formBox = await form(page).boundingBox();
  expect(formBox?.width ?? 0).toBeGreaterThan(600);
  // Ko'cha va xonadon yonma-yon (R11).
  const street = await form(page).getByLabel('Ko‘cha, uy').boundingBox();
  const apartment = await form(page).getByLabel('Xonadon, mo‘ljal').boundingBox();
  expect(Math.abs((street?.y ?? 0) - (apartment?.y ?? 1))).toBeLessThan(2);
});

test('telefon 390: ish joyi faqat kompyuterda — faol bron eslatmasi, holat va bugungi natija', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000003');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  const phone = page.getByTestId('operator-phone');
  await expect(phone.getByRole('note')).toContainText('Kompyuterda suhbat davom etmoqda');
  await expect(phone.getByRole('note')).toContainText('Aziza · L-1284. Bron');
  await expect(phone.getByTestId('desktop-only')).toContainText('Ish joyi faqat kompyuterda');
  await expect(phone).toContainText('Holat telefondan o‘zgarmaydi.');
  await expect(phone).toContainText('Urinishlar');
  await expect(page.getByTestId('order-form')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
