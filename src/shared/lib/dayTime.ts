import type { TranslationKey } from '../i18n/translations';
import { addDays, tashkentClock, tashkentDate, tashkentDay } from './tashkentTime';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * Ro'yxat va kartalardagi vaqt (Toshkent): «Bugun, 14:36», «Kecha, 11:05», «11.01.2027, 15:00». `lower` — gap ichida
 * kichik harf bilan («bugun, 13:02 · Shohruh M.»).
 */
export function dayTime(value: string, t: T, now = Date.now(), lower = false): string {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return '—';
  const day = tashkentDate(at);
  const today = tashkentDate(now);
  const clock = tashkentClock(at);
  const label = day === today ? t('day.today', { time: clock }) : day === addDays(today, -1) ? t('day.yesterday', { time: clock }) : `${tashkentDay(at)}, ${clock}`;
  return lower ? label.replace(/^\p{Lu}/u, (letter) => letter.toLocaleLowerCase()) : label;
}

/** «14:36» bugun, aks holda «11.01, 15:03». */
export function shortTime(value: string, now = Date.now()): string {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return '—';
  const clock = tashkentClock(at);
  if (tashkentDate(at) === tashkentDate(now)) return clock;
  return `${tashkentDay(at).slice(0, 5)}, ${clock}`;
}
