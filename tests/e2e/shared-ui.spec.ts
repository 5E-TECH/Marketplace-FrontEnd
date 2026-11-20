import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installMockApi } from './support/mockApi';

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
  await page.goto('/__test__/shared-ui');
});

test('TC1: DataTable pagination, sort va search ishlaydi', async ({ page }) => {
  await expect(page.getByRole('cell', { name: 'Item 01' })).toBeVisible();

  await page.getByTitle('2', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Item 11' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Item 01' })).toHaveCount(0);

  await page
    .getByPlaceholder('Test yozuvini qidirish')
    .fill('Item 07');
  await expect(page.getByRole('cell', { name: 'Item 07' })).toBeVisible();
  await page.getByPlaceholder('Test yozuvini qidirish').clear();

  await page.getByTitle('1', { exact: true }).click();
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

/* ── FE-03: umumiy vidjetlar (komponentlar-E §19–23) ─────────────────────────────── */

test('FE-03 TC1: telefon maydoni +998 niqobini qo‘yadi, noto‘g‘ri operator kodini rad etadi', async ({ page }) => {
  const card = page.locator('.ant-card', { hasText: '1. Telefon maydoni' });
  const phone = card.getByLabel('Telefon raqami');
  await expect(card.getByText('+998', { exact: true })).toBeVisible();

  await phone.pressSequentially('901234567');
  await expect(phone).toHaveValue('90 123 45 67');
  await phone.fill('+998 (90) 765-43-21');
  await expect(phone).toHaveValue('90 765 43 21');

  await phone.fill('131234567');
  await phone.blur();
  await expect(card.getByText('Bu raqam O‘zbekiston mobil operatoriga tegishli emas')).toBeVisible();
  await phone.fill('9012');
  await card.getByRole('button', { name: 'Tekshirish' }).click();
  await expect(card.getByText(/Raqamni to‘liq kiriting/)).toBeVisible();
});

test('FE-03 TC2: kaskad — viloyat tanlanmaguncha tuman yopiq, keyin tumanlar ro‘yxati chiqadi', async ({ page }) => {
  const address = page.getByTestId('address-new');
  const district = address.getByLabel('Tuman / shahar');
  await expect(district).toBeDisabled();
  await expect(address.getByText('Avval viloyatni tanlang')).toBeVisible();

  // 7 tagacha tuman — oddiy select.
  await address.getByLabel('Viloyat').selectOption({ label: 'Andijon viloyati' });
  await expect(district).toBeEnabled();
  await district.selectOption({ label: 'Asaka tumani' });
  await expect(address.getByText('SOATO bo‘yicha')).toBeVisible();

  // Viloyat almashsa tuman tozalanadi; 7 tadan ko'p — qidiruvli ro'yxat.
  await address.getByLabel('Viloyat').selectOption({ label: 'Farg‘ona viloyati' });
  const combobox = address.getByRole('combobox', { name: 'Tuman / shahar' });
  await expect(combobox).toHaveText('Tumanni tanlang');
  await combobox.click();
  const list = page.getByRole('listbox', { name: 'Tumanlar' });
  await expect(list.getByRole('option')).toHaveCount(11);
  await page.getByRole('searchbox', { name: 'Tuman qidirish' }).fill('qo‘q tum');
  await expect(page.getByRole('status').filter({ hasText: '«qo‘q tum» bo‘yicha tuman yo‘q' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Tuman qidirish' }).fill("marg'ilon");
  await page.keyboard.press('Enter');
  await expect(combobox).toHaveText('Marg‘ilon shahri');
  await expect(combobox).toBeFocused();
});

test('FE-03 TC2: tumanlar yuklanmasa — xato va «Qayta urinish»', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/regions/tree', async (route) => {
    calls += 1;
    // Birinchi so'rov va uning bitta avtomatik qayta urinishi (5xx) — xato.
    if (calls <= 2) await route.fulfill({ status: 503, json: { success: false, error: { code: 'UNAVAILABLE', message: 'Elchi javob bermadi' } } });
    else await route.fallback();
  });
  await page.reload();
  const address = page.getByTestId('address-new');
  await expect(address.getByText('Tumanlarni yuklab bo‘lmadi. «Qayta urinish»ni bosing.')).toBeVisible({ timeout: 15_000 });
  await address.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(address.getByLabel('Viloyat').locator('option', { hasText: 'Toshkent shahri' })).toHaveCount(1);
  await expect(address.getByText('Avval viloyatni tanlang')).toBeVisible();
});

