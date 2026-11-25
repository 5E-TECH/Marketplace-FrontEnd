import { formatRange, periodRange, type PeriodPreset } from '../../affiliate/lib/statsPeriod';
import { dayTime } from '../../../shared/lib/dayTime';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { LEAD_TABS, type AdminLeadListItem, type AdminLeadQuery, type LeadTab } from '../model/adminLeadTypes';

/** «Davr» filtri: «Hamma vaqt» (sukut) yoki Toshkent sanasi bo'yicha tayyor davr. */
export const LEAD_PERIODS = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'] as const satisfies readonly PeriodPreset[];
export type LeadPeriod = (typeof LEAD_PERIODS)[number];

export const parseLeadTab = (value: string | null): LeadTab => ((LEAD_TABS as readonly string[]).includes(value ?? '') ? (value as LeadTab) : 'ALL');
export const parseLeadPeriod = (value: string | null): LeadPeriod | null => ((LEAD_PERIODS as readonly string[]).includes(value ?? '') ? (value as LeadPeriod) : null);

export const SORTABLE = ['price', 'attempts', 'createdAt'] as const;
export type SortField = (typeof SORTABLE)[number];
export const parseSort = (value: string | null): NonNullable<AdminLeadQuery['sort']> => {
  const field = value?.replace(/^-/, '');
  return field && (SORTABLE as readonly string[]).includes(field) ? (value as NonNullable<AdminLeadQuery['sort']>) : '-createdAt';
};

export function leadPeriodRange(period: LeadPeriod, now = Date.now()): { from: string; to: string } {
  return periodRange(period, tashkentDate(now));
}

/** Davr sanalari: «14.01.2027», «08.01–14.01.2027» (yorliq — `al.period.*`). */
export function leadPeriodText(period: LeadPeriod, now = Date.now()): string {
  const { from, to } = leadPeriodRange(period, now);
  return formatRange(from, to);
}

/** Telefon bo'yicha qidiruv (faqat admin): harfsiz, kamida 7 raqam. */
export function isPhoneSearch(search: string): boolean {
  const value = search.trim();
  return !/[a-zA-Zа-яА-Я‘’']/.test(value) && value.replace(/\D/g, '').length >= 7;
}

/** «Bugun, 14:36», «Kecha, 11:05», «11.01.2027, 15:00» — Toshkent vaqti. */
export const leadDayTime = (value: string, t: (key: TranslationKey, params?: Record<string, string | number>) => string, now = Date.now()) => dayTime(value, t, now);

/** Vaqti hali kelmagan rejalashtirilgan qo'ng'iroq (operatorda qoladi; o'tkazilsa — vaqti saqlanadi). */
export const isScheduledCall = (lead: Pick<AdminLeadListItem, 'status' | 'callbackAt'>, now = Date.now()) =>
  lead.status === 'CALLBACK' && Boolean(lead.callbackAt) && Date.parse(lead.callbackAt ?? '') > now;

/**
 * O'tkazib bo'lmaydigan lid — sababi (BE-42): navbatdagi, bronlangan va qayta qo'ng'iroqdagi lid o'tkaziladi;
 * tekshiruvdagi, tasdiqlangan va yopilgan — yo'q. `null` — o'tkazsa bo'ladi.
 */
export function transferBlock(lead: Pick<AdminLeadListItem, 'status' | 'inReview'>): TranslationKey | null {
  if (lead.inReview) return 'al.menu.reviewHint';
  if (lead.status === 'CONFIRMED') return 'al.menu.confirmedHint';
  if (lead.status === 'NEW' || lead.status === 'BOOKED' || lead.status === 'CALLBACK') return null;
  return 'al.menu.closedHint';
}

/** Berilgan vaqtdan beri `days` kun o'tmaganmi (qayta ochish: «rad etilganiga 3 kun bo'lmagan»). */
export const withinDays = (value: string | null | undefined, days: number, now = Date.now()) => {
  const time = value ? Date.parse(value) : Number.NaN;
  return !Number.isNaN(time) && now - time < days * 24 * 60 * 60 * 1000;
};

/** Holat o'zgarganiga 2 daqiqa bo'lmagan qator — real vaqtda «hozirgina · 14:38» (admin-lidlar holatlar). */
const FRESH_MS = 2 * 60_000;
export const isFresh = (lead: Pick<AdminLeadListItem, 'status' | 'statusAt'>, now = Date.now()) =>
  lead.status !== 'NEW' && Boolean(lead.statusAt) && now - Date.parse(lead.statusAt ?? '') < FRESH_MS;
