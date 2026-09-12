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
    baseURL: 'http://127.0.0.1:5273',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  // DIQQAT — port ataylab 5273, Vite'ning standart 5173 si EMAS.
  // `reuseExistingServer: true` portda nima turgan bo'lsa o'shani ishlatadi:
  // 5173 da boshqa loyihaning dev serveri turgan bo'lsa, testlar jimgina
  // BOShQA ILOVAGA qarshi yuradi va hammasi yiqiladi (2026-09-12 da aynan
  // shunday bo'ldi — post_control_system ning `base: "/admin/"` serveri
  // ushlanib, admin testlari 404 bergan).
  // `--strictPort` esa port band bo'lsa Vite'ni jimgina boshqa portga
  // o'tkazmasdan, ochiq xato bilan to'xtatadi.
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5273 --strictPort',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
