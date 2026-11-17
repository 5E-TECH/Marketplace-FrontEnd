/**
 * So'rov sozlamalari (FE-02): har chaqiruvning o'z timeout'i va takrorlanmas amal kaliti.
 *
 * Timeout: oddiy so'rov 10 s (`httpClient` sukuti). Fayl yuklash/eksport uzoqroq —
 * server faylni yig'adi. Timeout'ga tushgan so'rov `isTimeoutError` bo'ladi va
 * foydalanuvchiga «Tizim javob bermadi» chiqadi (umumiy-xato-yuklanish).
 */
export const REQUEST_TIMEOUT = {
  default: 10_000,
  /** Operator «Keyingi lid», natija va boshqa navbat amallari — karta 1 soniyada ochilishi kerak, lekin tarmoq sekin bo'lishi mumkin. */
  action: 15_000,
  /** Fayl va eksport: server faylni yig'ib beradi. */
  file: 60_000,
} as const;

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Takrorlanmas amal kaliti. Bitta foydalanuvchi amaliga (tugma bosilishi) bitta kalit:
 * tarmoq uzilib so'rov qayta yuborilsa, server o'sha natijani qaytaradi — lid yoki
 * buyurtma ikki marta yaratilmaydi. Hozir backend uni `POST /partner/leads` va checkout'da
 * qabul qiladi; panel amallari qo'llay boshlaganda shu yordamchi ishlatiladi.
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function idempotencyHeaders(key: string): Record<string, string> {
  return { [IDEMPOTENCY_HEADER]: key };
}
