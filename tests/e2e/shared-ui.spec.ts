import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function uploadThreeImages(page: Page) {
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'front.png', mimeType: 'image/png', buffer: pixel },
    { name: 'side.png', mimeType: 'image/png', buffer: pixel },
    { name: 'back.png', mimeType: 'image/png', buffer: pixel },
  ]);
}

test('ImageUpload TC1: bir nechta rasm yuklanadi va preview ochiladi', async ({ page }) => {
  await uploadThreeImages(page);

  await expect(page.getByTitle('front.png')).toBeVisible();
  await expect(page.getByTitle('side.png')).toBeVisible();
  await expect(page.getByTitle('back.png')).toBeVisible();
  await page.getByTitle('side.png').click();
  await expect(page.getByRole('img', { name: 'side.png ko‘rinishi' })).toBeVisible();
});

test('ImageUpload TC2: drag qilingan rasm tartibi state ichida saqlanadi', async ({ page }) => {
  await uploadThreeImages(page);

  const frontCard = page.getByTitle('front.png').locator('..');
  const backCard = page.getByTitle('back.png').locator('..');
  await backCard.dragTo(frontCard);
  const previewNames = await page.locator('button[title$=".png"]').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('title')),
  );
  expect(previewNames).toEqual(['back.png', 'front.png', 'side.png']);
});

test('ImageUpload TC3: tanlangan rasm cover sifatida belgilanadi', async ({ page }) => {
  await uploadThreeImages(page);

  const frontCard = page.getByTitle('front.png').locator('..');
  const sideCard = page.getByTitle('side.png').locator('..');
  await expect(frontCard.getByText('Asosiy', { exact: true })).toBeVisible();
  await sideCard.getByRole('button', { name: 'Asosiy qilish' }).click();

  await expect(sideCard.getByText('Asosiy', { exact: true })).toBeVisible();
  await expect(frontCard.getByText('Asosiy', { exact: true })).toHaveCount(0);
});

test('TC4: MoneyText 1234567 ni 1 234 567 ko‘rinishida chiqaradi', async ({
  page,
}) => {
  await expect(page.getByText('1 234 567 so‘m', { exact: true })).toBeVisible();
});
