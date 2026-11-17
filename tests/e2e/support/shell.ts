import type { Page } from '@playwright/test';

/** Karkas-E menyusi: desktopda navy ustun, planshet/telefonda chap panel ichida. */
export const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Asosiy menyu' });

/** Sahifa nomi — faqat yuqori qatordagi `h1` (karkas-E 0). */
export const pageTitle = (page: Page) => page.getByRole('heading', { level: 1 });

/** Foydalanuvchi menyusi (1.10) orqali chiqish. */
export async function logoutViaUserMenu(page: Page): Promise<void> {
  await page.getByTestId('user-menu-button').click();
  await page.getByRole('menuitem', { name: 'Chiqish' }).click();
}
