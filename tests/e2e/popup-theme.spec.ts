import { expect, test, type Page } from '@playwright/test';

async function surfaceColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--color-surface)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
}

test('shared confirm dialog asosiy dark surface rangidan foydalanadi', async ({ page }) => {
  await page.goto('/__test__/shared-ui');
  await page.getByRole('button', { name: 'Tasdiqni ochish' }).click();
  await expect(page.getByRole('dialog', { name: 'Amal tasdiqlansinmi?' })).toBeVisible();

  const expected = await surfaceColor(page);
  await expect.poll(() => page.locator('.ant-modal-container:visible').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(expected);
});

test('shared form modal va select popup dark surface bilan bir xil', async ({ page }) => {
  await page.goto('/__test__/shared-ui');
  const paginationSpacing = await page.locator('.ant-table-pagination').evaluate(element => {
    const styles = getComputedStyle(element);
    const rootStyles = getComputedStyle(document.documentElement);
    return {
      marginTop: styles.marginTop,
      marginBottom: styles.marginBottom,
      expectedTop: rootStyles.getPropertyValue('--space-6').trim(),
      expectedBottom: rootStyles.getPropertyValue('--space-4').trim(),
    };
  });
  expect(paginationSpacing.marginTop).toBe(paginationSpacing.expectedTop);
  expect(paginationSpacing.marginBottom).toBe(paginationSpacing.expectedBottom);

  await page.getByRole('button', { name: 'Formani ochish' }).click();
  await expect(page.getByRole('dialog', { name: 'Test formasi' })).toBeVisible();

  const expected = await surfaceColor(page);
  await expect.poll(() => page.locator('.ant-modal-container:visible').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(expected);

  await page.getByRole('dialog').getByLabel('Holati').click();
  await expect.poll(() => page.locator('.ant-select-dropdown:visible').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(expected);
});
