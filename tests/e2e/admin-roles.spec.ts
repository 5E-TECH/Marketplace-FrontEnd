import { expect, test, type Page } from '@playwright/test';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';
import { mainNav, pageTitle } from './support/shell';

/**
 * FE-15 «Rollar va ruxsatlar» (admin-rollar + .planshet/.mobil/.holatlar): faqat ko'rish — sakkiz rol (sonlar, menyu,
 * noma'lum rol), «Kim nima qila oladi» matritsasi, «o‘ziniki» maslahati, rol paneli (drawer; telefonda ichki sahifa).
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
  await expect(page).not.toHaveURL(/\/login/);
}

async function openRoles(page: Page, query = '') {
  await signIn(page);
  await page.goto(`/admin/users?tab=roles${query}`);
  await expect(page.getByTestId('roles-tab')).toBeVisible();
}

const roleRow = (page: Page, role: string) => page.getByTestId(`role-row-${role}`);
const matrix = (page: Page) => page.getByTestId('permissions-matrix');

test('sakkiz rol: faqat ko‘rish, sonlar va ismlar, menyu bandlari, noma’lum rol', async ({ page }) => {
  await openRoles(page);
  await expect(page.getByText('Rollar:', { exact: false }).first()).toContainText('faqat ko‘rish');
  await expect(page.getByRole('note')).toContainText('Admin jadvalni o‘zgartirmaydi — xodimga rolni «Xodimlar» tabida beradi.');
  await expect(page.getByRole('link', { name: 'Audit: rol va bloklash' })).toHaveAttribute('href', '/admin/audit-logs?entityType=User');

  const table = page.getByTestId('roles-table');
  await expect(table).toContainText('Platforma xodimlari · 6 rol · 20 kishi');
  await expect(table).toContainText('Tashqi foydalanuvchilar · 2 rol');
  await expect(roleRow(page, 'SUPERADMIN')).toContainText('Rahbariyat');
  await expect(roleRow(page, 'SUPERADMIN')).toContainText('superadmin uchun — [13-qaror]');
  await expect(roleRow(page, 'SUPERADMIN')).toContainText('19 bandM1 da 13');
  await expect(roleRow(page, 'SUPERADMIN')).toContainText('Akmal S.');
  await expect(roleRow(page, 'ADMIN')).toContainText('Nodira K. (siz)');
  await expect(roleRow(page, 'FINANCE')).toContainText('2Gulnora S., Ozoda B.');
  await expect(roleRow(page, 'SUPERVISOR')).toContainText('8 bandM1 da 5');
  await expect(roleRow(page, 'OPERATOR_LEAD')).toContainText('1312 faol · 1 bloklangan');
  await expect(roleRow(page, 'AFFILIATE')).toContainText('41o‘zi ro‘yxatdan o‘tadi');
  await expect(roleRow(page, 'WHOLESALER')).toContainText('Kabinet — 2-bosqich');
  await expect(roleRow(page, 'WHOLESALER')).toContainText('8 band2-bosqich');

  const unknown = page.getByTestId('role-unknown-row');
  await expect(unknown).toContainText('Noma’lum rol');
  await expect(unknown).toContainText('Laylo N. · U-2087');
  await unknown.getByRole('link', { name: 'Xodimlar tabida rol berish' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByTestId('staff-unknown-banner')).toBeVisible();
});

test('«Kim nima qila oladi»: 15 amal, superadmin hammasi, «o‘ziniki» maslahati fokusda', async ({ page }) => {
  await openRoles(page);
  await expect(matrix(page).locator('tbody tr')).toHaveCount(15);
  const header = matrix(page).locator('thead');
  await expect(header.getByRole('button', { name: /Sotuvchi/ })).toContainText('41 ta');
  await expect(header.getByRole('button', { name: /Superadmin/ })).toContainText('hamma amal');
  const settings = page.getByTestId('perm-row-settings');
  await expect(settings).toContainText('faqat superadmin o‘zgartiradi; admin — faqat ko‘radi');
  await expect(settings.getByRole('img', { name: 'ruxsat bor' })).toHaveCount(1);
  await expect(page.getByTestId('perm-row-leadReopen').getByRole('img', { name: 'ruxsat bor' })).toHaveCount(2);

  const own = page.getByTestId('perm-row-recordings').getByText('o‘ziniki');
  await own.focus();
  await expect(page.getByRole('tooltip')).toContainText('Operator faqat o‘z qo‘ng‘iroqlari yozuvini tinglaydi. Boshqasini ochsa — «Ruxsat yo‘q», urinish auditga yoziladi.');
  await expect(own).toHaveAccessibleDescription(/^Operator faqat o‘z qo‘ng‘iroqlari yozuvini tinglaydi\./);
});

test('rol paneli: ustun tanlanadi, ruxsatlar va menyu (bosqich bilan), odam va audit sanasi; «Xodimlarni ko‘rish»', async ({ page }) => {
  await openRoles(page);
  const column = matrix(page).locator('thead').getByRole('button', { name: /Nazoratchi/ });
  await column.click();
  await expect(page).toHaveURL(/tab=roles&role=SUPERVISOR/);
  await expect(column).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Nazoratchi ustuni tanlangan — 3 ruxsat')).toBeVisible();

  const panel = page.getByTestId('role-panel');
  await expect(panel.getByRole('heading', { name: 'Nazoratchi' })).toBeVisible();
  await expect(panel).toContainText('Rol paneli · faqat ko‘rish');
  await expect(panel).toContainText('Tizimdagi kodSUPERVISOR');
  await expect(panel).toContainText('Ruxsatlar · 3');
  await expect(panel).toContainText('Qo‘ng‘iroq yozuvini tinglash — hammasi');
  await expect(panel).toContainText('Menyu · 8 band');
  const menu = panel.getByRole('listitem').filter({ hasText: /^(Boshqaruv paneli|Ish joyi|Navbat|Qizil ro‘yxat)/ });
  await expect(menu).toHaveText(['Boshqaruv paneli2-bosqich', 'Ish joyiqaror kutilmoqda', 'NavbatM1', 'Qizil ro‘yxat2-bosqich']);
  await expect(panel).toContainText('Foydalanuvchilar · 1');
  await expect(panel).toContainText('Rustam Q.');
  await expect(panel).toContainText(/Rol \d{2}\.\d{2}\.\d{4} da berilgan — auditda bor\./);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/tab=roles$/);

  await column.click();
  await page.getByTestId('role-panel').getByRole('link', { name: 'Xodimlarni ko‘rish' }).click();
  await expect(page).toHaveURL(/\/admin\/users\?role=SUPERVISOR$/);
  await expect(page.getByLabel('Rol:')).toHaveValue('SUPERVISOR');
  await expect(page.getByTestId('staff-table')).toContainText('Rustam Q.');
});

test('TC1: rol panelidagi M1 bandlari — nazoratchi kirganda ko‘radigan menyu', async ({ page }) => {
  await openRoles(page, '&role=SUPERVISOR');
  const panel = page.getByTestId('role-panel');
  const current = await panel.getByRole('listitem').filter({ hasText: /M1$/ }).allTextContents();
  const expected = current.map((text) => text.replace(/M1$/, ''));
  expect(expected).toEqual(['Navbat', 'Lidlar', 'Buyurtmalar', 'Operatorlar', 'Qo‘ng‘iroq yozuvlari']);

  await page.context().clearCookies();
  await page.evaluate(() => sessionStorage.clear());
  await signIn(page, '900000004');
  await expect(mainNav(page).getByRole('link')).toHaveText(expected.map((name) => new RegExp(`^${name}`)));
});

test('«Audit: rol va bloklash» — foydalanuvchi yozuvlari bilan audit jurnali', async ({ page }) => {
  await openRoles(page);
  await page.getByRole('link', { name: 'Audit: rol va bloklash' }).click();
  await expect(page).toHaveURL(/\/admin\/audit-logs\?entityType=User$/);
  await expect(pageTitle(page)).toHaveText('Audit jurnali');
  await expect(page.getByText('user.role.update')).toBeVisible();
  await expect(page.getByText('withdrawal.approve')).toHaveCount(0);
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1000 } });

  test('rol nomi bosilsa — o‘ngda panel; amallar yonida bajaradigan rollar', async ({ page }) => {
    await openRoles(page);
    await expect(page.getByTestId('permissions-list')).toContainText('Operator · o‘ziniki');
    await expect(page.getByTestId('permissions-list')).toContainText('Optovik faqat o‘z tovari qoldig‘ini ko‘radi.');
    await page.getByRole('button', { name: 'Moliya — rol paneli' }).click();
    const panel = page.getByTestId('role-panel');
    await expect(panel).toContainText('Ruxsatlar · 1');
    await expect(panel).toContainText('Gulnora S.');
    await expect(panel).toContainText('Ozoda B.');
    await expect(panel).toContainText('Menyu · 7 band');
    await panel.getByRole('button', { name: 'Yopish' }).click();
    await expect(panel).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('rol kartasi → rol sahifasi («‹ Rollar va ruxsatlar»), operator — jami va jamoa havolasi', async ({ page }) => {
    await openRoles(page);
    const cards = page.getByTestId('roles-cards');
    await expect(cards.getByRole('link', { name: 'Superadmin: 1 — rol sahifasini ochish' })).toContainText('Parol + ilovadagi kod · 19 band, M1 da 13');
    await cards.getByRole('link', { name: 'Operator: 13 — rol sahifasini ochish' }).click();

    await expect(pageTitle(page)).toHaveText('Operator');
    const rolePage = page.getByTestId('role-page');
    await expect(rolePage).toContainText('Rol sahifasi · faqat ko‘rish');
    await expect(rolePage).toContainText('Qo‘ng‘iroq yozuvini tinglash — o‘ziniki');
    await expect(rolePage).toContainText('Operator faqat o‘z qo‘ng‘iroqlari yozuvini tinglaydi.');
    await expect(rolePage).toContainText('Foydalanuvchilar · 13');
    await expect(rolePage).toContainText('12 faol · 1 bloklangan');
    await expect(rolePage.getByRole('link', { name: 'Operatorlar jamoasi' })).toHaveAttribute('href', '/admin/users?tab=teams');
    await expect(rolePage).toContainText('Rol berish va bloklash audit jurnaliga yoziladi.');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.getByRole('link', { name: 'Orqaga: Rollar va ruxsatlar' }).click();
    await expect(page).toHaveURL(/\/admin\/users\?tab=roles$/);
    await expect(page.getByTestId('roles-cards')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
