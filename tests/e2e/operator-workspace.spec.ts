import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-08: operator ish joyi — navbat, lid kartasi, natijalar, rejalashtirilgan qo'ng'iroqlar.
 * Mock navbat (src/mocks/handlers/operator.ts): bron — Aziza (L-1284); navbat tartibi —
 * Sarvar (qayta urinish), Nargiza (oxirgi urinish), Shahnoza (dublikat nomzodi), Madina (API),
 * Jahongir (qoldiq tugagan), keyin yangi lidlar.
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
}

async function goOnline(page: Page) {
  const online = page.getByRole('radio', { name: 'Onlayn' });
  await online.click();
  await expect(online).toHaveAttribute('aria-checked', 'true');
}

const nextButton = (page: Page) => page.getByRole('button', { name: /Keyingi lid/ });
const card = (page: Page) => page.getByTestId('lead-card');
const dialog = (page: Page) => page.getByRole('dialog');
const tile = (page: Page, name: RegExp) => page.getByRole('radiogroup', { name: 'Natija' }).getByRole('radio', { name });
const footerAction = (page: Page) => page.getByTestId('footer-action');

async function takeNext(page: Page, name: string) {
  await nextButton(page).click();
  await expect(card(page).getByRole('heading', { level: 2 })).toContainText(name);
}

/** Lidni «Yaroqsiz» bilan yopib, navbatdagisiga o'tish uchun. */
async function closeAsInvalid(page: Page) {
  await page.keyboard.press('Alt+6');
  await dialog(page).getByRole('button', { name: /Yaroqsiz deb saqlash/ }).click();
  await expect(card(page)).toHaveCount(0);
}

test('TC1 + mezon: «Keyingi lid» → karta 1 soniyada; F2 ham ishlaydi', async ({ page }) => {
  await signInOperator(page);
  await expect(nextButton(page)).toBeDisabled();
  await expect(page.getByTestId('next-reason')).toHaveText('Oflaynsiz — lid berilmaydi');
  await expect(page.getByRole('heading', { name: 'Ish kunini boshlang' })).toBeVisible();
  await goOnline(page);
  await expect(page.getByText(/Navbatda: \d+ ta lid/)).toBeVisible();

  const started = Date.now();
  await nextButton(page).click();
  await expect(card(page).getByRole('heading', { level: 2 })).toHaveText('Sarvar · Toshkent shahri (formadan)');
  expect(Date.now() - started).toBeLessThan(1000);

  await expect(card(page).getByTestId('booking-left')).toHaveText(/Bron: (10:00|09:5\d) qoldi/);
  await expect(page.getByRole('heading', { name: 'Bronlarim (2/5)' })).toBeVisible();
  await expect(page.getByTestId('operator-bookings')).toHaveText('2/5');
  // Qayta urinish: 3-urinish, oldingi ikki javobsiz urinish va qoida matni.
  await expect(card(page)).toContainText('Qayta urinish · 3-urinish');
  await expect(card(page)).toContainText('2 marta javob bermadi');
  await expect(card(page).getByRole('heading', { name: 'Suhbat skripti' })).toBeVisible();
  await expect(card(page).locator('ol').first().locator('li')).toHaveCount(4);

  await closeAsInvalid(page);
  const viaKey = Date.now();
  await page.keyboard.press('F2');
  await expect(card(page).getByRole('heading', { level: 2 })).toContainText('Nargiza');
  expect(Date.now() - viaKey).toBeLessThan(1000);
  await expect(card(page)).toContainText('Oxirgi urinish · 6-urinish');
});

