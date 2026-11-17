import { expect, test, type Page } from '@playwright/test';
import {
  ACCESS_TOKEN_KEY,
  TEST_ACCESS_TOKEN,
  installAuthenticatedSession,
  mockLogout,
  mockNotifications,
  operatorUser,
  roleUsers,
} from './support/auth';
import { logoutViaUserMenu, mainNav, pageTitle } from './support/shell';

/**
 * FE-01: 8 rol, yagona marshrut manifesti va karkas-E. Har rol o'z bosh
 * sahifasiga tushadi va faqat o'z M1 menyusini ko'radi (karkas-E 2-bo'lim);
 * boshqa rolning sahifasi — 403 (umumiy-403), noma'lum rol — menyusiz karkas.
 */
const ADMIN_MENU = [
  'Moderatsiya', 'Lidlar', 'Buyurtmalar', 'Mahsulotlar', 'Kategoriyalar', 'Qoldiq', 'Sotuvchilar', 'Optoviklar',
  'Qo‘ng‘iroq yozuvlari', 'Audit jurnali', 'Foydalanuvchilar', 'Integratsiyalar', 'Sozlamalar',
];

const roleCases = [
  { role: 'AFFILIATE', home: '/affiliate', title: 'Bosh sahifa', menu: ['Bosh sahifa', 'Offerlar', 'Mening sahifalarim', 'Statistika', 'Lidlar', 'Balans', 'Postback va API', 'Profil'] },
  // Optovik kabineti butunlay M2 (FE-23): menyu bandlari hozircha yo'q.
  { role: 'WHOLESALER', home: '/wholesaler', title: 'Bosh sahifa', menu: [] },
  { role: 'OPERATOR_LEAD', home: '/operator', title: 'Ish joyi', menu: ['Ish joyi', 'Rejalashtirilgan qo‘ng‘iroqlar', 'Mening qo‘ng‘iroqlarim', 'Mening buyurtmalarim', 'Statistikam'] },
  { role: 'SUPERVISOR', home: '/supervisor', title: 'Navbat', menu: ['Navbat', 'Lidlar', 'Buyurtmalar', 'Operatorlar', 'Qo‘ng‘iroq yozuvlari'] },
  { role: 'WAREHOUSE', home: '/warehouse', title: 'Postavka qabuli', menu: ['Postavka qabuli', 'SKU va yacheykalar', 'Qoldiq', 'Yig‘ish va qadoq', 'Elchi’ga topshirish', 'Qaytganlarni saralash', 'Optovikka topshirish'] },
  { role: 'FINANCE', home: '/finance', title: 'Elchi sverkasi', menu: ['Elchi sverkasi', 'Hisoblar', 'Pul yechish so‘rovlari', 'Cheklar'] },
  { role: 'ADMIN', home: '/admin/moderation', title: 'Moderatsiya', menu: ADMIN_MENU },
  { role: 'SUPERADMIN', home: '/admin/moderation', title: 'Moderatsiya', menu: ADMIN_MENU },
] as const;

const forbidden = (page: Page) => page.getByTestId('forbidden-page');

for (const { role, home, title, menu } of roleCases) {
  test(`${role}: / → o‘z bosh sahifasi, menyuda faqat o‘z bandlari`, async ({ page }) => {
    await installAuthenticatedSession(page, roleUsers[role]);
    await page.goto('/');

    await expect(page).toHaveURL(new RegExp(`${home.replaceAll('/', '\\/')}$`));
    await expect(pageTitle(page)).toHaveText(title);
    await expect(mainNav(page).getByRole('link')).toHaveText([...menu]);
    const [first] = menu;
    if (first) await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText(first);
    // Admin guruh sarlavhalari faqat admin menyusida.
    await expect(mainNav(page).locator('p')).toHaveCount(role === 'ADMIN' || role === 'SUPERADMIN' ? 5 : 0);
  });
}

