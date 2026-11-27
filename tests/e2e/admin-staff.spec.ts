import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { findMockUserById } from '../../src/mocks/fixtures/users';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-15 «Xodimlar» yorlig'i (admin-foydalanuvchilar + .planshet/.mobil/.holatlar): roli noma'lum xodim banneri, rol
 * bo'yicha guruhlar, filtrlar, «Rol berish», rolni almashtirish, bloklash va blokdan chiqarish. Mock: 20 xodim
 * (13 operator, Kamron D. bloklangan, Laylo N. — eski rol).
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

async function openStaff(page: Page, query = '', phone?: string) {
  await signIn(page, phone);
  await page.goto(`/admin/users${query}`);
  await expect(page.getByTestId('staff-unknown-banner').or(page.getByTestId('staff-table')).or(page.getByTestId('staff-cards')).first()).toBeVisible();
}

const table = (page: Page) => page.getByTestId('staff-table');
const row = (page: Page, code: string) => page.getByTestId(`staff-row-${code}`);
const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Foydalanuvchilar bo‘limi' }).getByRole('tab', { name: new RegExp(`^${name}`) });

test('ro‘yxat: yorliqlar sonlari, banner, rol guruhlari va izoh', async ({ page }) => {
  await openStaff(page);
  await expect(tab(page, 'Xodimlar')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Xodimlar')).toContainText('20');
  await expect(tab(page, 'Operatorlar jamoasi')).toContainText('13');
  await expect(page.getByRole('link', { name: 'Xodim qo‘shish' })).toHaveAttribute('href', '/admin/users/new');

  const banner = page.getByTestId('staff-unknown-banner');
  await expect(banner).toContainText('Laylo N. ning roli yo‘q — menyu ochilmaydi');
  await expect(banner).toContainText(/Bugun \d{2}:\d{2} da kirdi, lekin tizim uning rolini tanimadi/);

  const groups = table(page).locator('tbody th[scope="colgroup"]');
  await expect(groups).toHaveText([
    /^Noma’lum rol · 1 — menyu ochilmaydi, rol bering/,
    /^Superadmin · 1$/, /^Admin · 1$/, /^Moliya · 2$/, /^Nazoratchi · 1$/, /^Omborchi · 1$/,
    /^Operator · 13 — jamoa: nazoratchi Rustam Q\.; 12 faol, 1 bloklangan\s*Operatorlar jamoasi/,
  ]);
  await expect(row(page, 'U-0007')).toContainText('Nodira K. (siz)');
  await expect(row(page, 'U-0008')).toContainText('Parol+ ilovadagi kod');
  await expect(row(page, 'U-0008')).toContainText('Ulangan');
  await expect(row(page, 'U-0003')).toContainText('—');
  await expect(row(page, 'U-1078')).toContainText('BloklanganBlokdan chiqarish');
  await expect(row(page, 'U-2087')).toContainText('Noma’lum rolRol berish');
  await expect(page.getByText('20 ta xodim · rol bo‘yicha guruhlangan')).toBeVisible();

  // Qatorni bosish — xodim kartasi.
  await row(page, 'U-1054').click();
  await expect(page).toHaveURL(/\/admin\/users\/U-1054$/);
});

test('filtrlar: qidiruv bo‘sh, «Holat: Bloklangan», rol va kirish usuli; URL da saqlanadi', async ({ page }) => {
  await openStaff(page);
  await page.getByLabel('Xodimlarni qidirish').fill('Shoxrux');
  const empty = page.getByTestId('staff-empty');
  await expect(empty).toContainText('«Shoxrux» bo‘yicha xodim topilmadi');
  await expect(empty).toContainText('Sotuvchi va optovik — o‘z tablarida.');
  await expect(page).toHaveURL(/q=Shoxrux/);
  await empty.getByRole('button', { name: 'Qidiruvni tozalash' }).click();
  await expect(row(page, 'U-1059')).toBeVisible();

  await page.getByLabel('Xodimlarni qidirish').fill('U-1059');
  await expect(table(page).locator('tbody tr[data-testid]')).toHaveCount(1);
  await page.getByLabel('Xodimlarni qidirish').fill('');

  await page.getByLabel('Holat:').selectOption({ label: 'Bloklangan' });
  await expect(table(page).locator('tbody th[scope="colgroup"]')).toHaveText([/^Operator · 1 — bloklangan/]);
  await expect(table(page).locator('tbody tr[data-testid]')).toHaveCount(1);
  await expect(page.getByText('Bloklangan xodim tizimga kira olmaydi; sessiyasi bloklangan paytda tugagan.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Holat:')).toHaveValue('BLOCKED');
  await page.getByRole('button', { name: 'Holat filtrini tozalash' }).click();

  await page.getByLabel('Kirish:').selectOption({ label: 'Parol + ilovadagi kod' });
  await expect(table(page).locator('tbody th[scope="colgroup"]')).toHaveText([/^Superadmin/, /^Admin/, /^Moliya/]);
  await page.getByLabel('Rol:').selectOption({ label: 'Moliya' });
  await expect(table(page).locator('tbody tr[data-testid]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Filtrlarni tozalash' }).click();
  await expect(table(page).locator('tbody tr[data-testid]')).toHaveCount(20);
});

test('«Oxirgi kirish» bo‘yicha saralash — guruh ichida, yangisi tepada', async ({ page }) => {
  await openStaff(page);
  const header = table(page).getByRole('columnheader', { name: /Oxirgi kirish/ });
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  // Operatorlar — oxirgi guruh: eng oxirgi kirgan Shohruh M. (95 daqiqa oldin) tepada, eng eskisi Kamron D. — pastda.
  const codes = () => table(page).locator('tbody tr[data-testid]').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')));
  await expect.poll(async () => (await codes()).slice(-13)[0]).toBe('staff-row-U-1059');
  expect((await codes()).at(-1)).toBe('staff-row-U-1078');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(async () => (await codes()).slice(-13)[0]).toBe('staff-row-U-1078');
});

test('«Rol berish»: roli noma’lum xodimga operator roli va jamoa — banner yo‘qoladi, auditga eski va yangi', async ({ page }) => {
  await openStaff(page);
  await page.getByTestId('staff-unknown-banner').getByRole('button', { name: 'Rol berish' }).click();
  const dialog = page.getByTestId('staff-role-dialog');
  await expect(dialog).toContainText('Laylo N. ga rol berish');
  await expect(dialog).toContainText('Laylo N. · U-2087');
  await expect(dialog.getByRole('radio', { name: 'Operator' })).toBeChecked();
  await expect(dialog).toContainText('Ish joyi · Rejalashtirilgan qo‘ng‘iroqlar · Mening qo‘ng‘iroqlarim · Mening buyurtmalarim · Statistikam');
  await expect(dialog.getByLabel('Jamoa')).toHaveValue('T-1');
  await expect(dialog.getByRole('radio', { name: 'Superadmin' })).toBeDisabled();
  await expect(dialog).toContainText('faqat superadmin beradi');

  await dialog.getByRole('radio', { name: 'Nazoratchi' }).check();
  await expect(dialog).toContainText('Navbat · Lidlar · Buyurtmalar · Operatorlar · Qo‘ng‘iroq yozuvlari');
  await dialog.getByRole('radio', { name: 'Operator' }).check();
  await dialog.getByRole('button', { name: 'Rolni berish' }).click();

  await expect(page.getByText('Laylo N. ga Operator roli berildi')).toBeVisible();
  await expect(page.getByText(/Jamoa: Rustam Q\. Keyingi so‘rovda menyusi ochiladi · \d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByTestId('staff-unknown-banner')).toHaveCount(0);
  await expect(tab(page, 'Operatorlar jamoasi')).toContainText('14');
  expect(findMockUserById('U-2087')).toMatchObject({ role: 'OPERATOR_LEAD', staff: { teamId: 'T-1' } });
  expect(db.userAudit[0]).toMatchObject({ action: 'user.role.update', entityId: 'U-2087', meta: { before: { role: 'SELLER' }, after: { role: 'OPERATOR_LEAD' } } });
});

test('rolni almashtirish (qator menyusi): operator → nazoratchi, «Saqlangandan keyin», eski token bekor', async ({ page }) => {
  await openStaff(page);
  await page.getByRole('button', { name: 'Lola A. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Rolni almashtirish' }).click();
  const dialog = page.getByTestId('staff-role-dialog');
  await expect(dialog).toContainText('Lola A. · hozir: Operator. O‘zgarish audit jurnaliga yoziladi: oldin va keyin.');
  await expect(dialog).toContainText('hozirgi rol');
  await expect(dialog.getByRole('button', { name: 'Operator qilish' })).toBeDisabled();
  await dialog.getByRole('radio', { name: 'Nazoratchi' }).check();
  await expect(dialog).toContainText('Saqlangandan keyin');
  await expect(dialog).toContainText('keyingi so‘rovda yangi rol bo‘yicha ochiladi; xodim «Rolingiz o‘zgardi» xabarini ko‘radi');
  await expect(dialog).toContainText('Rustam Q. jamoasidan chiqadi');
  const versionBefore = findMockUserById('U-1054')?.authVersion ?? 0;
  await dialog.getByRole('button', { name: 'Nazoratchi qilish' }).click();
  await expect(page.getByText('Lola A. — endi Nazoratchi')).toBeVisible();
  await expect(table(page).locator('tbody th[scope="colgroup"]').filter({ hasText: /^Nazoratchi/ })).toHaveText(/^Nazoratchi · 2$/);
  expect(findMockUserById('U-1054')?.authVersion).toBe(versionBefore + 1);
});

test('bloklash: sabab majburiy, oqibatlar, toast; blokdan chiqarish — «Parolni tiklash» havolasi', async ({ page }) => {
  await openStaff(page);
  await page.getByRole('button', { name: 'Jamshid E. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Bloklash' }).click();
  const dialog = page.getByTestId('staff-block-dialog');
  await expect(dialog).toContainText('Jamshid E. ni bloklash');
  await expect(dialog).toContainText('Sessiyasi darhol tugaydi, tizimga qayta kira olmaydi.');
  await expect(dialog).toContainText('Softfon hisobi o‘chiriladi — qo‘ng‘iroq qila olmaydi.');
  await dialog.getByRole('button', { name: 'Bloklash' }).click();
  await expect(dialog).toContainText('Sababni yozing — u audit jurnaliga yoziladi');
  await dialog.getByLabel('Sabab').fill('Mehnat shartnomasi tugadi');
  await dialog.getByRole('button', { name: 'Bloklash' }).click();
  await expect(page.getByText('Jamshid E. bloklandi')).toBeVisible();
  await expect(page.getByText('Sessiyasi tugadi, softfon hisobi o‘chirildi. Audit jurnaliga yozildi.')).toBeVisible();
  await expect(row(page, 'U-1053')).toContainText('BloklanganBlokdan chiqarish');
  expect(findMockUserById('U-1053')?.staff?.block).toMatchObject({ by: 'Nodira Karimova', reason: 'Mehnat shartnomasi tugadi' });

  await row(page, 'U-1078').getByRole('button', { name: 'Blokdan chiqarish' }).click();
  await expect(page.getByText('Kamron D. blokdan chiqarildi')).toBeVisible();
  await expect(page.getByText('Eski parol bilan kira oladi.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parolni tiklash' })).toBeVisible();
  await expect(row(page, 'U-1078')).toContainText('Faol');
});

test('yopiq amallar: o‘z hisobi (K4) — rol va blok yopiq, sababi maslahatda', async ({ page }) => {
  await openStaff(page);
  await page.getByRole('button', { name: 'Nodira K. amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Bloklash' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: 'Rolni almashtirish' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Bloklash' }).getByText('Bloklash').hover();
  await expect(page.getByRole('tooltip')).toContainText('O‘zingizni bloklab bo‘lmaydi');
});

test('yopiq amallar: superadmin hisobi admin ko‘rinishida (K5) — sababi maslahatda', async ({ page }) => {
  await openStaff(page);
  await page.getByRole('button', { name: 'Akmal S. amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Parolni tiklash' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Rolni almashtirish' }).getByText('Rolni almashtirish').hover();
  await expect(page.getByRole('tooltip')).toContainText('Superadmin rolini faqat superadmin beradi va oladi.');
});

test('oxirgi superadmin o‘z rolini tushira olmaydi — oynada 409 xabari', async ({ page }) => {
  await openStaff(page, '', '900000008');
  await page.getByRole('button', { name: 'Akmal S. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Rolni almashtirish' }).click();
  const dialog = page.getByTestId('staff-role-dialog');
  await expect(dialog).toContainText('Akmal S. (siz) · U-0008');
  await expect(dialog).toContainText('Superadmin · oxirgi superadmin');
  await dialog.getByRole('radio', { name: 'Admin', exact: true }).check();
  await dialog.getByRole('button', { name: 'Rolni saqlash' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Rolni o‘zgartirib bo‘lmadi — oxirgi superadmin');
  await expect(dialog.getByRole('alert')).toContainText('Xato 409.');
  expect(findMockUserById('U-0008')?.role).toBe('SUPERADMIN');
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('«Kirish» ustuni yo‘q, gorizontal aylantirish yo‘q, izohda kirish usuli', async ({ page }) => {
    await openStaff(page);
    await expect(table(page).getByRole('columnheader', { name: 'Kirish', exact: true })).toBeHidden();
    await expect(page.getByText('Kirish usuli — xodim kartasida.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('kartalar, «Yana 9 ta operator», «Filtrlar» varag‘i va chip', async ({ page }) => {
    await openStaff(page);
    const cards = page.getByTestId('staff-cards');
    await expect(cards.getByRole('link', { name: /xodim kartasi$/ })).toHaveCount(11);
    await expect(page.getByRole('status').filter({ hasText: '11 / 20 ta xodim ko‘rsatildi' })).toBeVisible();
    await page.getByRole('button', { name: 'Yana 9 ta operator' }).click();
    await expect(cards.getByRole('link', { name: /xodim kartasi$/ })).toHaveCount(20);
    await expect(cards).toContainText('Operator · 13 — jamoa: nazoratchi Rustam Q.; 12 faol, 1 bloklangan');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.getByRole('button', { name: 'Filtrlar' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Holat').selectOption({ label: 'Bloklangan' });
    await sheet.getByRole('button', { name: '1 ta xodimni ko‘rsatish' }).click();
    await expect(page.getByRole('button', { name: 'Filtrlar 1' })).toBeVisible();
    await expect(cards.getByRole('link', { name: 'Kamron D. — xodim kartasi' })).toBeVisible();
    await page.getByRole('button', { name: 'Holat filtrini olib tashlash' }).click();
    await expect(page.getByRole('button', { name: 'Holat filtrini olib tashlash' })).toHaveCount(0);

    await page.getByTestId('staff-cards').getByRole('button', { name: 'Rol berish' }).click();
    await expect(page.getByTestId('staff-role-dialog')).toBeVisible();
  });
});