test('mezon: natijasiz lidni yopib bo‘lmaydi — yangi lid ham, boshqa bron ham ochilmaydi', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');

  await page.keyboard.press('F2');
  await expect(page.getByText('Avval ochiq lidga natija kiriting')).toBeVisible();
  await page.getByRole('button', { name: /Aziza/ }).click();
  await expect(card(page).getByRole('heading', { level: 2 })).toContainText('Sarvar');
  // Kartada «yopish» tugmasi yo'q; sahifadan chiqishda brauzer so'raydi.
  await expect(card(page).getByRole('button', { name: /Yopish|Bekor/ })).toHaveCount(0);
  const dialogs: string[] = [];
  page.on('dialog', (event) => { dialogs.push(event.type()); void event.accept(); });
  await page.reload();
  expect(dialogs).toContain('beforeunload');
  // Yangilashdan keyin ham ochiq lid joyida — natija kiritilmaguncha.
  await expect(card(page).getByRole('heading', { level: 2 })).toContainText('Sarvar');
});

test('TC2: rad sababsiz → saqlash yopiq; «Boshqa sabab» izohsiz ham yopiq', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');

  await tile(page, /Aniq rad etdi/).click();
  const save = dialog(page).getByRole('button', { name: /Rad etildi deb saqlash/ });
  await expect(dialog(page)).toContainText('Lid «Rad etildi» holatida yopiladi. Sabab majburiy.');
  await expect(save).toBeDisabled();
  await expect(dialog(page).getByTestId('save-hint')).toHaveText('Sababni tanlang');

  await dialog(page).getByRole('radio', { name: 'Boshqa sabab' }).click();
  await expect(save).toBeDisabled();
  await expect(dialog(page).getByTestId('save-hint')).toHaveText('«Boshqa sabab»da majburiy');
  await dialog(page).getByLabel(/Izoh/).fill('Rangi yoqmadi');
  await expect(save).toBeEnabled();

  await dialog(page).getByRole('radio', { name: 'Qimmat' }).click();
  await save.click();
  await expect(page.getByText('Natija saqlandi')).toBeVisible();
  await expect(page.getByText('L-1275 · Sarvar → «Rad etildi».')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Faol lid yo‘q' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bronlarim (1/5)' })).toBeVisible();
});

test('TC3: «Keyinroq qiling» → sana va vaqt majburiy; saqlangach «Rejalashtirilgan»da', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');

  await page.keyboard.press('Alt+3');
  const save = dialog(page).getByRole('button', { name: /Rejalashtirish/ });
  await expect(save).toBeDisabled();
  await expect(dialog(page).getByTestId('save-hint')).toHaveText('Sana va vaqt majburiy');
  await dialog(page).getByRole('radio', { name: 'Ertaga' }).click();
  await expect(save).toBeDisabled();
  await expect(dialog(page).getByTestId('save-hint')).toHaveText('Sana va vaqt majburiy');
  await save.click({ force: true });
  await expect(dialog(page).getByText('Vaqtni kiriting')).toBeVisible();
  await dialog(page).getByLabel(/^Vaqt/).fill('22:00');
  await expect(dialog(page).getByText('22:00 — qo‘ng‘iroq vaqtidan tashqarida')).toBeVisible();
  await dialog(page).getByLabel(/^Vaqt/).fill('11:00');
  await expect(dialog(page).getByTestId('callback-summary')).toContainText(/\d{2}\.\d{2}\.\d{4}, [a-z‘]+ · 11:00/);
  await expect(dialog(page).getByTestId('callback-summary')).toContainText('Eslatma 10:55 da keladi. 11:15 gacha');
  await dialog(page).getByLabel(/Izoh/).fill('Ertalab, ishga ketmasdan oldin');
  await page.keyboard.press('Control+Enter');

  await expect(page.getByText(/L-1275 · Sarvar → «Qayta qo‘ng‘iroq», \d{2}\.\d{2}\.\d{4}, 11:00/)).toBeVisible();
  await expect(card(page)).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Asosiy menyu' }).getByRole('link', { name: 'Rejalashtirilgan qo‘ng‘iroqlar' }).click();
  const row = page.getByRole('row', { name: /Sarvar/ });
  await expect(row).toContainText('11:00');
  await expect(row).toContainText('Keyinroq qiling');
  await expect(row).toContainText('«Ertalab, ishga ketmasdan oldin»');
});

