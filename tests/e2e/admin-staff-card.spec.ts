import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { findMockUserById } from '../../src/mocks/fixtures/users';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-15 xodim kartasi va «Yangi xodim» (admin-foydalanuvchi-karta + .planshet/.mobil/.holatlar): desktopda ro'yxat
 * yonida panel, planshetda drawer, telefonda ichki sahifa; K1–K6 holatlari, D4–D6 oynalari.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function signIn(page: Page, phone = '900000007') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
}

const card = (page: Page) => page.getByTestId('staff-card');
const section = (page: Page, name: string | RegExp) => card(page).locator('section').filter({ has: page.getByRole('heading', { name }) });

test('karta ro‘yxat yonida: ro‘yxat torayadi, qator belgilanadi, bo‘limlar; yopilsa — to‘liq ro‘yxat', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/users?q=gul');
  await page.getByTestId('staff-row-U-0006').click();
  await expect(page).toHaveURL(/\/admin\/users\/U-0006\?q=gul$/);
  await expect(page.getByTestId('staff-row-U-0006')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('staff-table').getByRole('columnheader', { name: 'Kirish', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('staff-table').getByRole('columnheader', { name: 'Ikki bosqichli kirish' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Foydalanuvchilar/ }).filter({ hasText: '‹' })).toHaveCount(0);

  await expect(card(page).getByRole('heading', { level: 2 })).toHaveText('Gulnora S.');
  await expect(section(page, 'Aloqa va kirish')).toContainText('+998 90 000 00 06kirish raqami');
  await expect(section(page, 'Aloqa va kirish')).toContainText('Telefon, parol va ilovadagi kod');
  await expect(section(page, 'Aloqa va kirish')).toContainText('Akmal S.');
  await expect(section(page, 'Rol')).toContainText('Elchi sverkasi · Hisoblar · Pul yechish so‘rovlari · Cheklar');
  await expect(section(page, 'Kirish va xavfsizlik')).toContainText('Tiklash — faqat superadmin');
  await expect(section(page, /Faol sessiyalar/)).toContainText('Faol sessiyalar · 2');
  await expect(section(page, /Faol sessiyalar/)).toContainText('Chrome · Windows');
  await expect(section(page, 'Kirishlar tarixi')).toContainText('Kod noto‘g‘ri');
  await expect(section(page, 'Oxirgi amallari')).toContainText('Pul yechish · Sherzod A.');
  await expect(section(page, 'Oxirgi amallari')).toContainText('1 000 000 so‘m · So‘raldi → Tasdiqlandi');

  await card(page).getByRole('button', { name: 'Kartani yopish' }).click();
  await expect(page).toHaveURL(/\/admin\/users\?q=gul$/);
  await expect(card(page)).toHaveCount(0);
});

test('K1 «Yangi xodim»: majburiy maydonlar, band raqam — kimniki; qo‘shilgach K2 karta, SMS qayta yuborish', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/users');
  await page.getByRole('link', { name: 'Xodim qo‘shish' }).click();
  const form = page.getByTestId('staff-new');
  await expect(form.getByRole('heading', { name: 'Yangi xodim' })).toBeVisible();
  await form.getByRole('button', { name: 'Xodimni qo‘shish' }).click();
  await expect(form).toContainText('Ismni kiriting');
  await expect(form).toContainText('Familiyani kiriting');
  await expect(form).toContainText('Telefon raqamini kiriting — vaqtinchalik parol shunga boradi');
  await form.getByLabel('Ism').fill('Bahrom');
  await form.getByLabel('Familiya').fill('Olimov');
  await form.getByLabel('Telefon raqami').fill('900000009');
  await expect(form.getByLabel('Jamoa')).toHaveValue('T-1');
  await expect(form).toContainText('Vaqtinchalik parol SMS bilan shu raqamga boradi.');
  await form.getByRole('button', { name: 'Xodimni qo‘shish' }).click();
  await expect(form).toContainText('Bu raqam bilan hisob bor: Laylo N. (U-2087). Boshqa raqam kiriting yoki o‘sha hisobni oching.');

  await form.getByLabel('Telefon raqami').fill('912457013');
  await form.getByRole('button', { name: 'Xodimni qo‘shish' }).click();
  await expect(page).toHaveURL(/\/admin\/users\/U-2088$/);
  await expect(page.getByText('Bahrom O. qo‘shildi')).toBeVisible();
  await expect(card(page)).toContainText('Hali kirmagan');
  await expect(card(page)).toContainText('Hisob ochildi — xodim hali kirmagan');
  await expect(card(page)).toContainText('raqamiga yuborildi. Birinchi kirishda yangi parol o‘rnatadi.');
  await expect(section(page, 'Operator ish joyi')).toContainText('Rustam Q. — nazoratchi');
  await expect(section(page, 'Kirish va xavfsizlik')).toContainText(/vaqtinchalik · bugun, \d{2}:\d{2}/);
  await expect(section(page, /Faol sessiyalar/)).toContainText('Hali hech qayerda kirilmagan.');
  await expect(card(page).getByRole('button', { name: 'Hisobni bloklash' })).toBeVisible();
  expect(findMockUserById('U-2088')).toMatchObject({ role: 'OPERATOR_LEAD', staff: { teamId: 'T-1', lastLoginAt: null } });

  await card(page).getByRole('button', { name: 'SMS ni qayta yuborish' }).click();
  await expect(page.getByText('SMS qayta yuborildi')).toBeVisible();
});

