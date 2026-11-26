import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { freshTwoFactorAccount, MOCK_NEW_RECOVERY_CODES, MOCK_RECOVERY_CODES, MOCK_SETUP_SECRET, MOCK_TOTP_SECRET } from '../../src/mocks/fixtures/twoFactor';
import { currentTotp, totpAt, totpCounter, verifyTotp } from '../../src/mocks/totp';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-27 (BE-26, umumiy-2fa): admin, superadmin va moliya — parol, keyin ilovadagi kod. Mock backendda
 * `ADMIN_2FA=on` (`db.twoFactor.enabled`); admin 900000007 ilovani avval ulagan, kod `MOCK_TOTP_SECRET` dan.
 */
const ADMIN_PHONE = '900000007';

/** Ilova oynasiga (±30 soniya) tushmaydigan 6 xonali kod. */
function wrongTotp(secret = MOCK_TOTP_SECRET): string {
  for (let shift = 10; ; shift += 1) {
    const code = totpAt(secret, totpCounter() + shift);
    if (verifyTotp(secret, code) === null) return code;
  }
}
const formatted = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

async function enableTwoFactor(page: Page) {
  await installMockApi(page);
  db.twoFactor.enabled = true;
}

async function signInWithPassword(page: Page, phone: string) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
}

async function submitCode(page: Page, code: string) {
  await page.getByLabel('Ilovadagi kod', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
}

test('TC1: admin parol va ilovadagi to‘g‘ri kod bilan panelga kiradi', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, ADMIN_PHONE);

  const step = page.getByTestId('tfa-code-step');
  await expect(step.getByRole('heading', { level: 1, name: 'Ilovadagi kodni kiriting' })).toBeVisible();
  // Parol to'g'ri bo'lsa ham sessiya ochilmaydi — kodsiz panel yo'q.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('tfa-identity')).toContainText('Nodira K.');
  await expect(page.getByTestId('tfa-identity')).toContainText('· Admin');
  await expect(page.getByTestId('tfa-identity')).toContainText('Parol tekshirildi');
  // Chapdagi «Kirish usuli»: admin qatori faol.
  await expect(page.getByText('Ikki bosqichli kirish: kodsiz panel ochilmaydi.')).toBeVisible();

  const input = page.getByLabel('Ilovadagi kod', { exact: true });
  await expect(input).toBeFocused();
  await input.fill('12a34 56789');
  await expect(input).toHaveValue('123 456');

  await submitCode(page, currentTotp(MOCK_TOTP_SECRET));
  await expect(page).toHaveURL(/\/admin\/moderation$/);
});

test('TC2: xato kod — qolgan urinishlar, 3-xatoda kirish 15 daqiqaga yopiladi', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, ADMIN_PHONE);

  await submitCode(page, '');
  await expect(page.getByText('Ilovadagi 6 xonali kodni kiriting')).toBeVisible();
  await submitCode(page, '12345');
  await expect(page.getByText('Kod 6 ta raqamdan iborat')).toBeVisible();

  await submitCode(page, wrongTotp());
  await expect(page.getByText('Yana 2 ta urinish qoldi, keyin kirish 15 daqiqaga yopiladi.')).toBeVisible();
  await expect(page.getByLabel('Ilovadagi kod', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await submitCode(page, wrongTotp());
  await expect(page.getByText('Bu oxirgi urinish — keyin kirish 15 daqiqaga yopiladi.')).toBeVisible();
  await submitCode(page, wrongTotp());

  const blocked = page.getByTestId('tfa-blocked');
  await expect(blocked.getByRole('heading', { level: 1, name: 'Kirish vaqtincha yopildi' })).toBeVisible();
  await expect(blocked).toContainText('Kod 3 marta noto‘g‘ri kiritildi');
  await expect(blocked.getByRole('timer')).toHaveText(/^1[45]:\d\d$/);
  await expect(blocked.getByRole('button', { name: 'Tasdiqlash' })).toBeDisabled();

  // Qayta parol bilan kirsa ham blok saqlanadi: backend 423 va qolgan vaqtni qaytaradi.
  await blocked.getByRole('button', { name: 'Boshqa hisob' }).click();
  await signInWithPassword(page, ADMIN_PHONE);
  await submitCode(page, currentTotp(MOCK_TOTP_SECRET));
  await expect(page.getByTestId('tfa-blocked').getByRole('timer')).toHaveText(/^1[45]:\d\d$/);
  await expect(page).toHaveURL(/\/login$/);
});

