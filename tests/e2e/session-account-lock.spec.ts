import { expect, test, type Browser, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { freshTwoFactorAccount, MOCK_TOTP_SECRET } from '../../src/mocks/fixtures/twoFactor';
import { findMockUserById, revokeMockSessions } from '../../src/mocks/fixtures/users';
import { MOCK_OTP_CODE } from '../../src/mocks/handlers/sellerAuth';
import { currentTotp, totpAt, totpCounter, verifyTotp } from '../../src/mocks/totp';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-15 8-qism (umumiy-sessiya 3, 6–9, 12, 14–15; umumiy-kirish 12): hisob bloklangan yoki nofaol bo'lsa — keyingi
 * so'rovda sahifa ustida «Hisobingiz bloklandi», «Batafsil» — karkassiz sahifa; roli o'zgargan odam qayta kirsa —
 * «Rolingiz o‘zgardi»; admin «Sessiya tugadi» oynasida parol, keyin ilovadagi kod. Tafsilot — taklif §15 (mock).
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const DATE_TIME = /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/;

async function signInStaff(page: Page, phone: string) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
}

async function signInSeller(page: Page, phone: string) {
  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByRole('button', { name: 'Kod olish' }).click();
  await page.getByLabel('SMS kod', { exact: true }).fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
}

/** Ikkinchi brauzer — admin (o'sha mock baza). */
async function adminPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installMockApi(context, { reset: false });
  const page = await context.newPage();
  await signInStaff(page, '900000007');
  await expect(page).toHaveURL(/\/admin/);
  return page;
}

/** Admin bloklagandek (handler bilan bir xil): blok, `authVersion`+1, sessiyalar bekor. */
function blockAccount(id: string, reason: string) {
  const account = findMockUserById(id);
  if (!account) throw new Error(`${id} yo‘q`);
  account.isBlocked = true;
  account.authVersion += 1;
  revokeMockSessions(account);
  const block = { at: new Date().toISOString(), by: 'Nodira Karimova', reason };
  if (account.staff) account.staff.block = block;
  if (account.seller) account.seller.block = block;
}

/** Sahifa ochiq turganda keyingi so'rov: menyu bandi (oyna allaqachon chiqqan bo'lsa — bosilmaydi). */
async function nextRequest(page: Page, link: string) {
  await page.getByRole('navigation', { name: 'Asosiy menyu' }).getByRole('link', { name: link }).click({ timeout: 3_000 }).catch(() => undefined);
}

