import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  // ProductEditor testlari og'ir (forma + rasm yuklash). Ko'p worker bilan
  // parallel ishlaganda ular resurs yetishmasligidan timeout'ga uchraydi —
  // CI'da worker sonini cheklab, tasodifiy yiqilishga qayta urinish beramiz.
  // Lokalda retry yo'q: xato darhol ko'rinsin.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
