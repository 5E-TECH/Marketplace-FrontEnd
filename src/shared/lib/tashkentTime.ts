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

/** «07.01.2027» — Toshkent sanasi (sahifa yaratilgan, kreativ tasdiqlangan kun). */
export function tashkentDay(value: number | Date | string = Date.now()): string {
  const time = typeof value === 'string' ? Date.parse(value) : value;
  if (typeof time === 'number' && Number.isNaN(time)) return '—';
  const [year, month, day] = tashkentDate(time).split('-');
  return `${day}.${month}.${year}`;
}

/** «07.01.2027, 09:14» — Toshkent vaqti (oferta qabul qilingan vaqt, ro'yxat sanasi). */
export function tashkentDateTime(value: number | Date | string = Date.now()): string {
  const day = tashkentDay(value);
  return day === '—' ? day : `${day}, ${tashkentClock(typeof value === 'string' ? Date.parse(value) : value)}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
