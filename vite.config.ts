import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `public/mockServiceWorker.js` (MSW) faqat dev rejimi uchun — production build'ga
 * kirmasin: u yerda uni hech kim ro'yxatdan o'tkazmaydi, ortiqcha fayl qolmasin.
 */
function dropMockWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'drop-mock-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      rmSync(resolve(outDir, 'mockServiceWorker.js'), { force: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Dev'da brauzer API'ga bir xil origin orqali murojaat qiladi: CORS ham,
  // cross-site cookie muammosi ham chiqmaydi (refresh cookie ishlaydi).
  const devApiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:3000';

  return {
    plugins: [react(), dropMockWorker()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router[^\\/]*|scheduler)[\\/]/,
              },
              {
                name: 'vendor-state',
                test: /node_modules[\\/](@reduxjs|react-redux|@tanstack)[\\/]/,
              },
              { name: 'vendor-http', test: /node_modules[\\/]axios[\\/]/ },
            ],
          },
        },
      },
    },
    server: {
      // Standart 5173 emas: boshqa loyihalar bilan to'qnashmasligi uchun
      // (playwright.config.ts dagi izohga qarang).
      port: 5273,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
  };
});
