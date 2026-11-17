import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Unit va komponent testlari (FE-02): Vitest + React Testing Library, jsdom muhitida.
 * API so'rovlari MSW (`src/mocks`) orqali — dev rejimi va e2e bilan bir xil soxta javoblar.
 * E2E (Playwright) alohida: `npm run test:e2e`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    unstubGlobals: true,
  },
});
