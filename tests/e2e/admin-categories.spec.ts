import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-12 (admin-kategoriyalar): daraxt-jadval — ustama, yetkazish ko'rinishi, BAD, muddat va meros; tanlangan
 * kategoriya paneli va parametrlar tarixi; qo'shish va tahrir oynasi (slug, ota kategoriya, parametrlar, BAD va
 * muddat); o'chirish (mahsulot yoki ichki kategoriya bor — yopiq); tartib (↑ ↓, sudrash, saqlash); telefon.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function openCategories(page: Page, phone = '900000007', path = '/admin/categories') {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await page.goto(path);
  await expect(page.getByTestId('category-table')).toBeVisible();
}

const row = (page: Page, id: string) => page.locator(`[data-category-id="${id}"]`);
const panel = (page: Page) => page.getByTestId('category-panel');
const form = (page: Page) => page.getByTestId('category-form');
const menu = async (page: Page, name: string, item: string) => {
  await page.getByRole('button', { name: `${name}: amallar` }).click();
  await page.getByRole('menuitem', { name: item }).click();
};

test('jadval: global sukut, meros va panel — parametrlar, mahsulotlar, tarix', async ({ page }) => {
  await openCategories(page);
  await expect(page.getByText('Global sukut', { exact: true })).toBeVisible();
  await expect(row(page, '12')).toContainText('Qisman · 30 000 / 45 000');
  await expect(row(page, '12')).toContainText('o‘zida: eshikkacha');
  await expect(row(page, '12')).toContainText('4 mahsulot · 2 faol');
  await expect(row(page, '15')).toContainText('1 mahsulot · 1 rad etilgan');
  await expect(row(page, '15')).toContainText('otadan');
  await expect(row(page, '16')).toContainText('0 mahsulot');
  await row(page, '12').click();
  await expect(page).toHaveURL(/category=12/);
  await expect(panel(page)).toContainText('Uy-ro‘zg‘or');
  await expect(panel(page)).toContainText('Yuqori daraja · sayt menyusida 2-o‘rin');
  await expect(panel(page)).toContainText('45 000 so‘m');
  await expect(panel(page)).toContainText('Mahsulotlar · 4');
  await expect(panel(page)).toContainText('o‘z sozlamasi: alohida');
  await expect(panel(page)).toContainText('Changyutgich — alohida rejim');
  await expect(panel(page)).toContainText('50 000 so‘m');
  await expect(panel(page).getByRole('link', { name: 'To‘liq tarix' })).toHaveAttribute('href', '/admin/audit-logs?action=pricing.policy.update');
  await row(page, '15').click();
  await expect(panel(page)).toContainText('Ota kategoriya: Go‘zallik va salomatlik');
  await expect(panel(page)).toContainText('«Go‘zallik va salomatlik»dan');
  await expect(panel(page)).toContainText('sabab: Tavsifda');
});

test('qo‘shish: slug nomdan, band slug — maydon ostida, ichiga qo‘shish va BAD belgisi', async ({ page }) => {
  await openCategories(page);
  await page.getByRole('button', { name: 'Kategoriya qo‘shish' }).click();
  await form(page).getByLabel('Nomi').fill('Bolalar uchun');
  await expect(form(page).getByLabel('Slug')).toHaveValue('bolalar-uchun');
  await expect(form(page).getByRole('alert')).toContainText('Bu slug band: «Bolalar uchun» kategoriyasida');
  await form(page).getByLabel('Nomi').fill('Oziq-ovqat');
  await expect(form(page).getByText('Sayt manzilida: /katalog/oziq-ovqat')).toBeVisible();
  await form(page).getByRole('checkbox', { name: 'Yaroqlilik muddati kuzatiladi' }).check();
  await form(page).getByRole('button', { name: 'Qo‘shish' }).click();
  await expect(form(page)).toBeHidden();
  const created = db.categories.find((item) => item.name === 'Oziq-ovqat');
  expect(created).toMatchObject({ slug: 'oziq-ovqat', parentId: null, sortOrder: 4, isActive: true, expiryTracked: true, isBad: null });
  await expect(row(page, created?.id ?? '')).toContainText('o‘zida');

  await menu(page, 'Oziq-ovqat', 'Ichiga kategoriya qo‘shish');
  await expect(form(page).getByLabel('Ota kategoriya')).toHaveValue(created?.id ?? '');
  await form(page).getByLabel('Nomi').fill('Shirinliklar');
  await form(page).getByLabel('Slug').fill('shirinlik');
  await form(page).getByRole('button', { name: 'Qo‘shish' }).click();
  await expect(form(page)).toBeHidden();
  expect(db.categories.find((item) => item.name === 'Shirinliklar')).toMatchObject({ slug: 'shirinlik', parentId: created?.id, sortOrder: 0, expiryTracked: null });
  await expect(row(page, db.categories.find((item) => item.name === 'Shirinliklar')?.id ?? '')).toContainText('otadan');
});