test('TC3: telefon yo‘qolgan — zaxira kod bilan kiradi, kod bir marta ishlaydi', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, ADMIN_PHONE);

  await page.getByRole('button', { name: 'Telefonim yo‘qoldi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Telefoningiz yo‘qoldimi?' });
  await expect(dialog).toContainText('Zaxira kod bilan kiring');
  await expect(dialog).toContainText('Zaxira kod ham yo‘q bo‘lsa — superadmin');
  await dialog.getByRole('button', { name: 'Zaxira kod bilan kirish' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('heading', { level: 1, name: 'Zaxira kodni kiriting' })).toBeVisible();
  const input = page.getByLabel('Zaxira kod', { exact: true });
  await input.fill('k7qm2xpa4d');
  // Bo'shliq va tire qo'yilsa ham backendga aynan saqlangani (katta harf, ajratgichsiz) ketadi.
  await expect(input).toHaveValue('K7QM2-XPA4D');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  expect(db.twoFactor.accounts[ADMIN_PHONE]?.recovery).not.toContain(MOCK_RECOVERY_CODES[0]);
});

test('TC3: ishlatilgan zaxira kod — xato va qolgan urinishlar; ilovadagi kodga qaytish', async ({ page }) => {
  await enableTwoFactor(page);
  db.twoFactor.accounts[ADMIN_PHONE]?.recovery.splice(0, 1);
  await signInWithPassword(page, ADMIN_PHONE);

  await page.getByRole('button', { name: 'Zaxira kod bilan kirish' }).click();
  await page.getByLabel('Zaxira kod', { exact: true }).fill(MOCK_RECOVERY_CODES[0] ?? '');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page.getByText('Zaxira kod noto‘g‘ri yoki avval ishlatilgan. Yana 2 ta urinish qoldi.')).toBeVisible();

  await page.getByRole('button', { name: 'Ilovadagi kod bilan kirish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ilovadagi kodni kiriting' })).toBeVisible();
  await expect(page.getByLabel('Ilovadagi kod', { exact: true })).toHaveValue('');
});

test('2FA bosqichi muddati o‘tsa — parol bosqichiga, raqam saqlanadi', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, ADMIN_PHONE);
  await expect(page.getByTestId('tfa-code-step')).toBeVisible();
  for (const challenge of db.twoFactor.challenges.values()) challenge.expiresAt = Date.now() - 1;

  await submitCode(page, currentTotp(MOCK_TOTP_SECRET));
  await expect(page.getByText('Kod kiritish vaqti tugadi')).toBeVisible();
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('90 000 00 07');
  await expect(page.getByLabel('Parol')).toHaveValue('');
});

test('«Boshqa hisob» — parol bosqichi bo‘sh maydonlar bilan', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, ADMIN_PHONE);
  await page.getByTestId('tfa-identity').getByRole('button', { name: 'Boshqa hisob' }).click();
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('');
  await expect(page.getByLabel('Parol')).toHaveValue('');
});

