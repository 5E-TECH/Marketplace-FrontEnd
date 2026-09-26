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
