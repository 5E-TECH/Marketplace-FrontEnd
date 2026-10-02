import { chromium, type FullConfig } from '@playwright/test';

/**
 * Vite dev server sovuq ishga tushganda (yangi clone, lockfile o'zgargan, `node_modules/.vite` keshi
 * eskirgan) kutubxonalarni qayta yig'adi. Sekin diskda bu 30 s dan oshadi va shu paytga tushgan
 * birinchi testlar sahifani ocha olmay timeout bilan yiqiladi. Shuning uchun testlardan oldin ilova
 * bir marta ochiladi: yig'ish shu yerda tugaydi, testlar "issiq" serverda boshlanadi.
 */
const WARMUP_TIMEOUT = 180_000;

export default async function globalSetup(config: FullConfig) {
  const { baseURL, channel } = config.projects[0]?.use ?? {};
  if (!baseURL) return;
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const page = await browser.newPage();
    // Qizdirish hech qanday backend'ga chiqmaydi (mavjud dev server production proxy bilan bo'lishi mumkin).
    await page.route('**/api/**', (route) => route.abort());
    const deadline = Date.now() + WARMUP_TIMEOUT;
    // Yig'ish oxirida Vite sahifani o'zi qayta yuklashi mumkin — ikkinchi ochilish shuni ham kutadi.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.goto(new URL('/login', baseURL).toString(), { waitUntil: 'networkidle', timeout: Math.max(1_000, deadline - Date.now()) });
    }
  } finally {
    await browser.close();
  }
}