test('TC1: OPERATOR_LEAD bilan login → operator karkasi, boshqa menyu yo‘q', async ({ page }) => {
  await mockNotifications(page);
  await mockLogout(page);
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ json: { accessToken: TEST_ACCESS_TOKEN } }));
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: operatorUser } }));

  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  await expect(page).toHaveURL(/\/operator$/);
  await expect(pageTitle(page)).toHaveText('Ish joyi');
  await expect(page.getByTestId('app-layout')).toHaveAttribute('data-shell', 'workspace');
  await expect(mainNav(page).getByRole('link')).toHaveText(roleCases[2].menu);
  await expect(page.getByTestId('user-menu-button')).toContainText('Operator');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
});

test('chiqib boshqa rol bilan kirilsa — oldingi foydalanuvchi sahifasiga emas, o‘z bosh sahifasiga tushadi', async ({ page }) => {
  await installAuthenticatedSession(page);
  let meUser: Record<string, unknown> = roleUsers.AFFILIATE;
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: meUser } }));
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ json: { accessToken: TEST_ACCESS_TOKEN } }));
  await page.goto('/affiliate/offers');
  await expect(pageTitle(page)).toHaveText('Offerlar');
  await logoutViaUserMenu(page);
  await expect(page).toHaveURL(/\/login$/);

  meUser = operatorUser;
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/operator$/);
  await expect(pageTitle(page)).toHaveText('Ish joyi');
  await expect(page.getByTestId('forbidden-page')).toHaveCount(0);
});

test('qo‘lda chiqilgach keyingi kirgan odam oldingi sahifaga emas, o‘z bosh sahifasiga tushadi (ruxsati bo‘lsa ham)', async ({ page }) => {
  await installAuthenticatedSession(page, roleUsers.ADMIN);
  let meUser: Record<string, unknown> = roleUsers.ADMIN;
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: meUser } }));
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ json: { accessToken: TEST_ACCESS_TOKEN } }));
  await page.route('**/api/v1/admin/categories**', (route) => route.fulfill({ json: { data: [] } }));
  await page.goto('/admin/categories');
  await expect(pageTitle(page)).toHaveText('Kategoriyalar');
  await logoutViaUserMenu(page);

  meUser = roleUsers.SUPERADMIN;
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
});

test('TC2: AFFILIATE /admin/* ga kiradi → 403 sahifa, admin so‘rovlari yuborilmaydi', async ({ page }) => {
  await installAuthenticatedSession(page);
  const adminRequests: string[] = [];
  await page.route('**/api/v1/admin/**', (route) => {
    adminRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
  });

  for (const path of ['/admin/moderation', '/admin/users', '/admin/users/42', '/admin/audit-logs']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(forbidden(page)).toContainText('Bu sahifa sotuvchi uchun yopiq');
    await expect(forbidden(page)).toContainText('faqat admin va superadmin uchun');
    await expect(forbidden(page)).toContainText(path);
    await expect(pageTitle(page)).toHaveText('Ruxsat yo‘q');
    await expect(page.getByTestId('admin-layout')).toHaveCount(0);
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);
  }
  expect(adminRequests).toEqual([]);

  await page.getByRole('button', { name: 'Bosh sahifaga qaytish' }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(pageTitle(page)).toHaveText('Bosh sahifa');
});

