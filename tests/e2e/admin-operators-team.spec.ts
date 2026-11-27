import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { findMockUserById } from '../../src/mocks/fixtures/users';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';
import { pageTitle } from './support/shell';

/**
 * FE-15 «Operatorlar jamoasi» (admin-operatorlar-jamoasi + .planshet/.mobil/.holatlar): jamoa kartasi, jonli holat
 * (queue-summary), softfon hisobi, ish joyi, ko'rsatkichlar davri, bronlar; oynalar — operator qo'shish, softfon,
 * jamoaga biriktirish, jamoa yaratish. Mock: Rustam Q. jamoasi, 13 operator (6 onlayn, Kamron D. bloklangan).
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

async function openTeam(page: Page, query = '') {
  await signIn(page);
  await page.goto(`/admin/users?tab=teams${query}`);
  await expect(page.getByTestId('operators-table').or(page.getByTestId('operators-cards')).first()).toBeVisible();
}

const table = (page: Page) => page.getByTestId('operators-table');
const row = (page: Page, code: string) => page.getByTestId(`operator-row-${code}`);

test('jamoa kartasi va jadval: jonli holat, softfon, ish joyi, bugungi ko‘rsatkichlar, bronlar, jami', async ({ page }) => {
  await openTeam(page);
  const card = page.getByTestId('team-card-T-1');
  await expect(card.getByRole('heading', { name: 'Rustam Q. jamoasi' })).toBeVisible();
  await expect(card).toContainText(/nazoratchi Rustam Q\. · U-0004 · bugun \d{2}:\d{2} dan tizimda/);
  await expect(card).toContainText('Jamoada13operator');
  await expect(card).toContainText('Hozir6onlayn');
  await expect(card).toContainText('Bugun312urinish');
  await expect(card).toContainText('Tasdiq foizi42%72 / 170');
  await expect(card.getByRole('img', { name: 'Operatorlar: 6 onlayn, 2 tanaffusda, 4 oflayn, 1 bloklangan' })).toBeVisible();
  await expect(card).toContainText('Lidlar jamoaga bo‘linmaydi');

  await expect(table(page).locator('tbody tr')).toHaveCount(13);
  await expect(row(page, 'U-1059')).toContainText(/Onlayn\d{2}:\d{2} dan · suhbatda \d{2}:\d{2} · L-1249/);
  await expect(row(page, 'U-1059')).toContainText('1059Ro‘yxatda');
  await expect(row(page, 'U-1059')).toContainText('Brauzer softfoniWebRTC · ofis');
  await expect(row(page, 'U-1059')).toContainText('41 · 46%tasdiq 11 / 24 · 5 daq');
  await expect(row(page, 'U-1059')).toContainText('2/5 · +4');
  await expect(row(page, 'U-1057')).toContainText('Stol telefoniSIP · ofis');
  await expect(row(page, 'U-1066')).toContainText(/Tanaffus\d{2}:\d{2} dan · 22 daq/);
  await expect(row(page, 'U-1078')).toContainText('Bloklangan');
  await expect(row(page, 'U-1078')).toContainText('1078O‘chirilgan');
  await expect(row(page, 'U-1078').getByRole('button', { name: 'Blokdan chiqarish' })).toBeVisible();
  // «bugun kirmagan» kun vaqtiga bog'liq (mock — nisbiy vaqt) — unit testda (operatorFormat.test.ts).
  await expect(row(page, 'U-1055')).toContainText('Oflayn');
  const foot = table(page).locator('tfoot');
  await expect(foot).toContainText('Jamoa · 13 operator');
  await expect(foot).toContainText('6 onlayn2 tanaffusda, 4 oflayn, 1 bloklangan');
  await expect(foot).toContainText('12 hisob faol');
  await expect(foot).toContainText('10 brauzer · 2 stol telefoni');
  await expect(foot).toContainText('312 · 42%tasdiq 72 / 170 · 5 daq');
  await expect(page.getByText('Hozir — operator holati va qachondan (real vaqtda).')).toBeVisible();
});

test('filtrlar: holat «Bloklangan» (17-qaror izohi), ish joyi, davr «Oxirgi 7 kun» va urinishlar bo‘yicha saralash', async ({ page }) => {
  await openTeam(page);
  await page.getByLabel('Holat:').selectOption({ label: 'Bloklangan' });
  await expect(page).toHaveURL(/state=BLOCKED/);
  await expect(table(page).locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('Bronlari va rejalashtirilgan qo‘ng‘iroqlari: [qayerga o‘tadi — 17-qaror].')).toBeVisible();
  await page.getByLabel('Holat:').selectOption({ label: 'Barchasi' });

  await page.getByLabel('Ish joyi:').selectOption({ label: 'Stol telefoni' });
  await expect(table(page).locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Ish joyi:').selectOption({ label: 'Barchasi' });

  await page.getByRole('radio', { name: 'Oxirgi 7 kun' }).click();
  await expect(page).toHaveURL(/period=week/);
  await expect(page.getByTestId('team-card-T-1')).toContainText('Oxirgi 7 kun');
  await expect(row(page, 'U-1059')).toContainText('212 · 46%tasdiq 57 / 124');
  await table(page).getByRole('button', { name: '7 kun' }).click();
  await expect(table(page).locator('tbody tr').first()).toContainText('Shohruh M.');
  await expect(table(page).getByRole('columnheader', { name: '7 kun' })).toHaveAttribute('aria-sort', 'descending');

  await page.getByRole('searchbox', { name: 'Operatorlarni qidirish' }).fill('zzz');
  await expect(table(page)).toContainText('Filtr bo‘yicha operator topilmadi');
});

test('operator qo‘shish: telefon majburiy; Rustam Q. jamoasiga, stol telefoni — toast va yangi qator', async ({ page }) => {
  await openTeam(page);
  await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
  const dialog = page.getByTestId('add-operator-dialog');
  await expect(dialog).toContainText('Rol — Operator. Hisob, softfon va jamoa birdan ochiladi.');
  await dialog.getByLabel('Ism').fill('Bahrom');
  await dialog.getByLabel('Familiya').fill('Olimov');
  await dialog.getByRole('button', { name: 'Operatorni qo‘shish' }).click();
  await expect(dialog).toContainText('Telefon raqamini kiriting — vaqtinchalik parol shunga boradi');
  await expect(dialog.getByLabel('Jamoa')).toHaveValue('T-1');
  await expect(dialog.getByRole('radio', { name: 'Mobil ilova' })).toBeDisabled();
  await dialog.getByRole('radio', { name: 'Stol telefoni (SIP)' }).check();
  await dialog.getByLabel('Telefon raqami').fill('912457013');
  await dialog.getByRole('button', { name: 'Operatorni qo‘shish' }).click();

  await expect(page.getByText('Bahrom O. qo‘shildi')).toBeVisible();
  await expect(page.getByText('Rustam Q. jamoasiga. Softfon 2088, vaqtinchalik parol SMS bilan yuborildi.')).toBeVisible();
  await expect(table(page).locator('tbody tr')).toHaveCount(14);
  await expect(row(page, 'U-2088')).toContainText('2088Ulanmagan');
  await expect(row(page, 'U-2088')).toContainText('Stol telefoni');
  expect(findMockUserById('U-2088')?.staff).toMatchObject({ teamId: 'T-1', workspace: 'SIP' });
});

test('softfon hisobi: operator suhbatda — sozlama suhbat tugagach; ish joyi ustunida kutilayotgan o‘zgarish', async ({ page }) => {
  await openTeam(page);
  await row(page, 'U-1059').getByRole('button', { name: 'Shohruh M. amallari' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Softfon hisobi', 'Jamoaga biriktirish', 'Xodim kartasi', 'Parolni tiklash', 'Bloklash']);
  await page.getByRole('menuitem', { name: 'Softfon hisobi' }).click();
  const dialog = page.getByTestId('softphone-dialog');
  await expect(dialog).toContainText(/Ro‘yxatda · brauzer, \d{2}:\d{2} dan/);
  await expect(dialog).toContainText('[SIP server — EQ-02]');
  await expect(dialog).toContainText('Shohruh M. hozir suhbatda');
  await expect(dialog.getByLabel('Ko‘prik raqami')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  await dialog.getByRole('radio', { name: 'Stol telefoni (SIP)' }).check();
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Softfon sozlamasi saqlandi')).toBeVisible();
  await expect(page.getByText('Shohruh M. · suhbat tugagach kuchga kiradi.')).toBeVisible();
  await expect(row(page, 'U-1059')).toContainText('suhbatdan keyin: Stol telefoni');
});

test('jamoasiz operator → «Jamoaga biriktirish»; «Jamoa yaratish» — bo‘sh nazoratchi yo‘q', async ({ page }) => {
  await openTeam(page);
  await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
  const add = page.getByTestId('add-operator-dialog');
  await add.getByLabel('Ism').fill('Bahrom');
  await add.getByLabel('Familiya').fill('Olimov');
  await add.getByLabel('Telefon raqami').fill('912457013');
  await add.getByLabel('Jamoa').selectOption({ label: 'Jamoasiz' });
  await add.getByRole('button', { name: 'Operatorni qo‘shish' }).click();
  await expect(page.getByText('Jamoasiz. Softfon 2088, vaqtinchalik parol SMS bilan yuborildi.')).toBeVisible();

  const unassigned = page.getByTestId('operators-unassigned');
  await expect(unassigned).toContainText('Jamoasiz operatorlar — 1');
  await expect(unassigned).toContainText('Bahrom O.');
  await unassigned.getByRole('button', { name: 'Jamoaga biriktirish' }).click();
  const dialog = page.getByTestId('assign-team-dialog');
  await expect(dialog).toContainText('Bahrom O. · U-2088');
  await expect(dialog).toContainText('Operator · hali kirmagan · jamoasiz');
  await expect(dialog.getByRole('radio', { name: 'Rustam Q. jamoasi' })).toBeChecked();
  await expect(dialog).toContainText('Nazoratchi Rustam Q. · bugun 6 onlayn');
  await expect(dialog).toContainText('Boshqa jamoa yo‘q.');
  await dialog.getByRole('button', { name: 'Biriktirish' }).click();
  await expect(page.getByText('Bahrom O. Rustam Q. jamoasiga biriktirildi')).toBeVisible();
  await expect(unassigned).toHaveCount(0);
  await expect(table(page).locator('tbody tr')).toHaveCount(14);

  await page.getByTestId('team-card-T-1').getByRole('button', { name: 'Jamoa yaratish' }).click();
  const team = page.getByTestId('team-supervisor-dialog');
  await expect(team).toContainText('Jamoasiz nazoratchi yo‘q.');
  await expect(team.getByRole('link', { name: 'Xodimlar tabi' })).toHaveAttribute('href', '/admin/users?role=SUPERVISOR');
});

test('bloklash oynasida operator holati va bronlar; xodim kartasida softfon va ish joyi', async ({ page }) => {
  await openTeam(page);
  await row(page, 'U-1053').getByRole('button', { name: 'Jamshid E. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Bloklash' }).click();
  const block = page.getByTestId('staff-block-dialog');
  await expect(block).toContainText(/Operator · U-1053 · tanaffusda \d{2}:\d{2} dan/);
  await expect(block).toContainText('Softfon hisobi o‘chiriladi — qo‘ng‘iroq qila olmaydi.');
  await expect(block).toContainText('Bronlar: 0 · rejalashtirilgan qo‘ng‘iroq yo‘q.');
  await block.getByRole('button', { name: 'Bekor qilish' }).click();

  await row(page, 'U-1053').getByRole('button', { name: 'Jamshid E. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Xodim kartasi' }).click();
  await expect(page).toHaveURL(/\/admin\/users\/U-1053$/);
  const card = page.getByTestId('staff-card');
  await expect(card).toContainText('Softfon hisobi1053ro‘yxatda');
  await expect(card).toContainText('Ish joyiBrauzer softfoni');
  expect(db.teams).toHaveLength(1);
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1000 } });

  test('5 ustun: ish joyi softfon ostida, onlayn — ikki qator', async ({ page }) => {
    await openTeam(page);
    await expect(table(page).getByRole('columnheader')).toHaveText(['Operator', 'Hozir', 'Softfon hisobi', 'Bugun', 'Amallar']);
    await expect(row(page, 'U-1057')).toContainText('1057Ro‘yxatdaStol telefoni');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kartochkalar → xodim kartasi; jamoa amallari ⋮; «Operator qo‘shish» pastki panelda', async ({ page }) => {
    await openTeam(page);
    const cards = page.getByTestId('operators-cards');
    const shohruh = cards.getByRole('link', { name: 'Shohruh M., Onlayn — xodim kartasi' });
    await expect(shohruh).toContainText('U-1059 · Brauzer softfoni');
    await expect(shohruh).toContainText('Softfon 1059 · ro‘yxatda');
    await expect(shohruh).toContainText('bugun 41 · 46%');
    await expect(cards.getByRole('link', { name: 'Kamron D., Bloklangan — xodim kartasi' })).toContainText('Softfon 1078 · o‘chirilgan');

    await page.getByRole('button', { name: 'Jamoa amallari' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(['Nazoratchini almashtirish', 'Jamoa yaratish']);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
    await expect(page.getByTestId('add-operator-dialog')).toBeVisible();
    await page.getByTestId('add-operator-dialog').getByRole('button', { name: 'Bekor qilish' }).click();

    await shohruh.click();
    await expect(pageTitle(page)).toHaveText('Shohruh M.');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
