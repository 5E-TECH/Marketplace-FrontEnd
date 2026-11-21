import type { TranslationKey } from '../../../shared/i18n/translations';
import { tashkentClock, tashkentDay } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { Creative, ProductAuditEntry } from '../model/adminProductTypes';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «1.6» — kilogramm, nuqta bilan (admin-moderatsiya «1.6 kg»). */
export const formatKg = (grams: number) => String(Math.round(grams / 10) / 100);

/** mm → sm: «32 × 14 × 17». */
export const formatCm = (mm: number) => String(Math.round(mm) / 10);

/** «13.01.2027 17:20» — Toshkent vaqti. */
export const formatStamp = (iso: string) => `${tashkentDay(iso)} ${tashkentClock(Date.parse(iso))}`;

const STATUS_KEYS = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED', 'OUT_OF_STOCK'];
const statusName = (t: Translate, code: unknown) =>
  typeof code !== 'string' ? '—' : STATUS_KEYS.includes(code) ? t(`status.product.${code}` as TranslationKey) : code;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const money = (value: unknown) => (typeof value === 'number' ? formatMoney(value) : '—');

/** Audit yozuvi → «O'zgarish» matni (`identity.audit.log`: action + meta). Noma'lum amal — kodi bilan. */
export function auditChange(entry: ProductAuditEntry, t: Translate): string {
  const { meta } = entry;
  switch (entry.action) {
    case 'product.certificate': return t('audit.product.certificate', { file: text(meta.fileName) });
    case 'product.submit': return t('audit.product.submit', { from: statusName(t, meta.from), to: statusName(t, meta.to) });
    case 'product.approve': return t('audit.product.approve', { from: statusName(t, meta.from ?? 'PENDING_REVIEW'), to: statusName(t, 'ACTIVE') });
    case 'product.reject': return t('audit.product.reject', { reason: text(meta.reason) });
    case 'product.hide': return t('audit.product.hide', { reason: text(meta.reason) });
    case 'product.reactivate': return t('audit.product.reactivate');
    case 'product.update': return t('audit.product.update');
    case 'product.create': return t('audit.product.create');
    case 'price.recommended': return t('audit.price.recommended', { base: money(meta.recommendedBase), customer: money(meta.recommended) });
    case 'price.decision': return t('audit.price.decision', { price: money(meta.price), fee: money(meta.affiliateFee) });
    case 'creative.create':
    case 'creative.delete': {
      const type = meta.type === 'VIDEO' || meta.type === 'IMAGE' ? t(`audit.creative.${meta.type}`) : '—';
      return t(entry.action === 'creative.create' ? 'audit.creative.create' : 'audit.creative.delete', { type });
    }
    case 'offer.content': return t('audit.offer.content');
    default: return entry.action;
  }
}

/** «Video» yoki «Rasm 2/4» — kutubxonadagi tartib bo'yicha. */
export function creativeLabel(creative: Creative, creatives: readonly Creative[], t: Translate): string {
  if (creative.type === 'VIDEO') return t('aoffer.creativeVideo');
  const images = creatives.filter((item) => item.type === 'IMAGE');
  return t('aoffer.creativeImage', { index: images.indexOf(creative) + 1, total: images.length });
}
