import { expect, test, type Page } from '@playwright/test';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { installMockApi } from './support/mockApi';
import { pageTitle } from './support/shell';

/**
 * FE-04: sotuvchi ro'yxati (SMS kod, oferta), SMS bilan kirish, bosh sahifa va profil.
 * Backend (BE-05, BE-06) hali yo'q — javoblar `src/mocks` dan (taklif: docs/api-taklif/fe-04-sotuvchi.md).
 * Mock'da SMS kod doim 123456.
 */
const tashkentToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const digits = (text: string | null) => (text ?? '').replace(/\D/g, '');

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function requestRegisterCode(page: Page, phone: string) {
  await page.goto('/register');
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'SMS kodni kiriting' })).toBeVisible();
}

async function enterCode(page: Page, code: string, submit: 'Tasdiqlash' | 'Kirish') {
  await page.getByLabel('SMS kod', { exact: true }).fill(code);
  await page.getByRole('button', { name: submit, exact: true }).click();
}

test('TC1: SMS kod bilan ro‘yxat yakunlandi — oferta qabul qilinadi, bosh sahifada «Birinchi qadamlar»', async ({ page }) => {
  await requestRegisterCode(page, '977771122');
  const steps = page.getByRole('list', { name: 'Ro‘yxat bosqichlari' });
  await expect(steps.locator('[aria-current="step"]')).toContainText('SMS kod');
  await expect(page.getByText('Kod +998 97 777 11 22 raqamiga yuborildi.')).toBeVisible();
  await expect(page.getByRole('timer').first()).toHaveText(/^0[45]:\d{2}$/);
  // Kod «305 918» ko'rinishida yoziladi, SMS dan joylansa ham.
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await expect(page.getByLabel('SMS kod', { exact: true })).toHaveValue('123 456');
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ofertani qabul qiling' })).toBeVisible();
  await expect(steps.locator('[aria-current="step"]')).toContainText('Oferta');
  await expect(steps).toContainText('tasdiqlandi');
  await expect(page.getByText('1.0-versiya', { exact: true })).toBeVisible();

  // To'liq matn: 9 bo'limli mundarija, «Qabul qilaman» belgini qo'yadi.
  await page.getByRole('button', { name: 'To‘liq matn' }).click();
  const offer = page.getByRole('dialog');
  await expect(offer.getByRole('navigation', { name: 'Oferta bo‘limlari' }).getByRole('listitem')).toHaveCount(9);
  await offer.getByRole('button', { name: 'Qabul qilaman' }).click();
  await expect(page.getByRole('checkbox', { name: 'Ofertani o‘qidim va qabul qilaman' })).toBeChecked();

  await page.getByRole('button', { name: 'Rozilik matni' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Roziman' }).click();
  const consent = page.getByRole('checkbox', { name: /Shaxsiy ma’lumotlarim/ });
  await expect(consent).toBeChecked();

  const register = page.waitForRequest('**/api/v1/auth/register/affiliate');
  await page.getByRole('button', { name: 'Ro‘yxatdan o‘tish' }).click();
  expect((await register).postDataJSON()).toMatchObject({ offerVersion: '1.0', consentVersion: '1.0' });

  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(pageTitle(page)).toHaveText('Bosh sahifa');
  await expect(page.getByText('Ro‘yxatdan o‘tdingiz', { exact: true })).toBeVisible();
  await expect(page.getByText(/Sotuvchi ofertasi 1\.0-versiya qabul qilindi: \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}\./)).toBeVisible();
  const onboarding = page.getByRole('region', { name: 'Birinchi qadamlar' });
  await expect(onboarding).toContainText('0 / 5 bajarildi');
  await expect(onboarding).toContainText(/Ro‘yxatdan o‘tdingiz — \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}\./);
  // Ism ro'yxatda so'ralmaydi — yuqori qatorda telefon raqami.
  await expect(page.getByTestId('user-menu-button')).toContainText('+998 97 777 11 22');
});