test('TC2: admin sotuvchini bloklaydi → keyingi so‘rovda «Hisobingiz bloklandi»; «Batafsil» — sabab, pul, murojaat; «Chiqish»', async ({ page, browser }) => {
  await signInSeller(page, '930000105');
  await expect(page).toHaveURL(/\/affiliate$/);

  const admin = await adminPage(browser);
  await admin.goto('/admin/users?tab=affiliates');
  await admin.getByRole('button', { name: 'Bekzod M. amallari' }).click();
  await admin.getByRole('menuitem', { name: 'Bloklash' }).click();
  await admin.getByTestId('staff-block-dialog').getByLabel('Sabab').fill('Aldovli reklama');
  await admin.getByTestId('staff-block-dialog').getByRole('button', { name: 'Bloklash' }).click();
  await expect(admin.getByText('Bekzod M. bloklandi')).toBeVisible();
  await admin.context().close();

  await nextRequest(page, 'Statistika');
  const dialog = page.getByTestId('account-lock-dialog');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('session-expired')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Hisobingiz bloklandi' })).toBeVisible();
  await expect(dialog).toContainText(new RegExp(`${DATE_TIME.source} · admin qarori`));
  await expect(dialog.locator('dl')).toContainText('SababAldovli reklama');
  await expect(dialog.locator('dl')).toContainText('Sahifalaringizyangi ariza qabul qilmaydi');
  await expect(dialog.locator('dl')).toContainText('Ushlab turilgan haqbekor qilindi · 0 so‘m');
  await expect(dialog).toContainText('Asos — oferta. Qaror sababi va dalili bilan jurnalga yozilgan.');
  // Majburiy: × yo'q, Escape yopmaydi.
  await expect(dialog.getByRole('button', { name: /Yopish|Close/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Batafsil' }).click();
  await expect(page).toHaveURL(/\/account-blocked$/);
  const card = page.getByTestId('account-lock-page');
  await expect(card.getByRole('heading', { level: 1, name: 'Hisobingiz bloklangan' })).toBeVisible();
  await expect(card).toContainText(new RegExp(`Admin ${DATE_TIME.source} da hisobingizni blokladi\\. Panelga kira olmaysiz\\.`));
  await expect(card).toContainText('HisobBekzod M. · Sotuvchi · U-0105');
  await expect(card).toContainText('SababAldovli reklama');
  await expect(card).toContainText('Asosoferta');
  await expect(card.getByRole('region', { name: 'Pul' })).toContainText('Ushlab turilgan haqbekor qilindi · 0 so‘mMavjud balans0 so‘m');
  await expect(card.getByRole('region', { name: 'Sahifalaringiz' })).toContainText('mijoz «Buyurtma vaqtincha qabul qilinmaydi» sahifasini ko‘radi');
  await expect(card.getByRole('region', { name: 'Qarorga e’tiroz' })).toContainText('Qayerga murojaat qilinadi: [murojaat kanali — TZ’da yo‘q]');
  // Menyu va panel yo'q — karkassiz.
  await expect(page.getByRole('navigation', { name: 'Asosiy menyu' })).toHaveCount(0);

  await card.getByRole('button', { name: 'Ofertani o‘qish' }).click();
  await expect(page.getByRole('dialog', { name: /Sotuvchi ofertasi/ })).toBeVisible();
  await page.getByRole('dialog', { name: /Sotuvchi ofertasi/ }).getByRole('button', { name: 'Yopish' }).first().click();

  await card.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/login$/);
  // Sahifa yangilansa sabab yo'q — kirish sahifasiga.
  await page.goto('/account-blocked');
  await expect(page).toHaveURL(/\/login$/);
});

test('bloklangan sotuvchi SMS kodi bilan kirsa — darhol karkassiz sahifa: sabab, dalil, asos (umumiy-sessiya 7)', async ({ page }) => {
  await signInSeller(page, '930000110');
  await expect(page).toHaveURL(/\/account-blocked$/);
  const card = page.getByTestId('account-lock-page');
  await expect(card).toContainText('HisobBobur Y. · Sotuvchi · U-0110');
  await expect(card).toContainText('SababAldovli reklamaDalilKreativ o‘chirildiAsosoferta');
  await card.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('xodim sessiyada bloklandi → oyna (nazoratchiga savol), «Batafsil» — xodim sahifasi; yangilansa — kirish sahifasi', async ({ page }) => {
  await signInStaff(page, '900000003');
  await expect(page).toHaveURL(/\/operator$/);
  blockAccount('U-0003', 'Soxta tasdiqlar');
  await page.getByRole('radio', { name: 'Tanaffus' }).click({ timeout: 3_000 }).catch(() => undefined);

  const dialog = page.getByTestId('account-lock-dialog');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.locator('dl')).toContainText('SababSoxta tasdiqlarNazoratchiRustam Q.');
  await expect(dialog).not.toContainText('Sahifalaringiz');
  await expect(dialog).toContainText('Ish bo‘yicha savollar — nazoratchingizga.');
  await dialog.getByRole('button', { name: 'Batafsil' }).click();

  const card = page.getByTestId('account-lock-page');
  await expect(card).toContainText('Admin hisobingizni blokladi — tizimga kira olmaysiz. Ish bo‘yicha savollar — nazoratchingizga.');
  await expect(card).toContainText('HisobDilnoza R. · Operator · U-0003');
  await expect(card).toContainText(new RegExp(`Bloklangan${DATE_TIME.source}SababSoxta tasdiqlarNazoratchiRustam Q\\.`));
  await expect(card.locator('main').getByRole('button')).toHaveText(['Chiqish']);

  // Token tozalangan: yangilansa panel ochilmaydi — kirish sahifasi (kirishda yana sabab ko'rsatiladi).
  await page.goto('/operator');
  await expect(page).toHaveURL(/\/login$/);
});

test('bloklangan xodim kirishda — forma o‘rnida sabab (umumiy-kirish 12); «Boshqa hisob bilan kirish» — bo‘sh forma', async ({ page }) => {
  await signInStaff(page, '911001078');
  const card = page.getByTestId('login-lock');
  await expect(card).toContainText('Hisobingiz bloklangan');
  await expect(card).toContainText('Parol to‘g‘ri, lekin kirish yopiq: admin hisobingizni blokladi.');
  await expect(card.locator('dl')).toContainText(new RegExp(`HisobKamron D\\. · OperatorBloklangan${DATE_TIME.source}Savol bo‘lsanazoratchingiz Rustam Q\\.`));
  await expect(page.getByLabel('Parol')).toHaveCount(0);
  await page.getByRole('button', { name: 'Boshqa hisob bilan kirish' }).click();
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('');
  await expect(page.getByLabel('Parol')).toHaveValue('');
});

test('nazoratchi nofaol qilgan operator: sessiyada «Hisobingiz nofaol qilindi» (nazoratchi qarori), sahifasi', async ({ page }) => {
  await signInStaff(page, '900000003');
  await expect(page).toHaveURL(/\/operator$/);
  const dilnoza = findMockUserById('U-0003');
  if (!dilnoza?.staff) throw new Error('U-0003 yo‘q');
  dilnoza.isActive = false;
  dilnoza.staff.inactive = { at: new Date().toISOString(), by: 'Rustam Qodirov', reason: 'Ta’tilda' };
  dilnoza.authVersion += 1;
  revokeMockSessions(dilnoza);
  await page.getByRole('radio', { name: 'Tanaffus' }).click({ timeout: 3_000 }).catch(() => undefined);

  const dialog = page.getByTestId('account-lock-dialog');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole('heading', { name: 'Hisobingiz nofaol qilindi' })).toBeVisible();
  await expect(dialog).toContainText(new RegExp(`${DATE_TIME.source} · nazoratchi qarori`));
  await expect(dialog.locator('dl')).toContainText('SababTa’tilda');
  await dialog.getByRole('button', { name: 'Batafsil' }).click();
  const card = page.getByTestId('account-lock-page');
  await expect(card.getByRole('heading', { level: 1, name: 'Hisobingiz nofaol' })).toBeVisible();
  await expect(card).toContainText(new RegExp(`Nofaol qilingan${DATE_TIME.source}SababTa’tildaNazoratchiRustam Q\\.`));
});

test('noma’lum rolga admin rol berdi → qayta kirgach «Rolingiz o‘zgardi»: oldin, endi, jamoa, kim → «Ish joyini ochish»', async ({ page, browser }) => {
  await signInStaff(page, '900000009');
  await expect(page.getByTestId('unknown-role')).toBeVisible();

  const admin = await adminPage(browser);
  await admin.goto('/admin/users');
  await admin.getByTestId('staff-unknown-banner').getByRole('button', { name: 'Rol berish' }).click();
  await admin.getByTestId('staff-role-dialog').getByRole('button', { name: 'Rolni berish' }).click();
  await expect(admin.getByText('Laylo N. ga Operator roli berildi')).toBeVisible();
  await admin.context().close();

  // Backend rol o'zgarganda sessiyalarni bekor qiladi — qayta tekshirish kirish sahifasiga olib boradi.
  await page.getByRole('button', { name: 'Qayta tekshirish' }).click();
  await expect(page).toHaveURL(/\/login/);
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000009');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  const card = page.getByTestId('role-changed');
  await expect(card.getByRole('heading', { level: 1, name: 'Rolingiz o‘zgardi' })).toBeVisible();
  await expect(card).toContainText('Admin sizga yangi rol berdi. Menyu va sahifalar yangi rol bo‘yicha ochiladi.');
  await expect(card).toContainText(/OldinNoma’lum rolEndiOperatorJamoanazoratchi Rustam Q\.O‘zgartirdiNodira K\. · admin, \d{2}:\d{2}/);
  await expect(page.getByRole('navigation', { name: 'Asosiy menyu' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Ish joyini ochish' }).click();
  await expect(page).toHaveURL(/\/operator$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ish joyi' })).toBeVisible();
});

test('operatorga nazoratchi roli berildi → «Sessiya tugadi» da parol → «Rolingiz o‘zgardi» → nazoratchi ish joyi', async ({ page }) => {
  await signInStaff(page, '900000003');
  await expect(page).toHaveURL(/\/operator$/);
  const dilnoza = findMockUserById('U-0003');
  if (!dilnoza) throw new Error('U-0003 yo‘q');
  dilnoza.role = 'SUPERVISOR';
  dilnoza.lastRoleChange = { before: 'OPERATOR_LEAD', after: 'SUPERVISOR', at: new Date().toISOString(), by: { name: 'Akmal Sobirov', role: 'SUPERADMIN' } };
  dilnoza.authVersion += 1;
  revokeMockSessions(dilnoza);
  await page.getByRole('radio', { name: 'Tanaffus' }).click({ timeout: 3_000 }).catch(() => undefined);

  const dialog = page.getByTestId('session-expired');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByLabel('Parol').fill('Secure123');
  await dialog.getByRole('button', { name: 'Kirish' }).click();
  const card = page.getByTestId('role-changed');
  await expect(card).toContainText(/OldinOperatorEndiNazoratchiO‘zgartirdiAkmal S\. · superadmin, \d{2}:\d{2}/);
  await expect(card).not.toContainText('Jamoa');
  await expect(page.getByText('Qayta kirdingiz. Sahifa va kiritganlaringiz joyida.')).toHaveCount(0);
  await card.getByRole('button', { name: 'Ish joyini ochish' }).click();
  await expect(page).toHaveURL(/\/supervisor/);
  await expect(page.getByRole('navigation', { name: 'Asosiy menyu' })).toBeVisible();
});

test('admin: «Sessiya tugadi» — parol, keyin ilovadagi kod (2/2); xato kod, zaxira kod, «Telefonim yo‘qoldi»; to‘g‘ri kod — joyida', async ({ page }) => {
  db.twoFactor.enabled = true;
  await signInStaff(page, '900000007');
  await page.getByLabel('Ilovadagi kod', { exact: true }).fill(currentTotp(MOCK_TOTP_SECRET));
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect(page).toHaveURL(/\/admin/);
  const nodira = findMockUserById('U-0007');
  if (!nodira) throw new Error('U-0007 yo‘q');
  nodira.authVersion += 1;
  revokeMockSessions(nodira);
  await nextRequest(page, 'Foydalanuvchilar');

  const dialog = page.getByTestId('session-expired');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  // Oyna fondagi so'rovdan oldin chiqqan bo'lsa, menyu bosilmagan — qaysi sahifa ochiq bo'lsa, o'sha joyida qoladi.
  const openedAt = page.url();
  await dialog.getByLabel('Parol').fill('Secure123');
  await dialog.getByRole('button', { name: 'Kirish' }).click();

  const step = page.getByTestId('session-tfa');
  await expect(step).toBeVisible();
  await expect(dialog).toContainText('Xavfsizlik uchun tizim sizni chiqardi. Shu yerda qayta kiring — ish yo‘qolmaydi.');
  await expect(step).toContainText('Nodira K. · Admin');
  await expect(step).toContainText('Parol tekshirildi');
  await expect(step).toContainText('2/2 · parol tekshirildi');
  await expect(step.getByLabel('Ilovadagi kod', { exact: true })).toBeFocused();

  // Xato kod — qolgan urinishlar (kirish sahifasidagi qoidalar).
  let wrong = '';
  for (let shift = 10; !wrong; shift += 1) {
    const code = totpAt(MOCK_TOTP_SECRET, totpCounter() + shift);
    if (verifyTotp(MOCK_TOTP_SECRET, code) === null) wrong = code;
  }
  await step.getByLabel('Ilovadagi kod', { exact: true }).fill(wrong);
  await step.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect(step).toContainText('Kod noto‘g‘ri. Ilovadagi eng yangi kodni kiriting. Yana 2 ta urinish qoldi');

  await step.getByRole('button', { name: 'Telefonim yo‘qoldi' }).click();
  await expect(page.getByTestId('tfa-lost-dialog')).toContainText('Telefoningiz yo‘qoldimi?');
  await page.getByTestId('tfa-lost-dialog').getByRole('button', { name: 'Zaxira kod bilan kirish' }).click();
  await expect(step.getByLabel('Zaxira kod')).toBeVisible();
  await step.getByRole('button', { name: 'Ilovadagi kod bilan kirish' }).click();

  // «Orqaga» — parol maydoni; qayta parol → yana 2-qadam.
  await step.getByRole('button', { name: 'Orqaga' }).click();
  await expect(dialog.getByLabel('Parol')).toBeVisible();
  await dialog.getByLabel('Parol').fill('Secure123');
  await dialog.getByRole('button', { name: 'Kirish' }).click();

  const account = db.twoFactor.accounts['900000007'];
  if (account) account.lastStep = null;
  await step.getByLabel('Ilovadagi kod', { exact: true }).fill(currentTotp(MOCK_TOTP_SECRET));
  await step.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Qayta kirdingiz. Sahifa va kiritganlaringiz joyida.')).toBeVisible();
  await expect(page).toHaveURL(openedAt);
});

test('2FA tiklangan admin: «Sessiya tugadi» da parol → kirish sahifasida ilovani qayta ulash (QR), parol qayta so‘ralmaydi', async ({ page }) => {
  db.twoFactor.enabled = true;
  await signInStaff(page, '900000007');
  await page.getByLabel('Ilovadagi kod', { exact: true }).fill(currentTotp(MOCK_TOTP_SECRET));
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect(page).toHaveURL(/\/admin/);
  // Superadmin tiklagandek (handler bilan bir xil): yangi hisob, `authVersion`+1, sessiyalar bekor.
  const nodira = findMockUserById('U-0007');
  if (!nodira) throw new Error('U-0007 yo‘q');
  db.twoFactor.accounts['900000007'] = { ...freshTwoFactorAccount(), reset: { by: 'Akmal Sobirov', at: new Date().toISOString() } };
  nodira.authVersion += 1;
  revokeMockSessions(nodira);
  await nextRequest(page, 'Foydalanuvchilar');

  const dialog = page.getByTestId('session-expired');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByLabel('Parol').fill('Secure123');
  await dialog.getByRole('button', { name: 'Kirish' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Avval ilovani ulang' })).toBeVisible();
  await page.getByRole('button', { name: 'Ilovani ulash' }).click();
  await expect(page.getByTestId('tfa-connect').getByRole('status')).toContainText('2FA tiklandi');
  await expect(page.getByTestId('tfa-qr').locator('svg')).toBeVisible();
});

test('telefon 390: majburiy varaq — ikonkasiz, × yo‘q, tugmalar 50/50; karkassiz sahifa tugmalari to‘liq kenglikda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInSeller(page, '930000105');
  await expect(page).toHaveURL(/\/affiliate$/);
  blockAccount('U-0105', 'Aldovli reklama');
  await page.getByRole('button', { name: 'Menyu', exact: true }).click({ timeout: 3_000 }).catch(() => undefined);
  await page.getByRole('link', { name: 'Statistika' }).click({ timeout: 3_000 }).catch(() => undefined);

  const dialog = page.getByTestId('account-lock-dialog');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole('heading', { name: 'Hisobingiz bloklandi' })).toBeVisible();
  // Varaq: ikonka yo'q, tugmalar teng kenglikda yonma-yon.
  await expect(dialog.locator('svg.lucide-ban')).toBeHidden();
  const [out, details] = [await dialog.getByRole('button', { name: 'Chiqish' }).boundingBox(), await dialog.getByRole('button', { name: 'Batafsil' }).boundingBox()];
  expect(out && details && Math.abs(out.width - details.width) < 1 && Math.abs(out.y - details.y) < 1).toBe(true);
  await page.mouse.click(195, 60);
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Batafsil' }).click();
  const card = page.getByTestId('account-lock-page');
  const buttons = card.locator('main').getByRole('button');
  await expect(buttons).toHaveText(['Ofertani o‘qish', 'Chiqish']);
  const cardBox = await card.locator('main').boundingBox();
  const buttonBox = await buttons.first().boundingBox();
  expect(cardBox && buttonBox && Math.abs(buttonBox.width - (cardBox.width - 42))).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