test('boshqa kabinet rolining sahifasi ham 403: operator sotuvchi bosh sahifasiga kira olmaydi', async ({ page }) => {
  await installAuthenticatedSession(page, operatorUser);
  await page.goto('/affiliate');

  await expect(forbidden(page)).toContainText('Bu sahifa operator uchun yopiq');
  await expect(forbidden(page)).toContainText('«Bosh sahifa» faqat sotuvchi uchun');
  await expect(mainNav(page).getByRole('link')).toHaveText(roleCases[2].menu);

  await page.getByRole('button', { name: 'Boshqa akkaunt bilan kirish' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('TC3: saqlangan sessiyada noma’lum rol → menyusiz karkas, sabab, qayta tekshirish', async ({ page }) => {
  const unknownUser = { ...roleUsers.AFFILIATE, id: 'U-2087', name: 'Laylo N.', role: 'SELLER' };
  await installAuthenticatedSession(page, unknownUser);
  let meCalls = 0;
  let meUser: Record<string, unknown> = unknownUser;
  await page.route('**/api/v1/auth/me', (route) => {
    meCalls += 1;
    return route.fulfill({ json: { data: meUser } });
  });
  await page.goto('/');

  await expect(pageTitle(page)).toHaveText('Ish joyi topilmadi');
  const panel = page.getByTestId('unknown-role');
  await expect(panel).toContainText('Akkauntingizga ish joyi biriktirilmagan');
  await expect(panel).toContainText('Laylo N.');
  await expect(panel).toContainText('U-2087');
  await expect(mainNav(page)).toContainText('Menyu yo‘q: rolingiz aniqlanmadi.');
  await expect(mainNav(page).getByRole('link')).toHaveCount(0);
  // Bildirishnoma yo'q (umumiy-403 §2).
  await expect(page.getByRole('button', { name: /^Bildirishnomalar/ })).toHaveCount(0);
  await expect(page.getByTestId('user-menu-button')).toContainText('Rol aniqlanmagan');
  // Noma'lum rolni qayta so'rash foyda bermaydi — avtomatik qayta urinish va aylanish yo'q.
  await page.waitForTimeout(500);
  expect(meCalls).toBe(1);

  // Admin rolni to'g'riladi → «Qayta tekshirish» o'z karkasini ochadi.
  meUser = roleUsers.AFFILIATE;
  await page.getByRole('button', { name: 'Qayta tekshirish' }).click();
  await expect(page).toHaveURL(/\/affiliate$/);
  await expect(pageTitle(page)).toHaveText('Bosh sahifa');
});

test('TC3: noma’lum rolda «Chiqish» sessiyani yopadi', async ({ page }) => {
  await installAuthenticatedSession(page, { ...roleUsers.AFFILIATE, role: 'SELLER' });
  await page.goto('/');
  await page.getByTestId('unknown-role').getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY)).toBeNull();
});

test('TC3: login’da noma’lum rol — oq ekran emas, menyusiz karkas', async ({ page }) => {
  await mockNotifications(page);
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ json: { accessToken: TEST_ACCESS_TOKEN } }));
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { data: { ...roleUsers.AFFILIATE, role: 'SELLER' } } }));

  await page.goto('/login');
  await page.getByLabel('Telefon raqami').fill('901234567');
  await page.getByLabel('Parol').fill('Secure123');
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();

  await expect(page.getByTestId('unknown-role')).toBeVisible();
  await expect(pageTitle(page)).toHaveText('Ish joyi topilmadi');
});