test('tahrir: o‘zgarmaganda «Saqlash» yopiq; ota kategoriya o‘zini va avlodlarini tanlamaydi; BAD saqlanadi', async ({ page }) => {
  await openCategories(page);
  await menu(page, 'Go‘zallik va salomatlik', 'Tahrirlash');
  await expect(form(page)).toContainText('Go‘zallik va salomatlik — tahrirlash');
  await expect(form(page).getByRole('button', { name: 'Saqlash' })).toBeDisabled();
  await expect(form(page)).toContainText('Hech bir qiymat o‘zgarmagan');
  const options = form(page).getByLabel('Ota kategoriya').locator('option');
  await expect(options).toHaveCount(4);
  await expect(options.filter({ hasText: 'Biologik' })).toHaveCount(0);
  await form(page).getByRole('button', { name: 'Bekor qilish' }).click();

  await menu(page, 'Kosmetika', 'Tahrirlash');
  await form(page).getByRole('checkbox', { name: 'BAD — biologik faol qo‘shimcha' }).check();
  await form(page).getByLabel('Nomi').fill('Kosmetika va parfyumeriya');
  await form(page).getByRole('button', { name: 'Saqlash' }).click();
  await expect(form(page)).toBeHidden();
  expect(db.categories.find((item) => item.id === '16')).toMatchObject({ name: 'Kosmetika va parfyumeriya', slug: 'kosmetika-va-parfyumeriya', isBad: true });
  await expect(row(page, '16')).toContainText('Ha');
  await expect(page.getByText('«Kosmetika va parfyumeriya» saqlandi')).toBeVisible();
});

test('o‘chirish: mahsuloti yoki ichki kategoriyasi bor — yopiq; bo‘shi — tasdiq bilan', async ({ page }) => {
  await openCategories(page);
  const dialog = page.getByTestId('delete-category');
  await menu(page, 'Uy-ro‘zg‘or', 'O‘chirish');
  await expect(dialog).toContainText('Uy-ro‘zg‘orni o‘chirib bo‘lmaydi');
  await expect(dialog).toContainText('4 ta mahsulot');
  await expect(dialog).toContainText('Elektr choynak, Oshxona tarozisi, Bug‘li dazmol, Changyutgich');
  await dialog.getByRole('button', { name: 'Mahsulotlarni ochish' }).click();
  await expect(page).toHaveURL(/\/admin\/products\?category=12$/);
  await page.goBack();
  await expect(page.getByTestId('category-table')).toBeVisible();

  await menu(page, 'Go‘zallik va salomatlik', 'O‘chirish');
  await expect(dialog).toContainText('Kategoriyada mahsulot va ichki kategoriya bor');
  await expect(dialog).toContainText('1 ta mahsulot');
  await expect(dialog).toContainText('2 ta ichki kategoriya');
  await expect(dialog).toContainText('Biologik faol qo‘shimchalar, Kosmetika');
  await dialog.getByRole('button', { name: 'Yopish', exact: true }).first().click();
  await expect(dialog).toBeHidden();

  await menu(page, 'Kosmetika', 'O‘chirish');
  await expect(dialog).toContainText('Kosmetikani o‘chirasizmi?');
  await expect(dialog).toContainText('Go‘zallik va salomatlik');
  await dialog.getByRole('button', { name: 'O‘chirish', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, '16')).toHaveCount(0);
  expect(db.categories.some((item) => item.id === '16')).toBe(false);
});

