import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Dev'da brauzer API'ga bir xil origin orqali murojaat qiladi: CORS ham,
  // cross-site cookie muammosi ham chiqmaydi (refresh cookie ishlaydi).
  const devApiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:3000';

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }

            if (
              id.includes('/@reduxjs/') ||
              id.includes('/react-redux/') ||
              id.includes('/@tanstack/')
            ) {
              return 'vendor-state';
            }

            if (id.includes('/axios/')) return 'vendor-http';
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
