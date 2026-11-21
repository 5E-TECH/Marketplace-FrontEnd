import type { TranslationKey } from '../../../shared/i18n/translations';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { CategoryRow, ProductCounts, Resolved } from './categoryRows';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Jadvalda: «o'zida», «otadan», «globaldan», «sukut». */
export const sourceLabel = (t: Translate, source: Resolved<unknown>['source']) => t(`acat.src.${source}` as TranslationKey);

/** Panelda ota kategoriya nomi bilan: «Go‘zallik va salomatlik»dan. */
export const panelSourceLabel = (t: Translate, resolved: Resolved<unknown>) =>
  resolved.source === 'parent' && resolved.from ? t('acat.src.from', { name: resolved.from }) : sourceLabel(t, resolved.source);

/** Yetkazish ko'rinishining manbai: o'zida yozilgan qismlar («o'zida: eshikkacha») yoki globaldan. */
export function deliverySource(t: Translate, row: Pick<CategoryRow, 'mode' | 'center' | 'door'>): string {
  const own = [
    row.mode.source === 'own' ? t('acat.param.mode').toLowerCase() : null,
    row.center.source === 'own' ? t('acat.center') : null,
    row.door.source === 'own' ? t('acat.door') : null,
  ].filter(Boolean);
  return own.length ? t('acat.src.ownOf', { what: own.join(', ') }) : t('acat.src.global');
}

export const modeLabel = (t: Translate, mode: string | null | undefined) => (mode ? t(`acat.mode.${mode}` as TranslationKey) : '—');

export const plainMoney = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatMoney(value));

/** «4 mahsulot · 2 faol», «1 mahsulot · 1 rad etilgan», «1 mahsulot ichkarida», «0 mahsulot». */
export function productSummary(t: Translate, counts: ProductCounts): string {
  if (!counts.total) return counts.inside ? t('acat.productsInside', { count: counts.inside }) : t('acat.products', { count: 0 });
  const base = t('acat.products', { count: counts.total });
  if (counts.active) return `${base} · ${t('acat.activeCount', { count: counts.active })}`;
  return counts.rejected ? `${base} · ${t('acat.rejectedCount', { count: counts.rejected })}` : base;
}

/** Telefon chipi: «BAD: yo‘q», «BAD: ha · o‘zida», «Muddat: ha · otadan». */
export function flagChip(t: Translate, label: string, resolved: Resolved<boolean>): string {
  const value = t(resolved.value ? 'acat.chipYes' : 'acat.chipNo');
  return resolved.source === 'default' ? `${label}: ${value}` : `${label}: ${value} · ${sourceLabel(t, resolved.source)}`;
}