test('«O‘ylab ko‘radi» — vaqtsiz ham saqlanadi (ertasi kuni)', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');
  await page.keyboard.press('Alt+4');
  await expect(dialog(page).getByText(/Vaqt tanlanmasa — ertasi kuni qo‘ng‘iroq qilinadi\./)).toBeVisible();
  await dialog(page).getByRole('button', { name: /Rejalashtirish/ }).click();
  await expect(page.getByText(/L-1275 · Sarvar → «Qayta qo‘ng‘iroq», \d{2}\.\d{2}\.\d{4}, 10:00/)).toBeVisible();
});

test('TC4: tanaffus → bronlar navbatga qaytadi, yangi lid berilmaydi (server ham rad etadi)', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await expect(page.getByRole('heading', { name: 'Bronlarim (1/5)' })).toBeVisible();

  await page.getByRole('radio', { name: 'Tanaffus' }).click();
  await expect(dialog(page)).toContainText('Tanaffusga chiqasizmi?');
  await expect(dialog(page)).toContainText('1 ta bron navbatga qaytadi');
  await expect(dialog(page)).toContainText('Aziza · L-1284');
  await dialog(page).getByRole('button', { name: 'Tanaffusga chiqish' }).click();

  await expect(page.getByRole('radio', { name: 'Tanaffus' })).toHaveAttribute('aria-checked', 'true');
  await expect(nextButton(page)).toBeDisabled();
  await expect(page.getByTestId('next-reason')).toHaveText('Tanaffusdasiz — yangi lid berilmaydi');
  await expect(page.getByRole('heading', { name: /Tanaffusdasiz/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bronlarim (0/5)' })).toBeVisible();

  const status = await page.evaluate(async () => {
    const response = await fetch('/api/v1/operator/leads/next', { method: 'POST', credentials: 'include' });
    return { status: response.status, body: (await response.json()) as { errorCode?: string } };
  });
  expect(status.status).toBe(409);
  expect(status.body.errorCode).toBe('OPERATOR_ON_BREAK');

  await page.getByRole('button', { name: 'Ishga qaytish' }).click();
  await expect(page.getByRole('radio', { name: 'Onlayn' })).toHaveAttribute('aria-checked', 'true');
  await expect(nextButton(page)).toBeEnabled();
  // Navbatga qaytgan Aziza endi navbat boshida — birinchi bo'lib beriladi.
  await takeNext(page, 'Aziza');
});

test('TC5: sotuvchi sahifasidan kelgan lid — viloyat, tuman, ko‘cha/uy «formadan» belgisi bilan', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');
  const address = card(page).getByTestId('lead-address');
  await expect(address).toContainText('Toshkent shahri, Yunusobod tumani, 19-mavze, 4-uy, 27-xonadon');
  await expect(address).toContainText('formadan');
  await expect(card(page)).toContainText('sotuvchi sahifasi · ariza');
});

test('TC6: lid kartasida S1/S3 (variant) belgisi yo‘q', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  for (const name of ['Sarvar', 'Nargiza', 'Shahnoza']) {
    await takeNext(page, name);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\bS[13]\b|variant/i);
    await closeAsInvalid(page);
  }
});

test('javobsiz qo‘ng‘iroq: operator «Band» ni tanlaydi, keyingi urinish jadval bo‘yicha', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');
  await tile(page, /Javob bermadi \/ Band \/ O‘chiq/).click();
  const panel = page.getByTestId('next-attempt');
  await expect(panel).toContainText('Urinish 3 / 6');
  await expect(panel.getByRole('heading', { name: 'Keyingi urinish — avtomatik' })).toBeVisible();
  // Boshqa natijalar yopiq; plitkada tanlangan javobsiz natija.
  await expect(tile(page, /Aniq rad etdi/)).toBeDisabled();
  await panel.getByRole('radio', { name: 'Band' }).click();
  await expect(tile(page, /Javob bermadi \/ Band/)).toContainText('tanlandi: Band');
  await expect(footerAction(page)).toHaveText(/Natijani tasdiqlash/);
  await footerAction(page).click();
  await expect(page.getByText(/L-1275 · Sarvar → keyingi urinish \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}\./)).toBeVisible();

  // Nargiza: 6-urinish — javobsiz bo'lsa lid «Aloqa bo'lmadi» bilan yopiladi.
  await takeNext(page, 'Nargiza');
  await page.keyboard.press('Alt+2');
  await expect(page.getByTestId('next-attempt')).toContainText('Oxirgi urinish');
  await expect(page.getByTestId('next-attempt')).toContainText('Keyingi urinish yo‘q.');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Lid yopildi')).toBeVisible();
  await expect(page.getByText('L-1138 · Nargiza → «Aloqa bo‘lmadi».', { exact: false })).toBeVisible();
});

