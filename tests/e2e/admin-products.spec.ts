import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-12 (admin-mahsulotlar): yorliqlar, filtrlar, jadval, qator menyusi — sotuvchi sifatida ko'rish,
 * sabab bilan to'xtatish va sotuvga qaytarish; telefonda kartalar.
 */
test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

async function openProducts(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await page.goto('/admin/products');
  await expect(page.getByTestId('product-row').first()).toBeVisible();
}

const row = (page: Page, name: string) => page.getByTestId('product-row').filter({ hasText: name });

test('jadval: holatlar bo‘yicha tartib, narx, qoldiq, natija va rad sababi', async ({ page }) => {
  await openProducts(page);
  await expect(page.getByRole('tab', { name: /Hammasi\s*10/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('product-row').first()).toContainText('Ko‘rib chiqilmoqda');
  await expect(row(page, 'Simsiz quloqchinlar')).toContainText('262 000 so‘m');
  await expect(row(page, 'Simsiz quloqchinlar')).toContainText('omborda 128 · band 8');
  await expect(row(page, 'Simsiz quloqchinlar')).toContainText('240 lid · EPC 1 393 so‘m');
  await expect(row(page, 'Bug‘li dazmol')).toContainText('221 000 so‘m tavsiya');
  await expect(row(page, 'Bolalar termos shishasi')).toContainText('Qoldiq tugagan');
  await expect(page.getByText(/Sabab \(Nodira K\., .*\): Tavsifda «uyquni davolaydi»/)).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Bolalar termos shishasi — qoldiq tugadi' })).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Bug‘li dazmol moderatsiyada' })).toBeVisible();
});

test('filtrlar: yorliq, qidiruv, kanal va «Qoldiq 0» URL da saqlanadi', async ({ page }) => {
  await openProducts(page);
  await page.getByRole('tab', { name: /Rad etildi/ }).click();
  await expect(page).toHaveURL(/tab=REJECTED/);
  await expect(page.getByTestId('product-row')).toHaveCount(1);
  await page.getByRole('tab', { name: /Hammasi/ }).click();
  await page.getByLabel('Nomi yoki slug').fill('choy');
  await expect(page.getByTestId('product-row')).toHaveCount(1);
  await page.getByLabel('Nomi yoki slug').fill('blender');
  await expect(page.getByTestId('products-empty')).toContainText('«blender» bo‘yicha mahsulot topilmadi');
  await page.getByRole('button', { name: 'Tozalash' }).click();
  await page.getByRole('button', { name: /Qoldiq 0/ }).click();
  await expect(page).toHaveURL(/attention=OUT_OF_STOCK/);
  await expect(page.getByTestId('product-row')).toHaveCount(1);
  await expect(page.getByTestId('product-row')).toContainText('Bolalar termos shishasi');
  await page.reload();
  await expect(page.getByRole('button', { name: /Qoldiq 0/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Qoldiq 0/ }).click();
  await page.getByLabel('Kanal').selectOption('site');
  await expect(page.getByTestId('products-empty')).toBeVisible();
});

test('qator menyusi: sotuvchi sifatida ko‘rish — karta va nega katalogda ko‘rinmasligi', async ({ page }) => {
  await openProducts(page);
  await row(page, 'Elektr ustara').getByRole('button', { name: 'Elektr ustara: amallar' }).click();
  await page.getByRole('menuitem', { name: 'Sotuvchi sifatida ko‘rish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sotuvchi sifatida ko‘rish' });
  await expect(dialog.getByTestId('offer-card')).toContainText('Elektr ustara');
  await expect(dialog.getByText('Nega katalogda ko‘rinmaydi')).toBeVisible();
  await expect(dialog.getByText('Video yo‘q')).toBeVisible();
  await dialog.getByRole('button', { name: 'Yopish' }).click();

  await row(page, 'Simsiz quloqchinlar').getByRole('button', { name: /amallar/ }).click();
  await page.getByRole('menuitem', { name: 'Sotuvchi sifatida ko‘rish' }).click();
  await expect(page.getByRole('dialog', { name: 'Sotuvchi sifatida ko‘rish' }).getByText('Nega katalogda ko‘rinadi')).toBeVisible();
});

test('to‘xtatish: sabab majburiy, «To‘xtatilgan» yorlig‘ida sabab bilan, sotuvga qaytarish', async ({ page }) => {
  await openProducts(page);
  await row(page, 'Aqlli soat').getByRole('button', { name: /amallar/ }).click();
  await page.getByRole('menuitem', { name: 'To‘xtatish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Aqlli soatni to‘xtatasizmi?' });
  await expect(dialog).toContainText('Band 8 dona va yo‘ldagi posilkalar');
  await dialog.getByRole('button', { name: 'To‘xtatish' }).click();
  await expect(dialog.getByLabel(/Sabab/)).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel(/Sabab/).fill('Sertifikat muddati tugagan');
  await dialog.getByRole('button', { name: 'To‘xtatish' }).click();
  await expect(page.getByText('Aqlli soat to‘xtatildi')).toBeVisible();
  expect(db.adminProducts.find((product) => product.id === '505')).toMatchObject({ isBlocked: true, blockReason: 'Sertifikat muddati tugagan' });

  await page.getByRole('tab', { name: /To‘xtatilgan\s*1/ }).click();
  await expect(row(page, 'Aqlli soat')).toContainText('To‘xtatilgan');
  await expect(page.getByText(/To‘xtatish sababi \(Nodira K\., .*\): Sertifikat muddati tugagan/)).toBeVisible();
  await row(page, 'Aqlli soat').getByRole('button', { name: /amallar/ }).click();
  await page.getByRole('menuitem', { name: 'Sotuvga qaytarish' }).click();
  await expect(page.getByText('Aqlli soat sotuvga qaytarildi')).toBeVisible();
  await expect(page.getByTestId('products-empty')).toContainText('To‘xtatilgan mahsulot yo‘q');
});

test('planshet va telefon: 3 ustunli jadval, telefonda kartalar va «Filtrlar» varag‘i', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await openProducts(page);
  await expect(page.getByRole('columnheader', { name: 'Mahsulot · holat' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Natija' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtrlar' }).click();
  await page.getByRole('dialog', { name: 'Filtrlar' }).getByLabel('Kategoriya').selectOption({ label: 'Elektronika' });
  await page.getByRole('dialog', { name: 'Filtrlar' }).getByRole('button', { name: /ta mahsulotni ko‘rsatish/ }).click();
  await expect(page.getByTestId('product-row')).toHaveCount(3);
  await page.getByRole('link', { name: 'Simsiz quloqchinlar' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/501$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
