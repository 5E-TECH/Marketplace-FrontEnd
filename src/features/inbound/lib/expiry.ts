import { addDays } from '../../../shared/lib/tashkentTime';

/**
 * Yaroqlilik muddati qoidasi (OMB-3, tz.md G11): muddatiga 60 kundan kam qolgan partiya sotuvga
 * chiqmaydi — qoldiqqa kiradi, lekin «mavjud»ga qo'shilmaydi. Hisob serverda (BE-17); bu yerda
 * forma ogohlantirishi va «bugungi chegara» matni uchun. Sanalar — `YYYY-MM-DD` (Toshkent).
 */
export const MIN_SHELF_DAYS = 60;

const DAY_MS = 86_400_000;

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Muddatigacha qolgan kun (o'tgan bo'lsa manfiy). */
export const daysLeft = (expiresAt: string, today: string) => daysBetween(today, expiresAt);

/** Bugungi chegara: shu sanadan oldin tugaydigan partiya sotuvga chiqmaydi. */
export const saleCutoff = (today: string) => addDays(today, MIN_SHELF_DAYS);

/** Partiya sotuvdan chiqadigan kun: muddat − 60 kun. */
export const saleUntil = (expiresAt: string) => addDays(expiresAt, -MIN_SHELF_DAYS);

export const isSellableExpiry = (expiresAt: string, today: string) => daysLeft(expiresAt, today) >= MIN_SHELF_DAYS;