test('dublikat: avvalgi lid topilsa bog‘lanadi; topilmasa saqlash yopiq', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');
  await page.keyboard.press('Alt+7');
  await expect(dialog(page)).toContainText('Shu mahsulot bo‘yicha avvalgi lid yo‘q');
  await expect(dialog(page).getByRole('button', { name: /Dublikat deb bog‘lash/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await closeAsInvalid(page);
  await takeNext(page, 'Nargiza');
  await closeAsInvalid(page);

  await takeNext(page, 'Shahnoza');
  await expect(card(page)).toContainText('Mijozning oldingi lid va buyurtmalari');
  await page.keyboard.press('Alt+7');
  await expect(dialog(page).getByTestId('duplicate-candidate')).toContainText('L-1203');
  await expect(dialog(page)).toContainText('L-1287 → L-1203');
  await dialog(page).getByRole('button', { name: /Dublikat deb bog‘lash/ }).click();
  await expect(page.getByText('L-1287 · Shahnoza → «Dublikat».')).toBeVisible();
});

test('buyurtma tasdiqlandi: manzil mijoz yozganidek tasdiqlanadi, summa — serverdan', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');
  const sum = page.getByTestId('order-sum');
  await expect(sum).toContainText('Jami 275 000 so‘m');
  await expect(footerAction(page)).toBeDisabled();
  await tile(page, /Buyurtma tasdiqlandi/).click();
  const order = page.getByTestId('order-form');
  await expect(order.getByLabel('Viloyat')).toHaveValue('1726');
  await expect(order.getByLabel('Tuman / shahar')).toContainText('Yunusobod tumani');
  // Miqdor va yetkazish — summa serverdan qayta hisoblanadi.
  await order.getByRole('button', { name: 'Ko‘paytirish' }).click();
  await expect(sum).toContainText('Jami 520 000 so‘m');
  await order.getByRole('radio', { name: 'Eshikkacha' }).click();
  await expect(sum).toContainText('Jami 540 000 so‘m');
  await expect(order.getByLabel('Ko‘cha, uy')).toHaveValue('19-mavze, 4-uy, 27-xonadon');
  await order.getByLabel(/Izoh/).fill('Markazdan o‘zi olib ketadi');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('L-1275 · Sarvar → buyurtma yaratildi.')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test('qoldiq tugagan va API lidi: «Buyurtma tasdiqlandi» yopiq, sababi ko‘rinadi', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  for (const name of ['Sarvar', 'Nargiza', 'Shahnoza']) {
    await takeNext(page, name);
    await closeAsInvalid(page);
  }
  await takeNext(page, 'Madina');
  await expect(card(page).getByRole('heading', { level: 2 })).toHaveText('Madina (API orqali)');
  await expect(card(page)).toContainText('Sotuvchining o‘z saytidan keldi');
  await expect(tile(page, /Buyurtma tasdiqlandi/)).toBeDisabled();
  await expect(tile(page, /Buyurtma tasdiqlandi/)).toContainText('manzil yo‘q');
  await closeAsInvalid(page);

  await takeNext(page, 'Jahongir');
  await expect(card(page).getByRole('alert')).toContainText('tugadi — buyurtmani tasdiqlab bo‘lmaydi');
  await expect(tile(page, /Buyurtma tasdiqlandi/)).toBeDisabled();
  await expect(tile(page, /Buyurtma tasdiqlandi/)).toContainText('qoldiq yo‘q');
  await expect(page.getByText('Buyurtma formasi yopiq')).toBeVisible();
});

test('mahsulot ma’lumoti paneli va tezkor tugmalar oynasi', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  await takeNext(page, 'Sarvar');
  await card(page).getByRole('button', { name: 'Mahsulot ma’lumoti', exact: true }).click();
  const drawer = page.locator('.ant-drawer');
  await expect(drawer).toContainText('Mavjud 120 dona — buyurtma tasdiqlash mumkin.');
  await expect(drawer).toContainText('Va’da bermang');
  await drawer.getByRole('button', { name: 'Yopish' }).last().click();
  // Panel ochiq paytida ham natija tanlash mumkin edi — panel modal emas.
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Tezkor tugmalar va qoidalar' });
  await expect(help).toContainText('Keyingi lid');
  await expect(help).toContainText('bir vaqtda ko‘pi bilan 5 ta yangi lid');
});

test('bron 5/5 — «Keyingi lid» yopiq, eng kam vaqti qolganini ochish taklif qilinadi', async ({ page }) => {
  await signInOperator(page);
  await goOnline(page);
  // Sahifa yangilangandan keyin hech biri ochiq emas: bronlarni API orqali yig'amiz.
  for (let index = 0; index < 4; index += 1) {
    await page.evaluate(() => fetch('/api/v1/operator/leads/next', { method: 'POST', credentials: 'include' }));
  }
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bronlarim (5/5)' })).toBeVisible();
  await expect(nextButton(page)).toBeDisabled();
  await expect(page.getByTestId('next-reason')).toHaveText('Bronlar 5/5 — yangi lid olish uchun bittasiga natija kiriting');
  await expect(page.getByRole('heading', { name: '5 ta bron sizni kutmoqda' })).toBeVisible();
  await page.getByRole('button', { name: /L-1284 · Aziza ni ochish/ }).click();
  await expect(card(page).getByRole('heading', { level: 2 })).toContainText('Aziza');
});

test('rejalashtirilgan qo‘ng‘iroqlar: keyingi qo‘ng‘iroq, kunlar bo‘yicha ro‘yxat va 5 daqiqa oldin eslatma', async ({ page }) => {
  const soon = new Date(Date.now() + 3 * 60_000).toISOString();
  await signInOperator(page);
  const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const scheduled = [
    { id: 'L-1219', customerName: 'Bobur', productName: 'Elektr choynak', callbackAt: soon, reminderDue: true, lastOutcome: 'THINKING', lastComment: 'Turmush o‘rtog‘i bilan maslahatlashadi' },
    { id: 'L-1255', customerName: 'Muxlisa', productName: 'Oshxona tarozisi', callbackAt: later(40), reminderDue: false, lastOutcome: 'THINKING', lastComment: 'Turmush o‘rtog‘i bilan maslahatlashadi' },
    { id: 'L-1253', customerName: 'Hilola', productName: 'Elektr choynak', callbackAt: later(26 * 60), reminderDue: false, lastOutcome: 'CALL_LATER', lastComment: 'Hozir ishda' },
  ].map((lead) => ({ ...lead, status: 'CALLBACK', bookedUntil: null, lastAttemptAt: new Date().toISOString() }));
  await page.route('**/api/v1/operator/leads', (route) => route.fulfill({ json: { statusCode: 200, message: 'OK', data: scheduled } }));
  await page.goto('/operator/callbacks');

  await expect(page.getByTestId('next-callback')).toContainText('Bobur · L-1219');
  await expect(page.getByTestId('next-callback')).toContainText('O‘ylab ko‘radi');
  await expect(page.getByText(/da qo‘ng‘iroq — Bobur/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Oldinda 3 ta qo‘ng‘iroq/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Muxlisa/ })).toContainText('«Turmush o‘rtog‘i bilan maslahatlashadi»');
  await expect(page.getByRole('row', { name: /Hilola/ })).toContainText('«Hozir ishda»');

  await page.getByRole('button', { name: 'Ish joyiga o‘tish' }).first().click();
  await expect(page).toHaveURL(/\/operator$/);
});