test('backend SMS yubormasa — vaqtinchalik parol bir marta ko‘rsatiladi (fe-15 §4)', async ({ page }) => {
  await signIn(page, '900000008');
  await page.route('**/api/v1/admin/team', (route) => route.fulfill({
    status: 201,
    json: { data: { id: '2101', name: 'Ali Valiyev', phone: '+998931112233', role: 'WAREHOUSE', isActive: true, createdAt: '2026-11-27T09:00:00.000Z', updatedAt: '2026-11-27T09:00:00.000Z', temporaryPassword: 'aB3dE5fG7hJ9kL1m' } },
  }));
  await page.goto('/admin/users/new');
  const form = page.getByTestId('staff-new');
  await form.getByLabel('Ism').fill('Ali');
  await form.getByLabel('Familiya').fill('Valiyev');
  await form.getByLabel('Telefon raqami').fill('931112233');
  await form.getByRole('radio', { name: 'Omborchi' }).check();
  await form.getByRole('button', { name: 'Xodimni qo‘shish' }).click();
  const dialog = page.getByTestId('staff-temp-password');
  await expect(dialog).toContainText('SMS yuborilmadi — parolni xodimga o‘zingiz bering.');
  await expect(dialog.getByTestId('staff-temp-password-value')).toHaveText('aB3dE5fG7hJ9kL1m');
  await expect(page.getByText('Vaqtinchalik parolni xodimga bering')).toBeVisible();
  await dialog.getByRole('button', { name: 'Tushunarli' }).click();
  await expect(dialog).toHaveCount(0);
});

test('K3 bloklangan: yagona amal «Blokdan chiqarish»; K4 o‘zi va K5 superadmin — amallar yopiq, sababi bilan', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/users/U-1078');
  await expect(card(page)).toContainText('Bloklangan — tizimga kira olmaydi');
  await expect(card(page)).toContainText('Nodira K. Sabab: Firibgarlik tekshiruvi: soxta tasdiqlar.');
  await expect(section(page, 'Rol')).toHaveCount(0);
  await expect(section(page, /Faol sessiyalar/)).toContainText('Bloklanganda hamma sessiya tugadi.');
  await card(page).getByRole('button', { name: 'Blokdan chiqarish' }).click();
  await expect(page.getByText('Kamron D. blokdan chiqarildi')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Bloklash' })).toBeVisible();

  await page.goto('/admin/users/U-0007');
  await expect(card(page).getByRole('heading', { level: 2 })).toHaveText('Nodira K. (siz)');
  await expect(card(page).getByRole('button', { name: 'Rolni almashtirish' })).toBeDisabled();
  await expect(card(page)).toContainText('O‘z rolingizni o‘zgartira olmaysiz — buni boshqa admin yoki superadmin qiladi.');
  await expect(card(page).getByRole('button', { name: 'Parolni tiklash' })).toBeDisabled();
  await expect(card(page).getByRole('link', { name: 'Mening profilimni ochish' })).toBeVisible();
  await expect(section(page, /Faol sessiyalar/)).toContainText('o‘z sessiyalaringiz «Mening profilim»da yopiladi');
  await expect(section(page, /Faol sessiyalar/)).toContainText('Hozir faol');
  await expect(card(page).getByRole('button', { name: 'Bloklash' })).toBeDisabled();
  await expect(card(page)).toContainText('O‘zingizni bloklab bo‘lmaydi — panelga hech kim kira olmay qolishi mumkin.');

  await page.goto('/admin/users/U-0008');
  await expect(card(page)).toContainText('Superadmin hisobini faqat superadmin o‘zgartiradi');
  await expect(card(page)).toContainText('Superadmin rolini faqat superadmin beradi va oladi.');
  await expect(card(page)).toContainText('Superadminni admin bloklay olmaydi.');
  await expect(section(page, /Faol sessiyalar/).getByRole('button', { name: 'Hammasini tugatish' })).toHaveCount(0);
});

