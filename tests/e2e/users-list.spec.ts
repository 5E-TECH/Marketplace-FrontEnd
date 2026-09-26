import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './support/auth';
import { collectUnconnectedFormWarnings } from './support/console';

const operators = Array.from({ length: 21 }, (_, index) => ({
  id: String(index + 1),
  name: index === 20 ? 'Noyob Operator' : `Operator ${index + 1}`,
  phone: `+9989012345${String(index).padStart(2, '0')}`,
  avatarUrl: null,
  role: 'OPERATOR',
  isActive: index !== 5,
  isBlocked: false,
  shopId: '15',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  isDeleted: false,
}));

test('seller operator search va pagination backend kontraktiga mos client-side ishlaydi', async ({ page }) => {
  await installAuthenticatedSession(page);
  let requests = 0;
  let requestSearchParams = '';
  await page.route('**/api/v1/sellers/operators', async route => {
    requests += 1;
    requestSearchParams = new URL(route.request().url()).search;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: operators }) });
  });

  await page.goto('/users');
  await expect(page.getByText('Operator 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Noyob Operator')).toHaveCount(0);
  expect(requestSearchParams).toBe('');

  await page.getByPlaceholder('Ism yoki telefon...').fill('Noyob Operator');
  await expect(page.getByText('Noyob Operator')).toBeVisible();
  await expect(page.getByText('Operator 1', { exact: true })).toHaveCount(0);

  await page.getByPlaceholder('Ism yoki telefon...').clear();
  await page.getByTitle('3').click();
  await expect(page.getByText('Noyob Operator')).toBeVisible();
  expect(requests).toBe(1);
});

test('operatorni tahrirlash oynasi joriy qiymatlar bilan ochiladi va PATCH yuboradi', async ({ page }) => {
  await installAuthenticatedSession(page);
  const formWarnings = collectUnconnectedFormWarnings(page);
  let patchBody: unknown;
  await page.route('**/api/v1/sellers/operators', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: operators.slice(0, 2) }) }));
  await page.route('**/api/v1/sellers/operators/2', async route => {
    patchBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...operators[1], ...(patchBody as object) } }) });
  });

  await page.goto('/users');
  await page.getByRole('row', { name: /Operator 2/ }).getByRole('button', { name: 'Tahrirlash' }).click();
  const dialog = page.getByRole('dialog', { name: 'Operatorni tahrirlash' });
  await expect(dialog.getByLabel('Ism')).toHaveValue('Operator 2');
  await expect(dialog.getByLabel('Telefon')).toHaveValue('+998901234501');
  await dialog.getByLabel('Ism').fill('Yangi Operator');
  await dialog.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();
  await expect.poll(() => patchBody).toEqual({ name: 'Yangi Operator', phone: '+998901234501' });
  expect(formWarnings).toEqual([]);
});
