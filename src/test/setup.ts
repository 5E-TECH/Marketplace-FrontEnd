import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMockDb } from '../mocks/db';
import { server } from '../mocks/node';

// jsdom dagi `Blob` da `stream()` yo'q, Node 22 `Response` (undici) esa fayl javobini shu bilan o'qiydi: axios XHR
// (`responseType: 'blob'`) + MSW dagi PDF so'rovi CI da (Node 22) osilib qolardi, Node 24 da sezilmasdi.
// Brauzerda `stream()` bor — to'ldirish faqat test muhiti uchun.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.stream !== 'function') {
  Object.defineProperty(Blob.prototype, 'stream', {
    configurable: true,
    writable: true,
    value: function stream(this: Blob) {
      const read = () => this.arrayBuffer();
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array(await read()));
          controller.close();
        },
      });
    },
  });
}

// Mock'i yo'q so'rov — test xatosi: jimgina tarmoqqa chiqib ketmasin.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());
