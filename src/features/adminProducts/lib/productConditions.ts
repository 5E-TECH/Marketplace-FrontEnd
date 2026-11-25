import type { TranslationKey } from '../../../shared/i18n/translations';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { AdminProduct, ProductPricing } from '../model/adminProductTypes';
import { FIELD_ORDER, validateProductForm, type ProductField, type ProductFormValues } from '../model/productForm';
import type { Condition } from '../ui/SideCard';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

const GROUPS: Partial<Record<ProductField, string>> = {
  name: 'name', categoryId: 'category', description: 'description', images: 'image', weightKg: 'weight',
  lengthCm: 'size', widthCm: 'size', heightCm: 'size', basePrice: 'price',
};

/** To'ldirilmagan majburiy maydonlar — guruhlab («nomi, kategoriya, tavsif, rasm, og'irlik, o'lcham, narx»). */
export function missingFields(values: ProductFormValues, isNew: boolean, t: Translate): string[] {
  const errors = validateProductForm(values, { isNew, requireCodes: false });
  const groups = FIELD_ORDER.filter((field) => errors[field]).map((field) => GROUPS[field]).filter((group): group is string => Boolean(group));
  return [...new Set(groups)].map((group) => t(`apf.group.${group}` as TranslationKey));
}

interface Counts {
  videos: number;
  images: number;
  stock: number | null;
}

/**
 * «Sotuvga chiqish shartlari» — sotuvga chiqmagan mahsulot (…holatlar): qoralama — maydonlar va moderatsiya, ko'rib
 * chiqilmoqda — mahsulot va narx kutilmoqda, rad etilgan — mahsulot bajarilmagan. Video va qoldiq — hamma holatda.
 */
export function workflowConditions(product: AdminProduct, pricing: ProductPricing | undefined, counts: Counts, values: ProductFormValues, t: Translate): Condition[] {
  const contract: Condition = { ok: product.shop?.hasContract !== false, title: t('card.cond.contract'), hint: product.shop?.name ?? null };
  const missing = missingFields(values, false, t);
  const amount = pricing ? formatMoney(pricing.calculation.recommended) : null;
  const mode = pricing ? t(`apf.mode.${pricing.params.deliveryMode}` as TranslationKey) : '';
  const video: Condition = counts.videos
    ? { ok: true, title: t('apf.cond.video'), hint: t('sellerView.media', { videos: counts.videos, images: counts.images }) }
    : { ok: false, title: t('apf.cond.video'), hint: t(product.status === 'REJECTED' ? 'apf.no' : 'apf.cond.videoNone') };
  const stock: Condition = counts.stock
    ? { ok: true, title: t('apf.cond.stock'), hint: t('card.cond.pieces', { count: formatMoney(counts.stock) }) }
    : { ok: false, title: t('apf.cond.stock'), hint: t('apf.cond.noInbound') };
  if (product.status === 'DRAFT') {
    return [
      contract,
      { ok: !missing.length, title: t('apf.cond.fields'), hint: missing.length ? missing.join(', ') : t('apf.cond.fieldsDone') },
      { ok: false, pending: true, title: t('apf.cond.moderation'), hint: t('apf.cond.notSubmitted') },
      video,
      stock,
    ];
  }
  if (product.status === 'ARCHIVED') return [contract, { ok: false, notNeeded: true, title: t('apf.cond.product'), hint: t('apf.cond.archived') }, video, stock];
  const rejected = product.status === 'REJECTED';
  return [
    contract,
    rejected
      ? { ok: false, title: t('apf.cond.product'), hint: t('apf.cond.rejected') }
      : { ok: false, pending: true, title: t('apf.cond.product'), hint: t('apf.cond.inReview') },
    { ok: false, pending: true, title: t('apf.cond.price'), hint: amount ? t(rejected ? 'apf.cond.priceAfter' : 'apf.cond.priceWaiting', { amount, mode }) : null },
    video,
    stock,
  ];
}

/** Yangi mahsulot (hali saqlanmagan): hamma shart «Kutilmoqda», optovik va maydonlar to'ldirilgach — bajarilgan. */
export function newProductConditions(values: ProductFormValues, wholesaler: { name: string; signed: boolean } | null, t: Translate): Condition[] {
  const missing = missingFields(values, true, t);
  return [
    wholesaler
      ? { ok: wholesaler.signed, title: t('apf.cond.contract'), hint: wholesaler.signed ? wholesaler.name : t('apf.wholesaler.unsigned').toLocaleLowerCase() }
      : { ok: false, pending: true, title: t('apf.cond.contract'), hint: t('apf.cond.notChosen') },
    missing.length
      ? { ok: false, pending: true, title: t('apf.cond.fields'), hint: missing.join(', ') }
      : { ok: true, title: t('apf.cond.fields'), hint: t('apf.cond.fieldsDone') },
    { ok: false, pending: true, title: t('apf.cond.moderation'), hint: t('apf.cond.afterSubmit') },
    values.videos.length
      ? { ok: true, title: t('apf.cond.video'), hint: t('sellerView.media', { videos: values.videos.length, images: values.images.length }) }
      : { ok: false, pending: true, title: t('apf.cond.video'), hint: t('apf.cond.videoForOffer') },
    { ok: false, pending: true, title: t('apf.cond.stock'), hint: t('apf.cond.afterInbound') },
  ];
}
