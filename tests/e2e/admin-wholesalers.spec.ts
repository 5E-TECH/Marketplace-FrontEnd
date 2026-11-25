import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/mocks/db';
import type { MockInboundWholesaler } from '../../src/mocks/fixtures/inbound';
import { openStaffLogin } from './support/auth';
import { installMockApi } from './support/mockApi';

/**
 * FE-25: «Optoviklar» ro'yxati (admin-optoviklar). Mock: Namuna Savdo MChJ (shartnoma, kabinet faol, 206 dona),
 * Namuna Farm MChJ (shartnoma, kabinetsiz), Barakat Uy Jihozlari MChJ (shartnomasiz — mahsulot yopiq, TC3).
 */
test.use({ viewport: { width: 1440, height: 1000 } });

test.beforeEach(async ({ context }) => {
  await installMockApi(context);
});

const rows = (page: Page) => page.getByTestId('wholesaler-row');
const statusTab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Optovik holatlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });
const pageTab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Optoviklar bo‘limlari' }).getByRole('tab', { name: new RegExp(`^${name}`) });

async function signIn(page: Page) {
  await page.goto('/login');
  await openStaffLogin(page);
  await page.getByLabel('Telefon raqami').fill('900000007');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\//);
}

async function openList(page: Page, query = '') {
  await signIn(page);
  await page.goto(`/admin/wholesalers${query}`);
}

/** Dizayndagi qator holatlari uchun: M2 arizasi (Tekshiruvda) va to'xtatilgan optovik — test jarayonidagi mock bazaga. */
function addSampleWholesalers() {
  const base = db.inbound.wholesalers[0];
  const sample = (patch: Partial<MockInboundWholesaler>): MockInboundWholesaler => ({ ...base, cabinet: null, contractFile: null, contractVersion: null, contractAcceptedAt: null, ...patch });
  db.inbound.wholesalers.push(
    sample({ id: '10', name: 'Rahimova Dilfuza YaTT', tin: '412563098', status: 'PENDING', legalType: 'SOLE_PROPRIETOR', ownerUserId: 'U-0910', contractVersion: '1.0', contractAcceptedAt: '2027-01-13T05:00:00.000Z', createdAt: '2027-01-13T05:00:00.000Z' }),
    sample({ id: '11', name: 'Mega Trade Plus MChJ', tin: '306998214', status: 'SUSPENDED', statusChangedAt: '2027-01-12T05:00:00.000Z', createdAt: '2026-12-01T05:00:00.000Z' }),
  );
}

