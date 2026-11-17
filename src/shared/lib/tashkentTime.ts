/**
 * Toshkent vaqti (UTC+5, yozgi vaqt yo'q). Panel kunlari va soatlari brauzer vaqt
 * zonasiga emas, Toshkentga bog'liq: backend sanalari ham shunday («Toshkent sanasi»).
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const shifted = (value: number | Date) => new Date((typeof value === 'number' ? value : value.getTime()) + TASHKENT_OFFSET_MS);

/** `YYYY-MM-DD` — Toshkentdagi bugungi (yoki berilgan vaqtdagi) sana. */
export function tashkentDate(value: number | Date = Date.now()): string {
  return shifted(value).toISOString().slice(0, 10);
}

/** «14:37» */
export function tashkentClock(value: number | Date = Date.now()): string {
  return shifted(value).toISOString().slice(11, 16);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