test('qidiruv, ichki kategoriyalarni yopish; tartib — ↑ ↓ va sudrash, saqlash yoki bekor qilish', async ({ page }) => {
  await openCategories(page);
  await page.getByRole('button', { name: 'Go‘zallik va salomatlik: ichki kategoriyalarni yopish' }).click();
  await expect(row(page, '15')).toHaveCount(0);
  await page.getByRole('button', { name: 'Go‘zallik va salomatlik: ichki kategoriyalarni ochish' }).click();
  await expect(row(page, '15')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Kategoriya yoki slug' }).fill('biologik');
  await expect(row(page, '14')).toBeVisible();
  await expect(row(page, '15')).toBeVisible();
  await expect(row(page, '11')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Kategoriya yoki slug' }).fill('topilmaydi');
  await expect(page.getByText('Kategoriya topilmadi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Qidiruvni tozalash' }).click();

  await page.getByRole('button', { name: 'Tartibni o‘zgartirish' }).click();
  await expect(page.getByText('Global sukut', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tartibni saqlash' })).toBeDisabled();
  await page.getByRole('button', { name: 'Bolalar uchun — yuqoriga' }).click();
  await expect(page.getByText('Tartib o‘zgardi: «Bolalar uchun» 3-o‘rindan 2-o‘ringa')).toBeVisible();
  expect(db.categories.find((item) => item.id === '13')?.sortOrder).toBe(2);
  await row(page, '16').dragTo(row(page, '15'), { targetPosition: { x: 40, y: 4 } });
  await expect(page.getByTestId('category-table').locator('tbody tr[data-category-id]').nth(4)).toHaveAttribute('data-category-id', '16');
  await page.getByRole('button', { name: 'Tartibni saqlash' }).click();
  await expect(page.getByText('Tartib saqlandi')).toBeVisible();
  expect(db.categories.filter((item) => ['11', '12', '13', '14', '15', '16'].includes(item.id)).map((item) => [item.id, item.sortOrder]).sort())
    .toEqual([['11', 0], ['12', 2], ['13', 1], ['14', 3], ['15', 1], ['16', 0]]);
  await expect(page.getByRole('button', { name: 'Tartibni saqlash' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Tartibni o‘zgartirish' }).click();
  await page.getByRole('button', { name: 'Elektronika — pastga' }).click();
  await page.getByRole('button', { name: 'Bekor qilish' }).click();
  expect(db.categories.find((item) => item.id === '11')?.sortOrder).toBe(0);
  await expect(page.getByTestId('category-table').locator('tbody tr[data-category-id]').first()).toHaveAttribute('data-category-id', '11');
});

test('pul parametrlari admin uchun yopiq (o‘zgartirish — SUPERADMIN), tarif chegarasi ko‘rinadi', async ({ page }) => {
  await openCategories(page);
  await menu(page, 'Bolalar uchun', 'Tahrirlash');
  await expect(form(page)).toContainText('Pul parametrlarini superadmin o‘zgartiradi.');
  await expect(form(page).getByLabel('Ustama chegarasi')).toBeDisabled();
  await expect(form(page).getByRole('radio', { name: 'Alohida' })).toBeDisabled();
  await expect(form(page)).toContainText('Ikkala summa Elchi tarifidan oshmaydi: markazgacha 40 000, eshikkacha 60 000 so‘m.');
  await expect(form(page).getByRole('checkbox', { name: 'BAD — biologik faol qo‘shimcha' })).toBeEnabled();
});

test('SUPERADMIN parametrlarni o‘zgartiradi: bo‘sh qiymat globaldan, tarif chegarasi, tarixga yoziladi', async ({ page }) => {
  await openCategories(page, '900000008', '/admin/categories?category=13');
  await panel(page).getByRole('button', { name: 'Tahrirlash' }).click();
  await form(page).getByLabel('Ustama chegarasi').fill('15');
  await form(page).getByRole('radio', { name: 'Alohida' }).click();
  await form(page).getByLabel('Eshikkacha').fill('70000');
  await expect(form(page).getByRole('alert')).toContainText('Elchi tarifidan oshmaydi: 60 000 so‘mgacha');
  await form(page).getByLabel('Eshikkacha').fill('');
  await form(page).getByRole('button', { name: 'Saqlash' }).click();
  await expect(form(page)).toBeHidden();
  expect(db.categoryPolicies['13']).toMatchObject({ markupCapPercent: 15, deliveryMode: 'SEPARATE', visibleCenter: null, visibleAddress: null });
  await expect(row(page, '13')).toContainText('+15%');
  await expect(row(page, '13')).toContainText('Alohida');
  await expect(panel(page)).toContainText('Akmal S.');
  await expect(panel(page)).toContainText('globaldan');
  await expect(panel(page)).toContainText('+15%');
});

test('bo‘sh holat: hali kategoriya yo‘q', async ({ page }) => {
  db.categories = [];
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await page.goto('/admin/categories');
  await expect(page.getByText('Hali kategoriya yo‘q', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kategoriya qo‘shish' }).click();
  await expect(form(page)).toBeVisible();
});

for (const width of [768, 390]) {
  test(`moslashuv ${width}px: gorizontal siljish yo‘q${width < 768 ? ', telefonda kartalar → tafsilot sahifasi, tartib' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openCategories(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width >= 768) {
      await expect(page.getByRole('columnheader', { name: 'Ustama' })).toBeHidden();
      await expect(page.getByText('tanlangan: Elektronika — tafsiloti pastda')).toBeVisible();
      return;
    }
    await expect(row(page, '15')).toContainText('BAD: ha · o‘zida');
    await expect(row(page, '15')).toContainText('Muddat: ha · otadan');
    await page.getByRole('link', { name: 'Uy-ro‘zg‘or — kategoriya tafsiloti' }).click();
    await expect(page).toHaveURL(/\/admin\/categories\/12$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Uy-ro‘zg‘or' })).toBeVisible();
    await expect(panel(page)).toContainText('Eshikkacha ko‘rinadi');
    await page.getByRole('button', { name: 'Tahrirlash' }).click();
    await expect(form(page)).toBeVisible();
    await form(page).getByRole('button', { name: 'Bekor qilish' }).click();
    await page.getByRole('link', { name: 'Orqaga: Kategoriyalar' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await page.getByRole('button', { name: 'Boshqa amallar: tartibni o‘zgartirish' }).click();
    await page.getByRole('menuitem', { name: 'Tartibni o‘zgartirish' }).click();
    await page.getByRole('button', { name: 'Bolalar uchun — yuqoriga' }).click();
    await expect(row(page, '13')).toContainText('2-o‘rin, avval 3-o‘rin');
    await page.getByRole('button', { name: 'Tartibni saqlash' }).click();
    await expect.poll(() => db.categories.find((item) => item.id === '13')?.sortOrder).toBe(1);
  });
}
