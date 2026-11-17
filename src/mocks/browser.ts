import { setupWorker } from 'msw/browser';
import { handlers, unmockedApiHandler } from './handlers';

/** Dev rejimi: backendsiz ishlash (FE-02). Faqat `VITE_API_MOCKS=true` da yuklanadi. */
export async function startMockApi(): Promise<void> {
  const worker = setupWorker(...handlers, unmockedApiHandler);
  await worker.start({
    // Rasm, shrift, Vite modullari — mock emas, o'tib ketadi.
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
  console.info('[mock] API mock rejimida: telefon 900000001…900000008 (8 rol), parol — istalgan.');
}