test('FE-03 TC3: pul maydoni 250000 → «250 000 so‘m»', async ({ page }) => {
  const money = page.getByRole('textbox', { name: 'Summa', exact: true });
  await money.pressSequentially('250000');
  await expect(money).toHaveValue('250\u00a0000');
  await expect(page.locator('.ant-card', { hasText: '3. Pul, sana' }).getByText('so‘m').first()).toBeVisible();
  await expect(page.getByLabel('Summa qiymati')).toHaveText('250000');
  await money.fill('1 250 000 so‘m');
  await expect(money).toHaveValue('1\u00a0250\u00a0000');
});

test('FE-03 TC4: audio pleyer yozuvni oldinga va orqaga suradi', async ({ page }) => {
  const player = page.getByRole('group', { name: 'L-1276 · Rustam' });
  const timer = player.getByRole('timer');
  await expect(timer).toHaveAccessibleName('00:00 / 00:30');
  await player.getByRole('button', { name: '10 soniya oldinga' }).click();
  await expect(timer).toHaveAccessibleName('00:10 / 00:30');
  await player.getByRole('button', { name: '10 soniya oldinga' }).click();
  await expect(timer).toHaveAccessibleName('00:20 / 00:30');
  await player.getByRole('button', { name: '10 soniya orqaga' }).click();
  await expect(timer).toHaveAccessibleName('00:10 / 00:30');
  await player.getByRole('slider', { name: 'Yozuv joyi' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(timer).toHaveAccessibleName(/00:0\d \/ 00:30/);
  await expect(page.getByText('Yozuv o‘chirilgan — 90 kun saqlanadi')).toBeVisible();
  await expect(page.getByText('Yozuv topilmadi — hisobotda xato')).toBeVisible();
});

test('FE-03 TC5: mijoz yozgan manzil belgisi tahrirdan keyin «Operator tuzatdi» ga o‘tadi', async ({ page }) => {
  const address = page.getByTestId('address-lead');
  const badge = address.getByTestId('address-provenance');
  await expect(badge).toHaveText('Mijoz yozgan');
  await expect(address.getByRole('combobox', { name: 'Tuman / shahar' })).toHaveText('Qo‘qon shahri');
  await expect(address.getByLabel('Ko‘cha, uy')).toHaveValue('Navoiy ko‘chasi, 12-uy');

  await address.getByLabel('Xonadon, mo‘ljal').fill('3-xonadon');
  await expect(badge).toHaveText('Operator tuzatdi');
  await address.getByLabel('Xonadon, mo‘ljal').fill('');
  await expect(badge).toHaveText('Mijoz yozgan');

  await address.getByLabel('Ko‘cha, uy').fill('');
  await expect(badge).toHaveText('Operator tuzatdi');
});

test('FE-03: grafik — son har ustun ustida, legenda jami, «Grafik / Jadval» almashtirgichi', async ({ page }) => {
  const card = page.locator('.ant-card', { hasText: '5. Grafik' });
  const chart = card.getByRole('img', { name: /^Kunlar bo‘yicha: lidlar, tasdiqlangan, yetkazilgan\. 08\.01: 10, 5, 0;/ });
  await expect(chart).toBeVisible();
  await expect(card.getByRole('img', { name: /^Kliklar, kunlar bo‘yicha\. 08\.01: 120;/ })).toBeVisible();
  await expect(card.getByText('Statistika hali yo‘q')).toBeVisible();
  await expect(card.getByRole('status').filter({ hasText: 'Yuklanmoqda…' })).toBeVisible();

  const toggle = card.getByRole('radiogroup', { name: 'Ko‘rinish' });
  await toggle.getByRole('radio', { name: 'Grafik' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(toggle.getByRole('radio', { name: 'Jadval' })).toHaveAttribute('aria-checked', 'true');
  await expect(chart).toHaveCount(0);
});

test('FE-03: telefonda grafik bitta ko‘rsatkich, holat belgilari so‘z bilan', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const card = page.locator('.ant-card', { hasText: '5. Grafik' });
  const metric = card.getByRole('radiogroup', { name: 'Ko‘rsatkich' });
  await expect(metric.getByRole('radio', { name: 'Lidlar' })).toHaveAttribute('aria-checked', 'true');
  await metric.getByRole('radio', { name: 'Yetkazilgan' }).click();
  await expect(card.getByText('Jami, 7 kun')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await expect(page.getByTestId('status-lead').getByText('Yangi')).toBeVisible();
  await expect(page.getByTestId('status-price')).toContainText('Qizil');
});