test('Oferta va rozilik qabul qilinmasa ro‘yxat tugamaydi — tugma yopiq, so‘rov ketmaydi', async ({ page }) => {
  let registerCalls = 0;
  page.on('request', (request) => { if (request.url().endsWith('/auth/register/affiliate')) registerCalls++; });
  await requestRegisterCode(page, '977771123');
  await enterCode(page, MOCK_OTP_CODE, 'Tasdiqlash');

  const submit = page.getByRole('button', { name: 'Ro‘yxatdan o‘tish' });
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Davom etish uchun ofertani va rozilikni qabul qiling.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Ofertani o‘qidim va qabul qilaman' }).check();
  await expect(submit).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Ofertani o‘qidim va qabul qilaman' }).uncheck();
  await page.getByRole('checkbox', { name: /Shaxsiy ma’lumotlarim/ }).check();
  await expect(submit).toBeDisabled();
  await submit.click({ force: true });
  await expect(page).toHaveURL(/\/register$/);
  expect(registerCalls).toBe(0);
});

test('TC2: kod 3 marta xato → «15 daqiqa kuting», tugma vaqt tugaguncha yopiq', async ({ page }) => {
  await requestRegisterCode(page, '977771124');
  await enterCode(page, '111111', 'Tasdiqlash');
  await expect(page.getByText('Kod noto‘g‘ri. Yana 2 ta urinish qoldi, keyin 15 daqiqa kutasiz.')).toBeVisible();
  await expect(page.getByLabel('SMS kod', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await enterCode(page, '222222', 'Tasdiqlash');
  await expect(page.getByText('Kod noto‘g‘ri. Yana 1 ta urinish qoldi, keyin 15 daqiqa kutasiz.')).toBeVisible();
  await enterCode(page, '333333', 'Tasdiqlash');

  await expect(page.getByRole('heading', { level: 1, name: '15 daqiqa kuting' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Kod 3 marta noto‘g‘ri kiritildi');
  const timer = page.getByRole('timer');
  await expect(timer).toHaveText(/^1[45]:\d{2}$/);
  await expect(timer).toHaveAttribute('aria-label', /^1[45] daqiqa \d+ soniya qoldi$/);
  await expect(page.getByText('+998 97 777 11 24')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yangi kod olish' })).toBeDisabled();
  await expect(page.getByText('Vaqt tugagach tugma ochiladi.')).toBeVisible();

  // Blok serverda ham: sahifani yangilab, yangi kod so'ralsa — yana shu holat.
  await page.reload();
  await page.getByLabel('Telefon raqami').fill('977771124');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '15 daqiqa kuting' })).toBeVisible();
});

test('kod muddati o‘tdi (5 daqiqa) → «Yangi kod olish», yangi kod yuborilgach vaqt qaytadan', async ({ page }) => {
  await page.clock.install();
  await requestRegisterCode(page, '977771125');
  await page.clock.fastForward('05:01');

  await expect(page.getByText('Kod muddati o‘tdi. Kod 5 daqiqa amal qiladi — yangisini oling.')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('00:00');
  await expect(page.getByText('Kod kelmadimi?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Yangi kod olish' }).click();

  await expect(page.getByText('Yangi kod yuborildi')).toBeVisible();
  await expect(page.getByText('Oldingi kod endi ishlamaydi. Yangi kod 5 daqiqa amal qiladi.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tasdiqlash', exact: true })).toBeVisible();
});

test('raqam allaqachon ro‘yxatda → «Bu raqam bilan hisob bor», «Kirishga o‘tish» raqamni olib o‘tadi', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Telefon raqami').fill('900000001');
  await page.getByRole('button', { name: 'Kod olish' }).click();

  await expect(page.getByRole('status')).toContainText('Bu raqam bilan hisob bor');
  await expect(page.getByRole('status')).toContainText('+998 90 000 00 01 ro‘yxatdan o‘tgan.');
  await page.getByRole('button', { name: 'Kirishga o‘tish' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('90 000 00 01');
});

test('telefon tekshiruvi: 9 raqam va O‘zbekiston operatori; serverga yuborilmaydi', async ({ page }) => {
  let sends = 0;
  page.on('request', (request) => { if (request.url().endsWith('/auth/otp/send')) sends++; });
  await page.goto('/register');
  const phone = page.getByLabel('Telefon raqami');
  await phone.fill('9012345');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await expect(page.getByText('Raqamni to‘liq kiriting: 9 ta raqam, masalan 90 123 45 67')).toBeVisible();
  await phone.fill('801234567');
  await phone.blur();
  await expect(page.getByText('Bu raqam O‘zbekiston mobil operatoriga tegishli emas')).toBeVisible();
  expect(sends).toBe(0);
});

test('raqamni o‘zgartirish oynasi: yangi raqamga yangi kod', async ({ page }) => {
  await requestRegisterCode(page, '977771126');
  await page.getByRole('button', { name: 'Raqamni o‘zgartirish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Raqamni o‘zgartirish' });
  await expect(dialog).toContainText('+998 97 777 11 26');
  await expect(dialog).toContainText('Bu kod bekor bo‘ladi.');
  await dialog.getByLabel('Yangi raqam').fill('977771127');
  await dialog.getByRole('button', { name: 'Kod olish' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Kod +998 97 777 11 27 raqamiga yuborildi.')).toBeVisible();
  await enterCode(page, MOCK_OTP_CODE, 'Tasdiqlash');
  await expect(page.getByRole('heading', { level: 1, name: 'Ofertani qabul qiling' })).toBeVisible();
});

test('sotuvchi SMS kod bilan kiradi; 3 xato → kirish 15 daqiqaga yopiladi', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('900000001');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await expect(page.getByLabel('Telefon raqami')).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('90 000 00 01');
  await expect(page.getByText('Kod shu raqamga SMS bilan yuborildi.')).toBeVisible();
  await enterCode(page, '000000', 'Kirish');
  await expect(page.getByText('Kod noto‘g‘ri. Yana 2 ta urinish qoldi, keyin kirish 15 daqiqaga yopiladi.')).toBeVisible();

  // «O‘zgartirish» — raqam bosqichiga qaytadi, kod qayta so'raladi; urinishlar hisobi saqlanadi.
  await page.getByRole('button', { name: 'O‘zgartirish' }).click();
  await expect(page.getByLabel('Telefon raqami')).not.toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await enterCode(page, MOCK_OTP_CODE, 'Kirish');

  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(page.getByTestId('user-menu-button')).toContainText('Jasur T.');
});

test('kirish: ro‘yxatda yo‘q raqam va xodim raqami — «hisob topilmadi», ro‘yxatga havola', async ({ page }) => {
  await page.goto('/login');
  for (const phone of ['911112233', '900000003']) {
    await page.getByLabel('Telefon raqami').fill(phone);
    await page.getByRole('button', { name: 'Kod olish' }).click();
    const notice = page.getByRole('status');
    await expect(notice).toContainText('Bu raqam bilan hisob topilmadi');
    await expect(notice).toContainText('Platforma xodimlari «Platforma xodimi» orqali parol bilan kiradi.');
  }
  await page.getByRole('status').getByRole('link', { name: 'Ro‘yxatdan o‘tish' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('SMS kechikmoqda — kod yo‘qolmaydi, «Qayta yuborilmoqda…»', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('900000066');
  await page.route('**/api/v1/auth/otp/send', (route) => route.fulfill({
    json: { statusCode: 200, message: 'OK', data: { expiresIn: 300, delivery: 'DELAYED' } },
  }));
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await expect(page.getByRole('status')).toContainText('SMS kechikmoqda');
  await expect(page.getByText('Qayta yuborilmoqda…')).toBeVisible();
});

test('TC3: bosh sahifa bugungi lid va daromadni statistika API raqamlari bilan bir xil ko‘rsatadi', async ({ page }) => {
  const today = tashkentToday();
  const statsResponse = page.waitForResponse((response) => response.url().includes('/affiliate/stats') && response.url().includes('groupBy=DAY'));
  const streamResponse = page.waitForResponse((response) => response.url().includes('/affiliate/stats') && response.url().includes('groupBy=STREAM'));
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('900000001');
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await enterCode(page, MOCK_OTP_CODE, 'Kirish');
  await expect(page).toHaveURL(/\/affiliate$/);

  type Row = { key: string; clicks: number; leads: number; confirmed: number; delivered: number; incomeHold: number; incomeAvailable: number };
  const body = (await (await statsResponse).json()) as { data: { rows: Row[] } };
  const row = body.data.rows.find((item) => item.key === today);
  expect(row).toBeDefined();
  if (!row) return;
  const kpis = page.getByTestId('today-kpi');
  await expect(kpis).toHaveCount(5);
  await expect(kpis.nth(0)).toHaveText(String(row.clicks));
  await expect(kpis.nth(1)).toHaveText(String(row.leads));
  await expect(kpis.nth(2)).toHaveText(String(row.confirmed));
  await expect(kpis.nth(3)).toHaveText(String(row.delivered));
  expect(digits(await kpis.nth(4).textContent())).toBe(String(row.incomeHold + row.incomeAvailable));

  // «Sahifalaringiz — bugun» jami — shu kunning o'sha raqamlari (FE-06 bilan bir xil manba).
  const streams = (await (await streamResponse).json()) as { data: { rows: Row[]; totals: Row } };
  expect(streams.data.rows.reduce((sum, item) => sum + item.leads, 0)).toBe(row.leads);
  const total = page.getByRole('region', { name: 'Sahifalaringiz — bugun' }).locator('.ant-table-summary');
  await expect(total).toContainText('Jami bugun');
  const cells = total.locator('td');
  await expect(cells.nth(1)).toHaveText(String(row.clicks));
  await expect(cells.nth(2)).toHaveText(String(row.leads));
  expect(digits(await cells.nth(5).textContent())).toBe(String(row.incomeHold + row.incomeAvailable));
});

test('profil: ism kiritiladi, JShShIR tekshiruvga yuboriladi, oferta va roziliklar ko‘rinadi', async ({ page }) => {
  await requestRegisterCode(page, '977771128');
  await enterCode(page, MOCK_OTP_CODE, 'Tasdiqlash');
  await page.getByRole('checkbox', { name: 'Ofertani o‘qidim va qabul qilaman' }).check();
  await page.getByRole('checkbox', { name: /Shaxsiy ma’lumotlarim/ }).check();
  await page.getByRole('button', { name: 'Ro‘yxatdan o‘tish' }).click();
  await expect(page).toHaveURL(/\/affiliate$/);

  await page.getByTestId('user-menu-button').click();
  await page.getByRole('menuitem', { name: 'Profil' }).click();
  await expect(pageTitle(page)).toHaveText('Profil');
  await expect(page.getByText('JShShIR — qilinmagan')).toBeVisible();

  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  const edit = page.getByRole('dialog', { name: 'Shaxsiy ma’lumot' });
  await edit.getByLabel('Ism').fill('Madina');
  await edit.getByLabel('Familiya').fill('Xasanova');
  await edit.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Shaxsiy ma’lumot saqlandi')).toBeVisible();
  await expect(page.getByTestId('user-menu-button')).toContainText('Madina X.');

  await page.getByRole('link', { name: 'JShShIR va soliq maqomi' }).first().click();
  await expect(pageTitle(page)).toHaveText('JShShIR va soliq maqomi');
  await expect(page.getByRole('heading', { name: 'JShShIR hali kiritilmagan' })).toBeVisible();
  await page.getByRole('button', { name: 'JShShIR kiritish' }).click();
  const modal = page.getByRole('dialog', { name: 'JShShIR kiritish' });
  await expect(modal).toContainText('Madina Xasanova');
  await modal.getByLabel(/^JShShIR/).fill('3010119');
  await modal.getByRole('button', { name: 'Tekshiruvga yuborish' }).click();
  await expect(modal.getByText('JShShIR 14 ta raqamdan iborat — 7 ta raqam yetmayapti.')).toBeVisible();
  await modal.getByLabel(/^JShShIR/).fill('30101195600018');
  await modal.locator('input[type=file]').setInputFiles({ name: 'maqom-malumotnoma.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(modal).toContainText('maqom-malumotnoma.pdf');
  await modal.getByRole('button', { name: 'Tekshiruvga yuborish' }).click();

  await expect(page.getByRole('heading', { name: 'Maqomingiz tekshirilmoqda' })).toBeVisible();
  await expect(page.getByText('···· 0018')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tekshiruv bosqichlari' }).getByRole('listitem')).toHaveCount(3);

  await page.getByRole('link', { name: 'Orqaga: Profil' }).click();
  await page.getByRole('link', { name: 'Ochish' }).click();
  await expect(pageTitle(page)).toHaveText('Oferta va roziliklar');
  await expect(page.getByRole('region', { name: 'Roziliklar' }).locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Sotuvchi ofertasi — matnni o‘qish' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Qisqacha — asosiy shartlar');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Qabul qilaman' })).toHaveCount(0);
});

test('ro‘yxat telefonda (360 px): forma, ostida afzalliklar, gorizontal scroll yo‘q', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await requestRegisterCode(page, '977771129');
  await expect(page.getByRole('complementary', { name: 'Siz reklama qilasiz — qolganini platforma bajaradi' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).boundingBox())?.height).toBe(52);
});