test('ro‘yxat: 4 ko‘rsatkich ombor bilan bir xil, qatorlar, «Diqqat talab qiladi» va qadamlar', async ({ page }) => {
  await openList(page);
  const kpis = page.getByTestId('wholesaler-kpis');
  await expect(kpis).toContainText('Omborda206 dona');
  await expect(kpis).toContainText('191 sotuvga tayyor · 15 bandda');
  await expect(kpis).toContainText('Qabul kutilmoqda3 postavka');
  await expect(kpis).toContainText('210 dona · P-0111, P-0112, P-0113');
  await expect(kpis).toContainText('20 080 000 so‘m');
  await expect(rows(page)).toHaveCount(3);
  const namuna = rows(page).filter({ hasText: 'Namuna Savdo MChJ' });
  await expect(namuna).toContainText('STIR 307418562');
  await expect(namuna).toContainText('Imzolangan');
  await expect(namuna).toContainText('kabinet faol');
  await expect(namuna).toContainText('3 ta kutilmoqda');
  await expect(namuna).toContainText('P-0098: 2 ta brak');
  const attention = page.getByTestId('wholesaler-attention');
  await expect(attention).toContainText('Bolalar termos shishasi — qoldiq tugagan');
  await expect(attention).toContainText('AS-0001 akt-sverka — «Tayyor»');
  await expect(page.getByRole('heading', { name: 'Optovik qanday ishga tushadi' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Optovik qo‘shish' })).toHaveAttribute('href', '/admin/wholesalers/new');
});

test('TC3 (ro‘yxat): shartnomasiz optovik — «Yo‘q · mahsulot yopiq», menyuda mahsulot va postavka yopiq', async ({ page }) => {
  await openList(page);
  const barakat = rows(page).filter({ hasText: 'Barakat Uy Jihozlari MChJ' });
  await expect(barakat).toContainText('Yo‘q');
  await expect(barakat).toContainText('mahsulot yopiq');
  await expect(barakat).toContainText('shartnomadan keyin');
  await barakat.getByRole('button', { name: 'Barakat Uy Jihozlari MChJ amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Mahsulot qo‘shish — nomidan' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: 'Postavka arizasi — nomidan' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: 'Kartani ochish' })).not.toHaveAttribute('aria-disabled', 'true');
});

test('qator menyusi: kabinet faol — taklif yopiq; «Postavka arizasi — nomidan» shu optovik bilan formani ochadi', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'Namuna Savdo MChJ amallari' }).click();
  await expect(page.getByRole('menuitem', { name: 'Kabinetga taklifni qayta yuborish' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Postavka arizasi — nomidan' }).click();
  await expect(page).toHaveURL(/tab=shipments.*wholesaler=7|wholesaler=7.*tab=shipments/);
  await expect(page.getByTestId('declare-form').getByRole('combobox', { name: /Optovik/ })).toHaveValue('7');
});

test('filtrlar: qidiruv + «Shartnoma: Imzolangan» — bo‘sh qator va tozalash; holat yorliqlari sonlari', async ({ page }) => {
  addSampleWholesalers();
  await openList(page);
  await expect(statusTab(page, 'Hammasi')).toContainText('5');
  await expect(statusTab(page, 'Tekshiruvda')).toContainText('1');
  await expect(statusTab(page, 'To‘xtatilgan')).toContainText('1');
  const suspended = rows(page).filter({ hasText: 'Mega Trade Plus MChJ' });
  await expect(suspended).toContainText('To‘xtatilgan');
  await expect(suspended).toContainText('12.01.2027');
  await expect(suspended).toContainText('kabinet yopiq');
  const pending = rows(page).filter({ hasText: 'Rahimova Dilfuza YaTT' });
  await expect(pending).toContainText('ariza bilan');
  await expect(pending.getByRole('link', { name: 'Arizani ko‘rish' })).toHaveAttribute('href', '/admin/wholesalers/10');

  await page.getByLabel('Optoviklarni qidirish').fill('Barakat');
  await page.getByLabel('Shartnoma:').selectOption('SIGNED');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText('«Barakat» bo‘yicha shartnomasi imzolangan optovik topilmadi.')).toBeVisible();
  await expect(page.getByText('0 ta optovik · filtr: «Barakat», shartnoma imzolangan')).toBeVisible();
  await page.getByRole('button', { name: 'Filtrlarni tozalash' }).first().click();
  await expect(rows(page)).toHaveCount(5);
  // Kabinetsiz: Namuna Farm va Barakat (to'xtatilgan Mega Trade kabineti bor — yopiq).
  await page.getByLabel('Kabinet:').selectOption('NONE');
  await expect(rows(page)).toHaveCount(2);

  await pageTab(page, 'Yangi arizalar').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Rahimova Dilfuza YaTT');
});

test('holatlar: optovik yo‘q — yagona amal bo‘sh holat ichida; ro‘yxat yuklanmasa — xato va qayta urinish', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/v1/admin/wholesalers?*', (route) => route.fulfill({ json: { statusCode: 200, message: 'OK', data: { items: [], total: 0, page: 1, limit: 100, totalPages: 0 } } }));
  await page.goto('/admin/wholesalers');
  const empty = page.getByTestId('wholesalers-empty');
  await expect(empty).toContainText('Hali optovik yo‘q');
  await expect(empty.getByRole('link', { name: 'Optovik qo‘shish' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Postavka arizasi' })).toHaveCount(0);
  await expect(page.getByTestId('wholesaler-kpis')).toHaveCount(0);
  await expect(pageTab(page, 'Optoviklar')).toContainText('0');

  await page.unroute('**/api/v1/admin/wholesalers?*');
  await page.route('**/api/v1/admin/wholesalers?*', (route) => route.fulfill({ status: 500, json: { statusCode: 500, message: 'Xato', errorCode: 'INTERNAL_ERROR', requestId: 'req-77' } }));
  await page.reload();
  const error = page.getByTestId('load-error');
  await expect(error).toContainText('Optoviklar ro‘yxati');
  await expect(error).toContainText('Optoviklar, shartnomalar va postavkalar o‘zgarmagan — faqat ro‘yxat ochilmadi.');
  await page.unroute('**/api/v1/admin/wholesalers?*');
  await error.getByRole('button', { name: 'Qayta urinish' }).click();
  await expect(rows(page)).toHaveCount(3);
});

test('«Postavka arizasi» — «Postavkalar» yorlig‘ida e’lon formasi; qator bosilsa optovik kartasi', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'Postavka arizasi' }).click();
  await expect(pageTab(page, 'Postavkalar')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('declare-form')).toBeVisible();
  await pageTab(page, 'Optoviklar').click();
  await rows(page).filter({ hasText: 'Namuna Farm MChJ' }).getByText('Imzolangan').click();
  await expect(page).toHaveURL(/\/admin\/wholesalers\/8$/);
});

test.describe('planshet', () => {
  test.use({ viewport: { width: 768, height: 1100 } });

  test('ustunlar — optovik, holat (+ shartnoma sanasi), omborda, to‘lanadigan', async ({ page }) => {
    await openList(page);
    await expect(page.getByRole('columnheader', { name: 'Shartnoma' })).toBeHidden();
    await expect(page.getByRole('columnheader', { name: 'Omborda' })).toBeVisible();
    await expect(rows(page).filter({ hasText: 'Namuna Savdo MChJ' })).toContainText(/shartnoma \d\d\.\d\d\.\d{4}/);
    await expect(page.getByText('Mahsulotlar, postavkalar va kabinet — optovik kartasida')).toBeVisible();
  });
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kartalar, «Filtrlar» varag‘i va «⋮» — postavka arizasi; «Optovik qo‘shish» pastki panelda', async ({ page }) => {
    await openList(page);
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).filter({ hasText: 'Barakat Uy Jihozlari MChJ' })).toContainText('Shartnoma yo‘q');
    await expect(rows(page).filter({ hasText: 'Namuna Savdo MChJ' })).toContainText('Omborda 206 dona');
    await expect(page.getByText('3 ta optovik — hammasi ko‘rsatildi')).toBeVisible();
    await page.getByRole('button', { name: 'Filtrlar' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtrlar' });
    await sheet.getByLabel('Shartnoma').selectOption('MISSING');
    await sheet.getByRole('button', { name: '1 tasini ko‘rsatish' }).click();
    await expect(rows(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Optoviklar: boshqa amallar' }).click();
    await page.getByRole('menuitem', { name: 'Postavka arizasi — optovik nomidan' }).click();
    await expect(page.getByTestId('declare-form')).toBeVisible();
  });
});
