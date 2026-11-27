import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { findMockUserById } from '../../src/mocks/fixtures/users';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-15 nazoratchi «Jamoa» (nazoratchi-jamoa + .planshet/.mobil/.holatlar; 15-qaror — asosiy variant): jamoa kartasi,
 * operatorlar hisobi, qo'shish, tahrirlash, nofaol qilish va faollashtirish, bloklash va blokdan chiqarishni so'rash,
 * o'zgarishlar tarixi. Mock: Rustam Q. (nazoratchi, U-0004) jamoasi — 13 operator, Kamron D. bloklangan.
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function signIn(page: Page, phone = '900000004') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function openTeam(page: Page) {
  await signIn(page);
  await page.goto('/supervisor/operators?tab=team');
  await expect(page.getByTestId('supervisor-team-table').or(page.getByTestId('supervisor-team-cards')).first()).toBeVisible();
}

const table = (page: Page) => page.getByTestId('supervisor-team-table');
const row = (page: Page, code: string) => page.getByTestId(`member-row-${code}`);

test('«Operatorlar» → «Jamoa»: karta (hisoblar, admin bloklagan, softfon), kim nima qiladi, operatorlar hisobi', async ({ page }) => {
  await signIn(page);
  await page.goto('/supervisor/operators');
  const tabs = page.getByRole('tablist', { name: 'Operatorlar bo‘limi' });
  await expect(tabs.getByRole('tab')).toHaveText(['Hozir', 'Hisobot', 'Jamoa', 'Quvvat rejasi']);
  await tabs.getByRole('tab', { name: 'Jamoa' }).click();
  await expect(page).toHaveURL(/\/supervisor\/operators\?tab=team$/);

  const card = page.getByTestId('supervisor-team-card');
  await expect(card.getByRole('heading', { name: 'Rustam Q. jamoasi' })).toBeVisible();
  await expect(card).toContainText('siz — nazoratchi · U-0004 · jamoa tarkibini siz yuritasiz');
  await expect(card).toContainText('Jamoada13operator');
  await expect(card).toContainText('Hisoblar12faolkira oladi va lid oladi');
  await expect(card).toContainText('Admin bloklagan1bloklanganKamron D.');
  await expect(card).toContainText('Softfon12hisob10 brauzer · 2 stol telefoni');
  await expect(card).toContainText('Siz qilasiz');
  await expect(card).toContainText('Bloklash va blokdan chiqarish — siz so‘rov yuborasiz');

  await expect(table(page).locator('tbody tr')).toHaveCount(13);
  await expect(row(page, 'U-1078')).toContainText('Bloklanganadmin bloklagan');
  await expect(row(page, 'U-1078')).toContainText('1078O‘chirilgan');
  await expect(row(page, 'U-1078').getByRole('button', { name: /^Tahrirlash/ })).toHaveCount(0);
  await expect(row(page, 'U-1059')).toContainText(/Onlayn\d{2}:\d{2} dan · suhbatda \d{2}:\d{2}/);
  await expect(row(page, 'U-1059')).not.toContainText('L-1249');
  await expect(row(page, 'U-1057')).toContainText('Stol telefoniSIP · ofis');
});

