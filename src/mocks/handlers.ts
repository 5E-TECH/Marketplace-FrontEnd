import { http } from 'msw';
import { affiliateHandlers } from './handlers/affiliate';
import { authHandlers } from './handlers/auth';
import { commonHandlers } from './handlers/common';
import { operatorHandlers } from './handlers/operator';
import { API, fail } from './utils';

/**
 * Ishga tushishga (M1) kiradigan endpointlar uchun mock'lar — dev rejimi (`npm run dev`),
 * Vitest (`msw/node`) va Playwright (`tests/e2e/support/mockApi.ts`) bitta ro'yxatdan
 * foydalanadi. M2 bo'limlari (optovik, balans, sverka, softfon…) o'z kartasi bilan qo'shiladi.
 */
export const handlers = [...authHandlers, ...commonHandlers, ...affiliateHandlers, ...operatorHandlers];

/**
 * Dev rejimida mock'i yo'q API so'rovi jimgina haqiqiy serverga ketmasin: aniq 501
 * va konsolda ogohlantirish. (E2E bunga ega emas — u yerda test o'z mock'ini qo'shadi.)
 */
export const unmockedApiHandler = http.all(`${API}/*`, ({ request }) => {
  console.warn(`[mock] ${request.method} ${new URL(request.url).pathname} uchun mock yo‘q`);
  return fail(501, 'NOT_IMPLEMENTED', 'Bu bo‘lim mock rejimida hali yo‘q');
});