test('TC4: moliya birinchi kirishda — QR bilan ulaydi, zaxira kodlarni saqlab panelga kiradi', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Chop etish oynasi o'rniga hisoblagich (yashirin iframe ham shu skriptni oladi).
  await page.addInitScript(() => {
    window.print = () => {
      const top = window.top as unknown as { printed?: number };
      top.printed = (top.printed ?? 0) + 1;
    };
  });
  await enableTwoFactor(page);
  await signInWithPassword(page, '900000006');

  const intro = page.getByTestId('tfa-setup-intro');
  await expect(intro.getByRole('heading', { level: 1, name: 'Avval ilovani ulang' })).toBeVisible();
  await expect(page.getByTestId('tfa-identity')).toContainText('Gulnora S.');
  await intro.getByRole('button', { name: 'Ilovani ulash' }).click();

  const connect = page.getByTestId('tfa-connect');
  await expect(connect.getByRole('heading', { level: 1, name: 'Ilovani ulang' })).toBeVisible();
  await expect(connect).toContainText('Moliya hisobi parol va telefoningizdagi ilova kodi bilan ochiladi. Bu bir marta sozlanadi.');
  await expect(connect.getByText('2FA tiklandi')).toHaveCount(0);
  // Chap blok: «Ikkinchi kodni ulash», 1-qadam faol.
  const steps = page.getByRole('complementary', { name: 'Ikkinchi kodni ulash' });
  await expect(steps.locator('[aria-current="true"]')).toContainText('1. Ilovani ulash');
  await expect(connect.getByRole('img', { name: 'QR kod — ilovada skanerlang' }).locator('svg')).toBeVisible();
  await expect(connect).toContainText('Elchi Marketplace · +998 90 000 00 06');
  await expect(page.getByTestId('tfa-secret')).toHaveText('MZXW 6YTB OI4D QNBR 7KPA JBSW Y3DP EHPK');
  await connect.getByRole('button', { name: 'Kalitni nusxalash' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(MOCK_SETUP_SECRET);

  const code = page.getByLabel('Ilovadagi 6 xonali kod');
  await code.fill(wrongTotp(MOCK_SETUP_SECRET));
  await connect.getByRole('button', { name: 'Ulash' }).click();
  await expect(connect.getByText(/^Kod mos kelmadi\. .*vaqt farqi bo‘lsa, kod mos kelmaydi\.$/)).toBeVisible();
  await code.fill(currentTotp(MOCK_SETUP_SECRET));
  await connect.getByRole('button', { name: 'Ulash' }).click();

  const codes = page.getByTestId('tfa-recovery-codes');
  await expect(codes.getByRole('heading', { level: 1, name: 'Zaxira kodlarni saqlang' })).toBeVisible();
  await expect(codes).toContainText('Ilova ulandi');
  await expect(steps.locator('[aria-current="true"]')).toContainText('2. Zaxira kodlar');
  await expect(codes.getByRole('list', { name: 'Zaxira kodlar' }).getByRole('listitem')).toHaveText(MOCK_NEW_RECOVERY_CODES.map((item, index) => `${index + 1}${formatted(item)}`));
  // Kodlar saqlanguncha sessiya ochilmaydi.
  await expect(page).toHaveURL(/\/login$/);

  const [download] = await Promise.all([page.waitForEvent('download'), codes.getByRole('button', { name: 'Yuklab olish (.txt)' }).click()]);
  expect(download.suggestedFilename()).toBe('elchi-market-2fa-zaxira-kodlar.txt');
  const file = readFileSync(await download.path(), 'utf8');
  expect(file).toContain('Elchi Market — 2FA zaxira kodlar');
  expect(file).toContain('Gulnora S. · Moliya (+998 90 000 00 06)');
  expect(file).toContain(`1. ${formatted(MOCK_NEW_RECOVERY_CODES[0] ?? '')}`);
  expect(file).toContain(`8. ${formatted(MOCK_NEW_RECOVERY_CODES[7] ?? '')}`);

  await codes.getByRole('button', { name: 'Nusxalash' }).click();
  await expect(page.getByText('Zaxira kodlar nusxalandi')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(file);

  await codes.getByRole('button', { name: 'Chop etish' }).click();
  await expect(page.frameLocator('iframe[data-print-frame]').locator('pre')).toContainText(formatted(MOCK_NEW_RECOVERY_CODES[3] ?? ''));
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed?: number }).printed)).toBe(1);

  // Belgisiz — «Kodlarni saqladingizmi?»; «Orqaga» — kodlar ekranida qoladi.
  await codes.getByRole('button', { name: 'Panelga o‘tish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kodlarni saqladingizmi?' });
  await expect(dialog).toContainText('Eng oson yo‘l — faylni yuklab olish');
  await dialog.getByRole('button', { name: 'Orqaga' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/login$/);
  await codes.getByRole('button', { name: 'Panelga o‘tish' }).click();
  await page.getByRole('dialog', { name: 'Kodlarni saqladingizmi?' }).getByRole('button', { name: 'Saqladim, davom etish' }).click();
  await expect(page).toHaveURL(/\/finance$/);
  expect(db.twoFactor.accounts['900000006']?.enabledAt).toBeTruthy();
});

test('TC4: «Kodlarni xavfsiz joyga saqladim» belgilansa — oynasiz panelga', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, '900000006');
  await page.getByRole('button', { name: 'Ilovani ulash' }).click();
  await page.getByLabel('Ilovadagi 6 xonali kod').fill(currentTotp(MOCK_SETUP_SECRET));
  await page.getByRole('button', { name: 'Ulash' }).click();
  await page.getByRole('checkbox', { name: 'Kodlarni xavfsiz joyga saqladim' }).check();
  await page.getByRole('button', { name: 'Panelga o‘tish' }).click();
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('superadmin 2FA ni tiklagan — «Ilovani qayta ulang» va «2FA tiklandi» xabari', async ({ page }) => {
  await enableTwoFactor(page);
  db.twoFactor.accounts[ADMIN_PHONE] = { ...freshTwoFactorAccount(), reset: { by: 'Akmal Sobirov', at: '2027-01-14T09:20:00.000Z' } };
  await signInWithPassword(page, ADMIN_PHONE);
  await page.getByRole('button', { name: 'Ilovani ulash' }).click();
  const connect = page.getByTestId('tfa-connect');
  await expect(connect.getByRole('heading', { level: 1, name: 'Ilovani qayta ulang' })).toBeVisible();
  await expect(connect.getByRole('status')).toContainText('2FA tiklandi');
  await expect(connect.getByRole('status')).toContainText(/Superadmin Akmal S\. 14\.01\.2027, \d\d:\d\d da eski ilovangizni uzdi\./);
  await expect(connect.getByRole('button', { name: 'Chiqish' })).toBeVisible();
});

