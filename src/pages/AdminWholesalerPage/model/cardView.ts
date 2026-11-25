import type { Wholesaler } from '../../../features/wholesalers/model/wholesalerTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Kartadagi oynalar — `?dialog=` (ro'yxat menyusidan ham shu yo'l bilan ochiladi). */
export const CARD_DIALOGS = ['contract', 'invite', 'suspend', 'resume', 'act', 'bank', 'review'] as const;
export type CardDialog = (typeof CARD_DIALOGS)[number];
/** Oynaga oldindan beriladigan qiymat: tanlangan shartnoma fayli yoki akt. */
export interface DialogOptions {
  file?: File | null;
  actId?: string;
}

export const parseDialog = (value: string | null): CardDialog | null => ((CARD_DIALOGS as readonly string[]).includes(value ?? '') ? (value as CardDialog) : null);

/** Karta yorliqlari — `?tab=`. */
export const CARD_TABS = ['general', 'products', 'shipments', 'stock', 'returns', 'money', 'documents', 'history'] as const;
export type CardTab = (typeof CARD_TABS)[number];
export const parseCardTab = (value: string | null): CardTab => ((CARD_TABS as readonly string[]).includes(value ?? '') ? (value as CardTab) : 'general');

/** «Yuridik shaxs (MChJ)» — tashkiliy shakl nomidan; YaTT. */
export function legalTypeLabel(wholesaler: Pick<Wholesaler, 'legalType' | 'name'>, t: T): string {
  if (wholesaler.legalType === 'SOLE_PROPRIETOR') return t('whk.legal.SOLE_PROPRIETOR');
  const form = /(^|\s)(MChJ|AJ|OAJ|XK|QK|DUK)(\s|$)/.exec(wholesaler.name)?.[2];
  return form ? t('whk.legal.entityForm', { form }) : t('whk.legal.LEGAL_ENTITY');
}