test('D4 parolni tiklash: «bugun kira olmadi», SMS yoki menga ko‘rsatish; eski token bekor', async ({ page }) => {
  // Fixture «30 daqiqa oldin» yarim tundan keyin kechaga tushadi — oxirgi xato urinish aniq bugun bo'lsin.
  const marjona = findMockUserById('U-1055');
  if (marjona?.staff?.logins[0]) marjona.staff.logins[0].at = new Date(Date.now() - 1_000).toISOString();
  await signIn(page);
  await page.goto('/admin/users/U-1055');
  await card(page).getByRole('button', { name: 'Parolni tiklash' }).click();
  const dialog = page.getByTestId('staff-password-dialog');
  await expect(dialog).toContainText('Marjona I. bugun kira olmadi. Tiklash audit jurnaliga yoziladi.');
  await expect(dialog).toContainText('hamma qurilmada tugaydi');
  await dialog.getByRole('radio', { name: 'Vaqtinchalik parolni menga ko‘rsatish' }).check();
  const version = findMockUserById('U-1055')?.authVersion ?? 0;
  await dialog.getByRole('button', { name: 'Parolni tiklash' }).click();
  await expect(page.getByTestId('staff-temp-password-value')).toHaveText(/^\S{16}$/);
  expect(findMockUserById('U-1055')?.authVersion).toBe(version + 1);
  await page.getByRole('button', { name: 'Tushunarli' }).click();

  await card(page).getByRole('button', { name: 'Parolni tiklash' }).click();
  await page.getByTestId('staff-password-dialog').getByRole('button', { name: 'Parolni tiklash' }).click();
  await expect(page.getByText('Marjona I.: vaqtinchalik parol SMS bilan yuborildi. Hamma sessiya tugadi.')).toBeVisible();
  expect(db.userAudit[0]).toMatchObject({ action: 'user.password.reset', entityId: 'U-1055', meta: { delivery: 'SMS' } });
});

test('D6 sessiyalar: bittasini va hammasini tugatish', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/users/U-0006');
  await card(page).getByRole('button', { name: 'Sessiyani tugatish: Safari · iPhone' }).click();
  const dialog = page.getByTestId('staff-session-dialog');
  await expect(dialog).toContainText('Sessiyani tugatasizmi?');
  await expect(dialog).toContainText('Gulnora S. shu qurilmada keyingi so‘rovda chiqib ketadi.');
  await dialog.getByRole('button', { name: 'Sessiyani tugatish' }).click();
  await expect(page.getByText('Gulnora S. · Safari · iPhone.')).toBeVisible();
  await expect(section(page, /Faol sessiyalar/)).toContainText('Faol sessiyalar · 1');

  await section(page, /Faol sessiyalar/).getByRole('button', { name: 'Hammasini tugatish' }).click();
  await page.getByTestId('staff-session-dialog').getByRole('button', { name: 'Hammasini tugatish' }).click();
  await expect(page.getByText('Hamma sessiya tugatildi')).toBeVisible();
  await expect(section(page, /Faol sessiyalar/)).toContainText('Faol sessiya yo‘q.');
});

test('D5 / K6: superadmin moliya xodimining 2FA sini tiklaydi — sabab majburiy, holat «Tiklandi», auditda', async ({ page }) => {
  await signIn(page, '900000008');
  await page.goto('/admin/users/U-1009');
  await expect(section(page, 'Kirish va xavfsizlik')).toContainText('Ulangan');
  await card(page).getByRole('button', { name: '2FA ni tiklash' }).click();
  const dialog = page.getByTestId('staff-tfa-reset-dialog');
  await expect(dialog).toContainText('Ozoda B. ning 2FA sini tiklash');
  await expect(dialog).toContainText('Eski ilovadagi kod darhol ishlamaydi, zaxira kodlar bekor bo‘ladi.');
  await dialog.getByRole('button', { name: '2FA ni tiklash' }).click();
  await expect(dialog).toContainText('Sababni yozing — u audit jurnaliga yoziladi');
  await dialog.getByLabel('Sabab').fill('Telefoni yo‘qolgan — o‘zi qo‘ng‘iroq qilib aytdi');
  await dialog.getByRole('button', { name: '2FA ni tiklash' }).click();
  await expect(page.getByText('Ozoda B.: 2FA tiklandi')).toBeVisible();
  await expect(section(page, 'Kirish va xavfsizlik')).toContainText(/Tiklandi — qayta ulanmagan\d{2}:\d{2} · Akmal S\./);
  expect(db.twoFactor.accounts['911001009']).toMatchObject({ enabledAt: null, reset: { by: 'Akmal Sobirov' } });
  expect(db.userAudit[0]).toMatchObject({ action: 'user.2fa.reset', entityId: 'U-1009', meta: { reason: 'Telefoni yo‘qolgan — o‘zi qo‘ng‘iroq qilib aytdi' } });
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('karta o‘ngdan drawer: to‘liq ro‘yxat ostida, «Kartani yopish»', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/users/U-0006');
    await expect(card(page)).toBeVisible();
    await expect(page.getByRole('dialog').filter({ has: card(page) })).toBeVisible();
    await expect(page.getByTestId('staff-table')).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
    await card(page).getByRole('button', { name: 'Kartani yopish' }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('karta — ichki sahifa: sarlavhada ism, «‹ Foydalanuvchilar»; «Yangi xodim» — pastki panelda tugmalar', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/users');
    await page.getByRole('link', { name: 'Gulnora S. — xodim kartasi' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gulnora S.');
    await expect(page.getByTestId('staff-table')).toHaveCount(0);
    await expect(card(page)).toContainText('Faol sessiyalar · 2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('link', { name: /Orqaga|Foydalanuvchilar/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await page.getByRole('link', { name: 'Xodim qo‘shish' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yangi xodim');
    await expect(page.getByRole('button', { name: 'Xodimni qo‘shish' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bekor qilish' })).toBeVisible();
  });
});
