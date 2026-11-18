import { HttpResponse } from 'msw';

export { addDays, tashkentDate } from '../shared/lib/tashkentTime';

/**
 * MSW yordamchilari. Javob backend'dagidek o'raladi: `{ statusCode, message, data }`;
 * xato — `{ statusCode, message, errorCode, requestId }` (all-exceptions.filter).
 * Yo'l `*` bilan boshlanadi: dev (bir xil origin), Vitest (jsdom) va Playwright
 * (to'liq URL) uchun bir xil ishlaydi.
 */
export const API = '*/api/v1';

/** `headers` javob yaratilayotganda beriladi: MSW `Set-Cookie` ni faqat shunda brauzer cookie'siga yozadi. */
export function ok<T>(data: T, status = 200, headers?: Record<string, string>) {
  return HttpResponse.json({ statusCode: status, message: 'OK', data }, { status, headers });
}

let requestCounter = 0;

/** `extra` — xatoning qo'shimcha maydonlari (masalan, `attemptsLeft`, `blockedUntil`). */
export function fail(status: number, errorCode: string, message: string, headers?: Record<string, string>, extra: Record<string, unknown> = {}) {
  requestCounter += 1;
  return HttpResponse.json(
    { statusCode: status, message, errorCode, requestId: `mock-${requestCounter.toString().padStart(4, '0')}`, ...extra },
    { status, headers },
  );
}

/** Sana bo'yicha barqaror «tasodifiy» son: bir kun uchun har safar bir xil statistika. */
export function seeded(key: string, min: number, max: number): number {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return min + (Math.abs(hash) % (max - min + 1));
}

export function pageOf<T>(items: readonly T[], url: URL, defaultLimit = 20) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || defaultLimit));
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
