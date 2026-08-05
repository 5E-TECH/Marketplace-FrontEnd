import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/shared-ui');
});

test('TC1: DataTable pagination, sort va search ishlaydi', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Item 01' })).toBeVisible();

  await page.getByTitle('2').click();
  await expect(page.getByRole('cell', { name: 'Item 11' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Item 01' })).toHaveCount(0);

  await page
    .getByPlaceholder('Test yozuvini qidirish')
    .fill('Item 07');
  await expect(page.getByRole('cell', { name: 'Item 07' })).toBeVisible();
  await page.getByPlaceholder('Test yozuvini qidirish').clear();

  await page.getByTitle('1').click();
  await page.getByRole('columnheader', { name: /Summa/ }).click();
  await page.getByRole('columnheader', { name: /Summa/ }).click();
  await expect(page.getByRole('cell', { name: 'Item 25' })).toBeVisible();

  await page
    .getByPlaceholder('Test yozuvini qidirish')
    .fill('Item 07');
  await expect(page.getByRole('cell', { name: 'Item 07' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Item 25' })).toHaveCount(0);
});

test('TC2: ConfirmDialog tasdiqlanganda callback ishlaydi', async ({ page }) => {
  await page.getByRole('button', { name: 'Tasdiqni ochish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Amal tasdiqlansinmi?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Ha' }).click();

  await expect(page.getByLabel('Tasdiqlar soni')).toHaveText('1');
  await expect(dialog).toHaveCount(0);
});

test('TC3: ImageUpload preview ko‘rsatadi va noto‘g‘ri formatni rad etadi', async ({
  page,
}) => {
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'product.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });

  await page.getByTitle('product.png').click();
  await expect(
    page.getByRole('img', { name: 'product.png ko‘rinishi' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await input.setInputFiles({
    name: 'document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByText('Faqat JPG, PNG yoki WEBP')).toBeVisible();
  await expect(page.getByTitle('document.txt')).toHaveCount(0);
});

test('TC4: MoneyText 1234567 ni 1 234 567 ko‘rinishida chiqaradi', async ({
  page,
}) => {
  await expect(page.getByText('1 234 567 so‘m', { exact: true })).toBeVisible();
});
