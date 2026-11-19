import type { AffiliateStatsGroupBy } from '../../../features/affiliate/api/affiliateApi';
import { addDays } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';

/**
 * «Statistika» sahifasi holati (sotuvchi-statistika): davr, kesim va sahifa filtri URL'da —
 * yangilansa yoki havola ulashilsa saqlanadi (`?period=last7&cut=STREAM&page=3301`).
 */

export const PERIOD_PRESETS = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
export const DEFAULT_PERIOD: PeriodPreset = 'last7';

export const STATS_CUTS = ['DAY', 'STREAM', 'SUB1'] as const satisfies readonly AffiliateStatsGroupBy[];
export type StatsCut = (typeof STATS_CUTS)[number];

export const parsePeriod = (value: string | null): PeriodPreset =>
  (PERIOD_PRESETS as readonly string[]).includes(value ?? '') ? (value as PeriodPreset) : DEFAULT_PERIOD;

export const parseCut = (value: string | null): StatsCut =>
  (STATS_CUTS as readonly string[]).includes(value ?? '') ? (value as StatsCut) : 'DAY';

/** Davr chegaralari — Toshkent sanasi, ikkala uchi ham kiradi; kelajak kunlar yo'q. */
export function periodRange(preset: PeriodPreset, today: string): { from: string; to: string } {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const day = addDays(today, -1);
      return { from: day, to: day };
    }
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'thisMonth':
      return { from: monthStart, to: today };
    case 'lastMonth': {
      const lastDay = addDays(monthStart, -1);
      return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
    }
    case 'last7':
    default:
      return { from: addDays(today, -6), to: today };
  }
}

/** `from`…`to` dagi har kun, eskisidan yangisiga. */
export function periodDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 400; day = addDays(day, 1)) days.push(day);
  return days;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export const ddmmyyyy = (iso: string) => `${ddmm(iso)}.${iso.slice(0, 4)}`;

/** «08.01–14.01.2027»; yil har xil bo'lsa — ikkalasida ham; bir kun — «14.01.2027». */
export function formatRange(from: string, to: string): string {
  if (from === to) return ddmmyyyy(to);
  return from.slice(0, 4) === to.slice(0, 4) ? `${ddmm(from)}–${ddmmyyyy(to)}` : `${ddmmyyyy(from)}–${ddmmyyyy(to)}`;
}

/** Summa: manfiy (teskari yozuv) — haqiqiy minus «−» (U+2212) bilan. */
export const signedMoney = (value: number) => (value < 0 ? `−${formatMoney(Math.abs(value))}` : formatMoney(value));