test('operator qo‘shish: band telefon — kimniki; yangi operator tepada, «Hali kirmagan», SMS ni qayta yuborish', async ({ page }) => {
  await openTeam(page);
  await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
  const dialog = page.getByTestId('member-add-dialog');
  await expect(dialog).toContainText('Rustam Q. jamoasiga · hisob, softfon va jamoa birdan ochiladi');
  await expect(dialog.getByLabel('Jamoa')).toHaveValue('Rustam Q. jamoasi');
  await expect(dialog.getByLabel('Jamoa')).toBeDisabled();
  await dialog.getByLabel('Ism').fill('Bahrom');
  await dialog.getByLabel('Familiya').fill('Olimov');
  await dialog.getByLabel('Telefon raqami').fill('900000009');
  await dialog.getByRole('button', { name: 'Operatorni qo‘shish' }).click();
  await expect(dialog).toContainText('Bu raqam bilan hisob bor: Laylo N. (U-2087). Boshqa raqam kiriting yoki admin’ga ayting.');
  await dialog.getByLabel('Telefon raqami').fill('912457013');
  await dialog.getByRole('button', { name: 'Operatorni qo‘shish' }).click();

  await expect(page.getByText('Bahrom O. qo‘shildi')).toBeVisible();
  await expect(page.getByText('Rustam Q. jamoasiga. Softfon 2088, vaqtinchalik parol SMS bilan yuborildi.')).toBeVisible();
  await expect(table(page).locator('tbody tr').first()).toContainText('Bahrom O.');
  await expect(row(page, 'U-2088')).toContainText(/Hali kirmagan\d{2}:\d{2} · Rustam Q\. qo‘shdi/);
  await expect(row(page, 'U-2088')).toContainText('2088Ulanmagan');
  await expect(page.getByText('Bahrom O. birinchi marta kirib, yangi parol o‘rnatguncha «Hali kirmagan».')).toBeVisible();
  await row(page, 'U-2088').getByRole('button', { name: 'SMS ni qayta yuborish' }).click();
  await expect(page.getByText('SMS qayta yuborildi')).toBeVisible();
  expect(findMockUserById('U-2088')?.staff?.teamId).toBe('T-1');
});

test('tahrirlash: telefon to‘liq emas — xato; familiya va ish joyi saqlanadi', async ({ page }) => {
  await openTeam(page);
  await row(page, 'U-1054').getByRole('button', { name: 'Tahrirlash: Lola A.' }).click();
  const dialog = page.getByTestId('member-edit-dialog');
  await expect(dialog).toContainText('Lola A. · Rol — Operator');
  await expect(dialog.getByLabel('Softfon hisobi')).toHaveValue('1054');
  await expect(dialog.getByLabel('Jamoa')).toHaveValue('Rustam Q. jamoasi');
  await dialog.getByLabel('Telefon raqami').fill('97825');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog).toContainText('Raqam to‘liq emas — 9 ta raqam kiriting');
  await dialog.getByLabel('Telefon raqami').fill('978254361');
  await dialog.getByLabel('Familiya').fill('Karimova');
  await dialog.getByRole('radio', { name: 'Stol telefoni (SIP)' }).check();
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Lola K. saqlandi')).toBeVisible();
  await expect(row(page, 'U-1054')).toContainText('Lola K.');
  await expect(row(page, 'U-1054')).toContainText('Stol telefoni');
  expect(db.userAudit[0]).toMatchObject({ action: 'supervisor.operator.update', entityId: 'U-1054' });
});

