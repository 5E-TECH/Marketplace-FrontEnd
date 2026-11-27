import { expect, test, type Browser, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { MOCK_TOTP_SECRET } from '../../src/mocks/fixtures/twoFactor';
import { findMockUserById } from '../../src/mocks/fixtures/users';
import { currentTotp } from '../../src/mocks/totp';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-15 «Admin: foydalanuvchilar va rollar» — kartadagi TC1–5 va qabul mezonlari («bloklangan darhol chiqadi»,
 * «rol o‘zgarishi auditda»). Har TC ikki brauzerda: admin (yoki superadmin) va o'sha xodim — mock baza umumiy.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  // Ikki brauzer, ikki kirish va qayta kirish — odatdagi 30 s yetmaydi.
  test.setTimeout(90_000);
  await installMockApi(context);
});

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Asosiy menyu' });

async function signIn(page: Page, phone: string, password = 'Secure123') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill(password);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
}

/** Admin yoki superadmin — ikkinchi brauzerda (o'sha mock baza). 2FA yoqilgan bo'lsa — ilovadagi kod ham. */
async function staffBrowser(browser: Browser, phone: string, withCode = false): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installMockApi(context, { reset: false });
  const page = await context.newPage();
  await signIn(page, phone);
  if (withCode) {
    await page.getByLabel('Ilovadagi kod', { exact: true }).fill(currentTotp(MOCK_TOTP_SECRET));
    await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  }
  await expect(page).toHaveURL(/\/admin/);
  return page;
}

/** Ochiq sahifada keyingi so'rov: operator holatini almashtirish (oyna allaqachon chiqqan bo'lsa — bosilmaydi). */
async function nextOperatorRequest(page: Page) {
  await page.getByRole('radio', { name: 'Tanaffus' }).click({ timeout: 3_000 }).catch(() => undefined);
}

async function changeRole(admin: Page, name: string, role: string) {
  await admin.goto('/admin/users');
  await admin.getByRole('button', { name: `${name} amallari` }).click();
  await admin.getByRole('menuitem', { name: 'Rolni almashtirish' }).click();
  const dialog = admin.getByTestId('staff-role-dialog');
  await dialog.getByRole('radio', { name: role }).check();
  await dialog.getByRole('button', { name: `${role} qilish` }).click();
  await expect(admin.getByText(`${name} — endi ${role}`)).toBeVisible();
}

test('TC1: operatorga nazoratchi roli berildi → qayta kirgach «Rolingiz o‘zgardi», menyu — nazoratchiniki', async ({ page, browser }) => {
  await signIn(page, '911001054');
  await expect(page).toHaveURL(/\/operator$/);
  await expect(mainNav(page).getByRole('link')).toHaveText(['Ish joyi', 'Rejalashtirilgan qo‘ng‘iroqlar', 'Mening qo‘ng‘iroqlarim', 'Mening buyurtmalarim', 'Statistikam']);

  const admin = await staffBrowser(browser, '900000007');
  await changeRole(admin, 'Lola A.', 'Nazoratchi');
  await admin.context().close();

  // Backend rol o'zgarganda sessiyalarni bekor qiladi: keyingi so'rov — «Sessiya tugadi», parol bilan qayta kirish.
  await nextOperatorRequest(page);
  const dialog = page.getByTestId('session-expired');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByLabel('Parol').fill('Secure123');
  await dialog.getByRole('button', { name: 'Kirish' }).click();

  const changed = page.getByTestId('role-changed');
  await expect(changed).toContainText(/OldinOperatorEndiNazoratchiO‘zgartirdiNodira K\. · admin, \d{2}:\d{2}/);
  await changed.getByRole('button', { name: 'Ish joyini ochish' }).click();
  await expect(page).toHaveURL(/\/supervisor$/);
  await expect(mainNav(page).getByRole('link')).toHaveText(['Navbat', 'Lidlar', 'Buyurtmalar', 'Operatorlar', 'Qo‘ng‘iroq yozuvlari']);
  // Eski rol sahifasi endi yopiq.
  await page.goto('/operator');
  await expect(page.getByTestId('forbidden-page')).toBeVisible();
});

test('TC2 + mezon: admin operatorni bloklaydi → ish joyida darhol «Hisobingiz bloklandi»; qayta kira olmaydi', async ({ page, browser }) => {
  await signIn(page, '911001053');
  await expect(page).toHaveURL(/\/operator$/);

  const admin = await staffBrowser(browser, '900000007');
  await admin.goto('/admin/users');
  await admin.getByRole('button', { name: 'Jamshid E. amallari' }).click();
  await admin.getByRole('menuitem', { name: 'Bloklash' }).click();
  await admin.getByTestId('staff-block-dialog').getByLabel('Sabab').fill('Mehnat shartnomasi tugadi');
  await admin.getByTestId('staff-block-dialog').getByRole('button', { name: 'Bloklash' }).click();
  await expect(admin.getByText('Jamshid E. bloklandi')).toBeVisible();
  await admin.context().close();

  await nextOperatorRequest(page);
  const dialog = page.getByTestId('account-lock-dialog');
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toContainText(/Hisobingiz bloklandi\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} · admin qarori/);
  await expect(dialog.locator('dl')).toContainText('SababMehnat shartnomasi tugadiNazoratchiRustam Q.');
  await dialog.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, '911001053');
  await expect(page.getByTestId('login-lock')).toContainText('Hisobingiz bloklangan');
  await expect(page.getByTestId('login-lock')).toContainText('HisobJamshid E. · Operator');
  await expect(page).toHaveURL(/\/login$/);
});

