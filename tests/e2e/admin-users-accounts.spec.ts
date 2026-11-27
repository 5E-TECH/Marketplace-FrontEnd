import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { findMockUserById } from '../../src/mocks/fixtures/users';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-15 «Sotuvchilar» va «Optoviklar» yorliqlari (admin-foydalanuvchilar.holatlar «Tablar»): hisob ko'rinishi —
 * holat va jazo, sahifalash, filtr va qidiruv (sahifa kodi ham), bloklash, «Nomidan kirish» (faqat superadmin).
 * Mock: 41 sotuvchi (Ilhom B. — haqi ushlangan, Diyor S. — ogohlantirilgan, Bobur Y. — bloklangan), 1 optovik hisobi.
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

const tab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Foydalanuvchilar bo‘limi' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const sellers = (page: Page) => page.getByTestId('sellers-table');
const sellerRow = (page: Page, name: string) => sellers(page).getByRole('row').filter({ hasText: name });

async function openSellers(page: Page, phone?: string, query = '') {
  await signIn(page, phone);
  await page.goto(`/admin/users?tab=affiliates${query}`);
  await expect(sellers(page).or(page.getByTestId('sellers-cards')).first()).toBeVisible();
}

test('«Sotuvchilar»: 41 ta hisob, oxirgi kirish bo‘yicha, holat va jazo sanasi, sahifalash', async ({ page }) => {
  await openSellers(page);
  await expect(tab(page, 'Sotuvchilar')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sotuvchilar')).toContainText('41');
  await expect(tab(page, 'Optoviklar')).toContainText('1');
  await expect(page.getByText('Bu tabda — hisob: kirish, holat, bloklash.')).toBeVisible();
  await expect(page.getByRole('link', { name: '«Sotuvchilar» bo‘limi' })).toHaveAttribute('href', '/admin/sellers');

  const rows = sellers(page).locator('tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Jasur T.');
  await expect(rows.first()).toContainText('2 sahifa');
  await expect(rows.first()).toContainText('Telefon va SMS kod');
  await expect(sellers(page).getByRole('columnheader', { name: 'Oxirgi kirish' })).toHaveAttribute('aria-sort', 'descending');
  await expect(sellerRow(page, 'Ilhom B.')).toContainText(/Haqi ushlangan\d{2}\.\d{2}\.\d{4} dan/);
  await expect(sellerRow(page, 'Diyor S.')).toContainText('Ogohlantirilgan');
  await expect(sellerRow(page, 'Bobur Y.')).toContainText('1 sahifa to‘xtatilgan');
  await expect(sellerRow(page, 'Bobur Y.')).toContainText('Bloklangan');
  await expect(sellerRow(page, 'Jasur T.').getByRole('link', { name: 'Sotuvchi kartasi' })).toHaveAttribute('href', '/admin/sellers');

  await expect(page.getByText('/ 41 ta sotuvchi')).toBeVisible();
  await page.getByRole('button', { name: '2-sahifa' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(10);
  await expect(sellers(page)).not.toContainText('Jasur T.');
  await page.getByRole('button', { name: '5-sahifa' }).click();
  await expect(rows).toHaveCount(1);
});

test('«Sotuvchilar»: holat filtri, sahifa kodi bo‘yicha qidiruv va bo‘sh natija', async ({ page }) => {
  await openSellers(page);
  const rows = sellers(page).locator('tbody tr');

  await page.getByLabel('Holat:').selectOption({ label: 'Haqi ushlangan' });
  await expect(page).toHaveURL(/status=HOLD/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Ilhom B.');
  await page.getByLabel('Holat:').selectOption({ label: 'Bloklangan' });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Bobur Y.');
  await page.getByLabel('Holat:').selectOption({ label: 'Faol' });
  await expect(rows).toHaveCount(10);
  await expect(sellers(page)).not.toContainText('Ilhom B.');
  await expect(page.getByText('/ 38 ta sotuvchi')).toBeVisible();
  await page.getByLabel('Holat:').selectOption({ label: 'Barchasi' });

  const search = page.getByRole('searchbox', { name: 'Sotuvchilarni qidirish' });
  await search.fill('y3m9lc');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Diyor S.');
  await search.fill('Shoxrux');
  await expect(page.getByTestId('sellers-empty')).toContainText('«Shoxrux» bo‘yicha sotuvchi topilmadi');
  await page.getByTestId('sellers-empty').getByRole('button', { name: 'Filtrlarni tozalash' }).click();
  await expect(rows).toHaveCount(10);
});

test('sotuvchini bloklash: sotuvchi oqibatlari, sahifalar to‘xtaydi; blokdan chiqarish — SMS bilan, parolsiz', async ({ page }) => {
  await openSellers(page);
  await sellerRow(page, 'Bekzod M.').getByRole('button', { name: 'Bekzod M. amallari' }).click();
  // Admin «Nomidan kirish» ni ko'rmaydi — faqat superadmin.
  await expect(page.getByRole('menuitem', { name: 'Nomidan kirish' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Bloklash' }).click();

  const dialog = page.getByTestId('staff-block-dialog');
  await expect(dialog).toContainText('Xavfli amal: sotuvchi ishini darhol to‘xtatadi.');
  await expect(dialog).toContainText('Sahifalari to‘xtatiladi — yangi buyurtma qabul qilmaydi.');
  await expect(dialog).not.toContainText('Softfon');
  await dialog.getByLabel('Sabab').fill('Soxta lidlar');
  await dialog.getByRole('button', { name: 'Bloklash' }).click();
  await expect(page.getByText('Bekzod M. bloklandi')).toBeVisible();
  await expect(page.getByText('Sessiyasi tugadi, sahifalari to‘xtatildi.')).toBeVisible();
  await expect(sellerRow(page, 'Bekzod M.')).toContainText('Bloklangan');
  await expect(sellerRow(page, 'Bekzod M.')).toContainText('1 sahifa to‘xtatilgan');
  expect(findMockUserById('U-0105')?.isBlocked).toBe(true);
  expect(db.userAudit[0]).toMatchObject({ action: 'user.block', entityId: 'U-0105' });

  await sellerRow(page, 'Bekzod M.').getByRole('button', { name: 'Bekzod M. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Blokdan chiqarish' }).click();
  await expect(page.getByText('Bekzod M. blokdan chiqarildi')).toBeVisible();
  await expect(page.getByText('Telefon va SMS kod bilan qayta kira oladi.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parolni tiklash' })).toHaveCount(0);
  await expect(sellerRow(page, 'Bekzod M.')).toContainText('Faol');
});

test('superadmin sotuvchi nomidan kiradi: tasdiq, kabinet va «Chiqish» — «Sotuvchilar» yorlig‘iga qaytadi', async ({ page }) => {
  await openSellers(page, '900000008');
  await sellerRow(page, 'Jasur T.').getByRole('button', { name: 'Jasur T. amallari' }).click();
  await page.getByRole('menuitem', { name: 'Nomidan kirish' }).click();

  const dialog = page.getByTestId('staff-impersonate-dialog');
  await expect(dialog).toContainText('Jasur T. nomidan kirilsinmi?');
  await expect(dialog).toContainText('15 daqiqa');
  await dialog.getByRole('button', { name: 'Nomidan kirish' }).click();

  await expect(page).toHaveURL(/\/affiliate/);
  const banner = page.getByTestId('impersonation-banner');
  await expect(banner).toContainText('Siz Jasur Toshmatov nomidan ko‘ryapsiz');
  expect(db.userAudit[0]).toMatchObject({ action: 'user.impersonate', entityId: 'U-0001' });

  await banner.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/admin\/users\?tab=affiliates$/);
  await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
  await expect(sellers(page)).toBeVisible();
});

test('bloklangan sotuvchi nomidan kirib bo‘lmaydi — menyuda yo‘q', async ({ page }) => {
  await openSellers(page, '900000008');
  await sellerRow(page, 'Bobur Y.').getByRole('button', { name: 'Bobur Y. amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Blokdan chiqarish' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Nomidan kirish' })).toHaveCount(0);
});

test('«Optoviklar»: kabinet hisobi — kim kiradi, kabinet ochilgan, karta va bo‘lim havolasi', async ({ page }) => {
  await signIn(page, '900000008');
  await page.goto('/admin/users?tab=wholesalers');
  const table = page.getByTestId('wholesaler-accounts-table');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('Namuna Savdo MChJ');
  await expect(table).toContainText('STIR 307418562');
  await expect(table).toContainText('Nazarov Botir Akmalovich');
  await expect(table).toContainText('rahbar · +998 99 214 36 58');
  await expect(table).toContainText('Faol');
  await expect(page.getByText('Optovik hisobini admin «Optoviklar» bo‘limida ochadi')).toBeVisible();
  await expect(page.getByRole('link', { name: '«Optoviklar» bo‘limi' })).toHaveAttribute('href', '/admin/wholesalers');

  await table.getByRole('button', { name: 'Namuna Savdo MChJ amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Nomidan kirish' })).toBeVisible();
  await page.keyboard.press('Escape');
  await table.getByRole('link', { name: 'Optovik kartasi' }).click();
  await expect(page).toHaveURL(/\/admin\/wholesalers\/[^/]+$/);
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1000 } });

  test('jadvallar o‘z ichida suriladi — sahifa gorizontal skrollsiz (yashirin «Amallar» sarlavhasi ham)', async ({ page }) => {
    await signIn(page);
    for (const tabName of ['staff', 'affiliates', 'wholesalers', 'teams', 'roles']) {
      await page.goto(`/admin/users?tab=${tabName}`);
      await expect(page.locator('main table').first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { message: tabName }).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('«Sotuvchilar» kartochkalari: holat qatori, «Yana 10 ta», Filtrlar oynasi va chip', async ({ page }) => {
    await openSellers(page);
    const cards = page.getByTestId('sellers-cards');
    await expect(cards.getByRole('listitem')).toHaveCount(10);
    await expect(cards.getByRole('link', { name: 'Ilhom B. — sotuvchi kartasi' })).toContainText(/haqi ushlangan \d{2}\.\d{2}\.\d{4} dan/);
    await expect(cards.getByRole('link', { name: 'Bobur Y. — sotuvchi kartasi' })).toContainText('1 sahifa to‘xtatilgan · oxirgi kirish');
    await expect(page.getByRole('status').filter({ hasText: '10 / 41 ta sotuvchi ko‘rsatildi' })).toBeVisible();
    await page.getByRole('button', { name: 'Yana 10 ta sotuvchi' }).click();
    await expect(cards.getByRole('listitem')).toHaveCount(20);

    await page.getByRole('button', { name: 'Filtrlar' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtrlar' });
    await sheet.getByLabel('Holat').selectOption({ label: 'Ogohlantirilgan' });
    await sheet.getByRole('button', { name: '1 ta sotuvchini ko‘rsatish' }).click();
    await expect(cards.getByRole('listitem')).toHaveCount(1);
    await expect(cards).toContainText('Diyor S.');
    await page.getByRole('button', { name: 'Holat filtrini olib tashlash' }).click();
    await expect(cards.getByRole('listitem')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('«Optoviklar» kartochkasi: STIR, rahbar, kabinet qatori', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/users?tab=wholesalers');
    const card = page.getByTestId('wholesaler-accounts-cards').getByRole('link', { name: 'Namuna Savdo MChJ — optovik kartasi' });
    await expect(card).toContainText('STIR 307418562 · Telefon va SMS kod');
    await expect(card).toContainText('Nazarov Botir Akmalovich · rahbar');
    // Faollik fixture'da «N daqiqa oldin»: yarim tundan keyin — kechagi sana.
    await expect(card).toContainText(/kabinet .+ · faollik (bugun|\d{2}\.\d{2}), \d{2}:\d{2}/);
    await expect(page.getByText('1 / 1 ta optovik — hammasi ko‘rsatildi')).toBeVisible();
  });
});