test('nofaol qilish: suhbatdagi operatorda yopiq; Marjona I. — sabab, nofaol, kira olmaydi; faollashtirish', async ({ page }) => {
  await openTeam(page);
  await row(page, 'U-1059').getByRole('button', { name: 'Shohruh M. amallari' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Tahrirlash', 'Hozirgi holatini ko‘rish', 'O‘zgarishlar tarixi', 'Nofaol qilish', 'Bloklashni so‘rash']);
  await expect(page.getByRole('menuitem', { name: 'Nofaol qilish' })).toHaveAttribute('aria-disabled', 'true');
  await row(page, 'U-1059').getByRole('button', { name: 'Shohruh M. amallari' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(0);

  await row(page, 'U-1055').getByRole('button', { name: 'Marjona I. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Nofaol qilish' }).click();
  const dialog = page.getByTestId('member-deactivate-dialog');
  await expect(dialog).toContainText('Marjona I. ni nofaol qilish');
  await expect(dialog).toContainText('Tizimga kira olmaydi — ochiq sessiyasi bo‘lsa, darhol tugaydi.');
  await expect(dialog).toContainText('[qayerga o‘tadi — 17-qaror]');
  await expect(dialog).toContainText('Softfon hisobi 1055 to‘xtatiladi');
  await dialog.getByRole('button', { name: 'Nofaol qilish' }).click();
  await expect(dialog).toContainText('Sababni yozing — u xodim tarixiga yoziladi');
  await dialog.getByLabel('Sabab').fill('Ta’tilga chiqdi');
  await dialog.getByRole('button', { name: 'Nofaol qilish' }).click();
  await expect(page.getByText('Marjona I. nofaol qilindi')).toBeVisible();
  await expect(page.getByText('Sessiyasi tugadi, softfon 1055 to‘xtatildi.')).toBeVisible();
  await expect(row(page, 'U-1055')).toContainText(/Nofaol\d{2}:\d{2} · Rustam Q\. · «Ta’tilga chiqdi»/);
  await expect(row(page, 'U-1055')).toContainText('1055To‘xtatilgan');
  expect(findMockUserById('U-1055')?.isActive).toBe(false);

  await row(page, 'U-1055').getByRole('button', { name: 'Faollashtirish' }).click();
  const activate = page.getByTestId('member-activate-dialog');
  await expect(activate).toContainText('eski paroli bilan kira oladi');
  await expect(activate).toContainText('1055 qayta yoqiladi');
  await activate.getByRole('button', { name: 'Faollashtirish' }).click();
  await expect(page.getByText('Marjona I. faollashtirildi')).toBeVisible();
  await expect(row(page, 'U-1055')).toContainText('Faol');
});

test('nofaol operator tizimga kira olmaydi: parol to‘g‘ri — «Hisobingiz nofaol», kim va nega', async ({ page }) => {
  const marjona = findMockUserById('U-1055');
  if (!marjona?.staff) throw new Error('U-1055 yo‘q');
  marjona.isActive = false;
  marjona.staff.inactive = { at: new Date().toISOString(), by: 'Rustam Qodirov', reason: 'Ta’tilda' };
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('911001055');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  // Taklif §14–15: login `ACCOUNT_INACTIVE` — forma o'rnida sabab (umumiy-kirish 12 uslubida).
  const card = page.getByTestId('login-lock');
  await expect(card).toContainText('Hisobingiz nofaol');
  await expect(card).toContainText('nazoratchingiz hisobingizni vaqtincha nofaol qildi');
  await expect(card.locator('dl')).toContainText(/HisobMarjona I\. · OperatorNofaol qilingan\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}SababTa’tildaSavol bo‘lsanazoratchingiz Rustam Q\./);
  await expect(page).toHaveURL(/\/login/);
});

test('bloklashni so‘rash: sabab majburiy → «Bloklash so‘ralgan», izoh; menyuda «So‘rov yuborilgan»', async ({ page }) => {
  await openTeam(page);
  await row(page, 'U-1062').getByRole('button', { name: 'Temur K. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Bloklashni so‘rash' }).click();
  const dialog = page.getByTestId('member-request-dialog');
  await expect(dialog).toContainText('Temur K. ni bloklashni so‘rash');
  await expect(dialog).toContainText(/Operator · onlayn \d{2}:\d{2} dan/);
  await dialog.getByRole('button', { name: 'So‘rov yuborish' }).click();
  await expect(dialog).toContainText('Sababni yozing — admin usiz qaror qilmaydi');
  await dialog.getByLabel('Sabab').fill('Soxta tasdiq — L-1118. Yozuvni tingladim.');
  await expect(dialog.getByRole('checkbox', { name: 'Javobgacha nofaol qilish — navbatdan lid olmaydi' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'So‘rov yuborish' }).click();
  await expect(page.getByText('So‘rov admin’ga yuborildi')).toBeVisible();
  await expect(page.getByText('Temur K. — bloklash. Javob bildirishnomada keladi.')).toBeVisible();
  await expect(row(page, 'U-1062')).toContainText(/Bloklash so‘ralgan\d{2}:\d{2} · admin ko‘rib chiqadi/);
  await expect(page.getByText('So‘rov javobini kutayotganda operator ishlayveradi.')).toBeVisible();
  await row(page, 'U-1062').getByRole('button', { name: 'Temur K. amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'So‘rov yuborilgan' })).toHaveAttribute('aria-disabled', 'true');
  expect(db.userAudit[0]).toMatchObject({ action: 'supervisor.block.request', entityId: 'U-1062' });
});

test('bloklangan: filtr «Bloklangan» — izoh; yagona amal «Blokdan chiqarishni so‘rash», o‘zgarishlar tarixi', async ({ page }) => {
  await openTeam(page);
  await page.getByLabel('Hisob:').selectOption({ label: 'Bloklangan' });
  await expect(table(page).locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText(/Kamron D\. ni admin bloklagan: \d{2}\.\d{2}\.\d{4}, sabab — «Firibgarlik tekshiruvi: soxta tasdiqlar»/)).toBeVisible();
  await row(page, 'U-1078').getByRole('button', { name: 'Kamron D. amallari' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Blokdan chiqarishni so‘rash', 'O‘zgarishlar tarixi']);
  await page.getByRole('menuitem', { name: 'O‘zgarishlar tarixi' }).click();
  const history = page.getByTestId('member-history-dialog');
  await expect(history).toContainText('Kamron D. — o‘zgarishlar tarixi');
  await expect(history).toContainText('Bloklash · U-1078');
  await history.getByRole('button', { name: 'Yopish' }).last().click();

  await row(page, 'U-1078').getByRole('button', { name: 'Kamron D. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Blokdan chiqarishni so‘rash' }).click();
  const dialog = page.getByTestId('member-request-dialog');
  await expect(dialog).toContainText('Kamron D. ni blokdan chiqarishni so‘rash');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByLabel('Sabab').fill('Tekshiruv tugadi');
  await dialog.getByRole('button', { name: 'So‘rov yuborish' }).click();
  await expect(page.getByText('Kamron D. — blokdan chiqarish. Javob bildirishnomada keladi.')).toBeVisible();
  await expect(row(page, 'U-1078')).toContainText('blokdan chiqarish so‘ralgan');
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1000 } });

  test('5 ustun: hisob · kirish, softfon · ish joyi; yorliqlar va «Operator qo‘shish» bir qatorda', async ({ page }) => {
    await openTeam(page);
    await expect(table(page).getByRole('columnheader')).toHaveText(['Operator', 'Hisob · kirish', 'Hozir', 'Softfon · ish joyi', 'Amallar']);
    await expect(row(page, 'U-1078')).toContainText('kirgan:');
    const tabsBox = await page.getByRole('tablist', { name: 'Operatorlar bo‘limi' }).boundingBox();
    const addBox = await page.getByRole('button', { name: 'Operator qo‘shish' }).boundingBox();
    expect(Math.abs((tabsBox?.y ?? 0) - (addBox?.y ?? 100))).toBeLessThan(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kartochka bosilsa — amallar varag‘i; suhbatda «Nofaol qilish» yopiq, sababi ostida; qo‘shish pastki panelda', async ({ page }) => {
    await openTeam(page);
    const cards = page.getByTestId('supervisor-team-cards');
    await expect(cards.getByRole('button', { name: 'Kamron D. — amallar' })).toContainText('admin bloklagan');
    await cards.getByRole('button', { name: 'Shohruh M. — amallar' }).click();
    const sheet = page.getByTestId('member-actions-sheet');
    await expect(sheet).toContainText(/U-1059 · Faol · Onlayn \d{2}:\d{2} dan · suhbatda/);
    await expect(sheet.getByRole('menuitem', { name: 'Nofaol qilish' })).toBeDisabled();
    await expect(sheet).toContainText('Shohruh M. hozir suhbatda (L-1249) — nofaol qilish suhbat tugagach ochiladi.');
    await sheet.getByRole('menuitem', { name: 'Tahrirlash' }).click();
    await expect(page.getByTestId('member-edit-dialog')).toBeVisible();
    await page.getByTestId('member-edit-dialog').getByRole('button', { name: 'Bekor qilish' }).click();

    await page.getByRole('button', { name: 'Operator qo‘shish' }).click();
    await expect(page.getByTestId('member-add-dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