test('TC3: admin operator qo‘shadi → operator kiradi → «Keyingi lid» lid beradi', async ({ page, browser }) => {
  const admin = await staffBrowser(browser, '900000007');
  await admin.goto('/admin/users/new');
  const form = admin.getByTestId('staff-new');
  await form.getByLabel('Ism').fill('Bahrom');
  await form.getByLabel('Familiya').fill('Olimov');
  await form.getByLabel('Telefon raqami').fill('912457013');
  await expect(form.getByRole('radio', { name: 'Operator' })).toBeChecked();
  await expect(form.getByLabel('Jamoa')).toHaveValue('T-1');
  await form.getByRole('button', { name: 'Xodimni qo‘shish' }).click();
  await expect(admin.getByText('Bahrom O. qo‘shildi')).toBeVisible();
  await expect(admin.getByTestId('staff-card')).toContainText('Hali kirmagan');
  await admin.context().close();

  // Vaqtinchalik parol SMS bilan keladi (taklif §4; mock har qanday parolni qabul qiladi).
  await signIn(page, '912457013', 'Vaqtinchalik1');
  await expect(page).toHaveURL(/\/operator$/);
  await expect(page.getByTestId('user-menu-button')).toContainText('Bahrom O.');
  const next = page.getByRole('button', { name: /Keyingi lid/ });
  await expect(next).toBeDisabled();
  await page.getByRole('radio', { name: 'Onlayn' }).click();
  await next.click();
  await expect(page.getByTestId('lead-card').getByRole('heading', { level: 2 })).toBeVisible();
  await expect(page.getByTestId('lead-card').getByTestId('booking-left')).toHaveText(/Bron: (10:00|09:5\d) qoldi/);
  expect(findMockUserById('U-2088')?.staff?.lastLoginAt).toEqual(expect.any(String));
});

test('TC4 + mezon: rol o‘zgarishi auditda — eski va yangi rol, kim; audit jurnalida yozuv', async ({ page }) => {
  await signIn(page, '900000007');
  await expect(page).toHaveURL(/\/admin/);
  await changeRole(page, 'Lola A.', 'Nazoratchi');

  // BE-27 audit yozuvi (backendda `audit_logs`): amal, obyekt, oldin va keyin.
  expect(db.userAudit[0]).toMatchObject({
    action: 'user.role.update', actorId: 'U-0007', actorName: 'Nodira Karimova', entityType: 'User', entityId: 'U-1054',
    meta: { before: { role: 'OPERATOR_LEAD' }, after: { role: 'SUPERVISOR' } },
  });

  // Admin o'z kartasida — «Oxirgi amallari»: kim, eski → yangi rol.
  await page.goto('/admin/users/U-0007');
  const actions = page.getByTestId('staff-card').locator('section').filter({ has: page.getByRole('heading', { name: 'Oxirgi amallari' }) });
  // Backend audit yozuvida obyekt ismi yo'q — kod bilan (`entityId`).
  await expect(actions.locator('li').first()).toContainText('Rol · U-1054');
  await expect(actions.locator('li').first()).toContainText('Operator → Nazoratchi');

  // Audit jurnali (`entityType=User`): yozuv jadvalda.
  await page.goto('/admin/audit-logs?entityType=User');
  const firstRow = page.locator('tbody tr.ant-table-row').first();
  await expect(firstRow).toContainText('Nodira Karimova');
  await expect(firstRow).toContainText('user.role.update');
  await expect(firstRow).toContainText('U-1054');
});

test('TC5: superadmin moliyachining 2FA sini tiklaydi → sessiyasi tugaydi, keyingi kirishda QR bilan qayta ulaydi', async ({ page, browser }) => {
  db.twoFactor.enabled = true;
  await signIn(page, '911001009');
  await page.getByLabel('Ilovadagi kod', { exact: true }).fill(currentTotp(MOCK_TOTP_SECRET));
  await page.getByRole('button', { name: 'Tasdiqlash' }).click();
  await expect(page).toHaveURL(/\/finance/);
  const financePage = page.url();

  const superadmin = await staffBrowser(browser, '900000008', true);
  await superadmin.goto('/admin/users/U-1009');
  await superadmin.getByTestId('staff-card').getByRole('button', { name: '2FA ni tiklash' }).click();
  const reset = superadmin.getByTestId('staff-tfa-reset-dialog');
  await reset.getByLabel('Sabab').fill('Telefoni yo‘qolgan');
  await reset.getByRole('button', { name: '2FA ni tiklash' }).click();
  await expect(superadmin.getByText('Ozoda B.: 2FA tiklandi')).toBeVisible();
  await superadmin.context().close();

  // Sessiyalar bekor qilingan: sahifa yangilansa sessiya tiklanmaydi — kirish sahifasi, `from` saqlanadi.
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('911001009');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  // Parol to'g'ri, 2FA ulanmagan — kod emas, ulash oqimi (QR).
  await page.getByRole('button', { name: 'Ilovani ulash' }).click();
  const connect = page.getByTestId('tfa-connect');
  await expect(connect.getByRole('heading', { level: 1, name: 'Ilovani qayta ulang' })).toBeVisible();
  await expect(connect.getByRole('status')).toContainText('2FA tiklandi');
  await expect(connect.getByRole('status')).toContainText(/Superadmin Akmal S\. \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} da eski ilovangizni uzdi\./);
  await expect(connect.getByTestId('tfa-qr').locator('svg')).toBeVisible();
  expect(db.twoFactor.accounts['911001009']).toMatchObject({ enabledAt: null, reset: { by: 'Akmal Sobirov' } });
  expect(financePage).toMatch(/\/finance/);
});