test('ulash bosqichi muddati o‘tsa — QR so‘ralmaydi, parol bosqichiga ogohlantirish bilan', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, '900000006');
  await expect(page.getByTestId('tfa-setup-intro')).toBeVisible();
  for (const challenge of db.twoFactor.challenges.values()) challenge.expiresAt = Date.now() - 1;
  await page.getByRole('button', { name: 'Ilovani ulash' }).click();
  await expect(page.getByText('Kod kiritish vaqti tugadi')).toBeVisible();
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('90 000 00 06');
});

test('telefonda ulash: «Ilovada ochish» havolasi, kalit va ochiladigan QR (umumiy-2fa-ulash.mobil)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await enableTwoFactor(page);
  await signInWithPassword(page, '900000006');
  await page.getByRole('button', { name: 'Ilovani ulash' }).click();

  const step = page.getByRole('region', { name: 'Kalitni ilovaga qo‘shing' });
  await expect(step.getByRole('link', { name: 'Ilovada ochish' })).toHaveAttribute('href', /^otpauth:\/\/totp\/Elchi%20Marketplace%3A%2B998900000006\?secret=MZXW6YTBOI4DQNBR7KPAJBSWY3DPEHPK&/);
  await expect(step).toContainText('Hisob nomi ilovada: Elchi Marketplace · +998 90 000 00 06');
  await expect(step.getByTestId('tfa-secret')).toHaveText('MZXW 6YTB OI4D QNBR 7KPA JBSW Y3DP EHPK');
  // QR shu telefonda yopiq — ilova boshqa telefonda bo'lsa ochiladi.
  const toggle = step.getByRole('button', { name: 'QR kodni ko‘rsatish' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(step.getByRole('img', { name: 'QR kod — ilovada skanerlang' })).toBeHidden();
  await toggle.click();
  await expect(step.getByRole('button', { name: 'QR kodni yashirish' })).toHaveAttribute('aria-expanded', 'true');
  await expect(step.getByRole('img', { name: 'QR kod — ilovada skanerlang' })).toBeVisible();
  await expect(step).toContainText('Boshqa telefondagi ilovada: «+» → «QR kodni skanerlash»');
  // Gorizontal aylantirish yo'q (360–390 px).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByLabel('Ilovadagi 6 xonali kod').fill(currentTotp(MOCK_SETUP_SECRET));
  await page.getByRole('button', { name: 'Ulash' }).click();
  await expect(page.getByTestId('tfa-recovery-codes')).toBeVisible();
  await page.getByRole('button', { name: 'Panelga o‘tish' }).click();
  // Telefonda varaq: «Saqladim».
  await page.getByRole('dialog', { name: 'Kodlarni saqladingizmi?' }).getByRole('button', { name: 'Saqladim', exact: true }).click();
  await expect(page).toHaveURL(/\/finance$/);
});

test('planshetda forma markazda, «Kirish usuli» kartalari izohlari bilan; telefonda izohsiz', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await enableTwoFactor(page);
  await signInWithPassword(page, ADMIN_PHONE);
  const methods = page.getByRole('complementary', { name: 'Kirish usuli rolingizga bog‘liq' });
  await expect(methods.getByText('Ikki bosqichli kirish: kodsiz panel ochilmaydi.')).toBeVisible();
  const rows = await methods.locator('dl > div').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(new Set(rows).size).toBe(1);
  // Forma bo'sh joyning o'rtasida: tepadagi va pastdagi bo'shliq deyarli teng.
  const gaps = await page.getByTestId('tfa-code-step').evaluate((form) => {
    const main = form.closest('main')?.getBoundingClientRect();
    const box = form.getBoundingClientRect();
    return main ? [box.top - main.top, main.bottom - box.bottom] : [0, 0];
  });
  expect(Math.abs((gaps[0] ?? 0) - (gaps[1] ?? 0))).toBeLessThanOrEqual(10);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(methods.getByText('Ikki bosqichli kirish: kodsiz panel ochilmaydi.')).toBeHidden();
});

test('TC5: operator 2FA siz kiradi; flag o‘chiq bo‘lsa admin ham eski oqimda', async ({ page }) => {
  await enableTwoFactor(page);
  await signInWithPassword(page, '900000003');
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.getByTestId('tfa-code-step')).toHaveCount(0);

  await page.context().clearCookies();
  await page.evaluate(() => sessionStorage.clear());
  db.twoFactor.enabled = false;
  await signInWithPassword(page, ADMIN_PHONE);
  await expect(page).toHaveURL(/\/admin\/moderation$/);
});