test('TC3: telefonda noma’lum rol — tugmalar pastki panelda, menyu tugmasi yo‘q', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await installAuthenticatedSession(page, { ...roleUsers.AFFILIATE, role: 'SELLER' });
  await page.goto('/');

  await expect(page.getByTestId('unknown-role')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menyu', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Qayta tekshirish' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

/**
 * Qabul mezoni «Har rol faqat o‘z menyusini ko‘radi»: menyu desktop, planshet va
 * telefon chap panelida bir xil, boshqa rolning bandi yo'q, har bandi shu rolga ochiq.
 */
for (const { role, menu } of roleCases) {
  test(`${role}: menyu har ekranda faqat o‘z bandlari, har bandi ochiladi (403/404 emas)`, async ({ page }) => {
    test.setTimeout(60_000);
    await installAuthenticatedSession(page, roleUsers[role]);
    // Ulangan admin sahifalari (Kategoriyalar, Qoldiq, Audit, Foydalanuvchilar) bo'sh ma'lumot oladi.
    await page.route('**/api/v1/admin/**', (route) => route.fulfill({ json: { data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1, warnings: [], searchTruncated: false } } }));
    await page.goto('/');

    const otherItems = roleCases.filter((other) => other.role !== role)
      .flatMap((other) => other.menu)
      .filter((label) => !(menu as readonly string[]).includes(label));
    for (const label of new Set(otherItems)) {
      await expect(mainNav(page).getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    for (const label of menu) {
      await mainNav(page).getByRole('link', { name: label, exact: true }).click();
      await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText(label);
      await expect(page.getByTestId('forbidden-page')).toHaveCount(0);
      await expect(page.getByTestId('not-found-page')).toHaveCount(0);
    }

    for (const width of [900, 390]) {
      await page.setViewportSize({ width, height: 800 });
      if (role === 'WAREHOUSE' && width === 900) {
        // Omborchi 768–1279 px da chap panel emas, relsi: qisqa yorliq, to'liq nom aria-label'da.
        const links = mainNav(page).getByRole('link');
        await expect(links).toHaveCount(menu.length);
        for (const label of menu) await expect(mainNav(page).getByRole('link', { name: label, exact: true })).toBeVisible();
        continue;
      }
      await page.getByRole('button', { name: 'Menyu', exact: true }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer.getByRole('link')).toHaveText([...menu]);
      await drawer.getByRole('button', { name: 'Menyuni yopish' }).click();
      await expect(drawer).toBeHidden();
    }
  });
}

for (const { role, home } of roleCases) {
  test(`${role}: boshqa rollarning bosh sahifasi URL orqali ham ochilmaydi (403)`, async ({ page }) => {
    await installAuthenticatedSession(page, roleUsers[role]);
    const otherHomes = [...new Set(roleCases.map((other) => other.home))].filter((path) => path !== home);
    for (const path of otherHomes) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
      await expect(page.getByTestId('forbidden-page')).toBeVisible();
      await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0);
    }
  });
}

for (const path of ['/products', '/orders', '/warehouses', '/stock', '/returns', '/delivery', '/shop', '/users', '/support', '/checkout']) {
  test(`eski do‘kon marshruti ${path} uzilgan → 404`, async ({ page }) => {
    await installAuthenticatedSession(page);
    await page.goto(path);
    await expect(page.getByTestId('not-found-page')).toContainText('Bunday sahifa yo‘q');
    await expect(pageTitle(page)).toHaveText('Sahifa topilmadi');
  });
}

for (const path of ['/dokon/ali-market', '/mahsulot/1']) {
  test(`eski do‘kon havolasi ${path} → sotuvchiga «Do‘kon sahifalari endi yo‘q»`, async ({ page }) => {
    await installAuthenticatedSession(page);
    await page.goto(path);
    await expect(page.getByTestId('not-found-page')).toContainText('Do‘kon sahifalari endi yo‘q');
    await page.getByRole('button', { name: 'Offerlarga o‘tish' }).click();
    await expect(page).toHaveURL(/\/affiliate\/offers$/);
  });
}

for (const { role, home, menu } of [roleCases[0], roleCases[6]]) {
  test(`TC4: 360 px da ${role} menyusi chap panelda ochiladi va navigatsiya qiladi`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await installAuthenticatedSession(page, roleUsers[role]);
    await page.goto('/settings');
    await expect(pageTitle(page)).toHaveText('Sozlamalar');

    await expect(mainNav(page)).toHaveCount(0);
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await expect.poll(noOverflow).toBe(true);

    await page.getByRole('button', { name: 'Menyu', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('link')).toHaveText([...menu]);
    await drawer.getByRole('link', { name: menu[0] ?? '' }).click();

    await expect(page).toHaveURL(new RegExp(`${home.replaceAll('/', '\\/')}$`));
    await expect(drawer).toBeHidden();
    await expect.poll(noOverflow).toBe(true);
  });
}
