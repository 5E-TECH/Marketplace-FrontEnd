import type { TranslationKey } from '../../../shared/i18n/translations';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { addDays, tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import type { LeadCard, LeadOutcome, LeadRejectReason, LeadStatus } from '../model/operatorTypes';
import { statusKey } from '../../../shared/ui/StatusBadge/statusConfig';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const sum = (value: number) => `${formatMoney(value)} so‘m`;

/** 498 000 ms → «08:18». */
export function mmss(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** «14.01.2027» — Toshkent sanasi. */
export function dayLabel(value: number | string): string {
  const [year, month, day] = tashkentDate(typeof value === 'string' ? Date.parse(value) : value).split('-');
  return `${day}.${month}.${year}`;
}

export const clock = (value: string | number) => tashkentClock(typeof value === 'string' ? Date.parse(value) : value);

/** «bugun 14:52» / «ertaga, 15.01.2027 10:00» uchun: shu kunmi, ertangimi. */
export function dayOffset(value: number, now: number): number {
  const target = tashkentDate(value);
  if (target === tashkentDate(now)) return 0;
  if (target === addDays(tashkentDate(now), 1)) return 1;
  return Date.parse(`${target}T00:00:00Z`) > Date.parse(`${tashkentDate(now)}T00:00:00Z`) ? 2 : -1;
}

/** 83 daqiqa → «1 soat 23 daqiqa». */
export function durationLabel(ms: number, t: T): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? t('opc.hours', { h: hours, m: minutes % 60 }) : t('opc.mins', { m: minutes });
}

export const statusLabel = (status: LeadStatus, t: T) => t(statusKey('lead', status));
export const outcomeLabel = (outcome: LeadOutcome, t: T) => t(`opw.outcome.${outcome}` as TranslationKey);
export const rejectLabel = (reason: LeadRejectReason, t: T) => t(`opw.reject.${reason}` as TranslationKey);

/** Sarlavhadagi manba belgisi: «(formadan)», «(API orqali)», «(saytdan)». */
export function sourceMark(lead: Pick<LeadCard, 'source'>, t: T): string {
  if (lead.source === 'API') return t('opw.fromApi');
  if (lead.source === 'SITE') return t('opw.fromSite');
  return t('opw.fromForm');
}

/** Holat belgisining rangi (operator-lid-kartasi: yangi — ko'k, bronda — sariq, …). */
export function statusTone(status: LeadStatus): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  if (status === 'NEW') return 'info';
  if (status === 'BOOKED' || status === 'CALLBACK') return 'warning';
  if (status === 'CONFIRMED') return 'success';
  if (status === 'REJECTED' || status === 'INVALID' || status === 'NO_CONTACT') return 'danger';
  return 'neutral';
}
