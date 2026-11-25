import type { Category } from '../../categories/model/categoryTypes';
import { categorySlug } from '../../categories/lib/categorySlug';
import type { TranslationKey } from '../../../shared/i18n/translations';
import type { AdminProduct } from './adminProductTypes';

/**
 * Mahsulot formasi (FE-25, OPT-2; admin-mahsulot-karta «Asosiy»): optovik nomidan admin kiritadi. Og'irlik — kg,
 * o'lchamlar — sm (dizayn), backend — gramm va mm (BE-07 `CreateProductDto`); bazaviy narx — butun so'm.
 */
export interface ProductFormValues {
  wholesalerId: string;
  name: string;
  slug: string;
  categoryId: string;
  /** Taklif (fe-12 §1): «Qisqa tavsif» — nom ostidagi bir qator. */
  subtitle: string;
  description: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  basePrice: string;
  /** `null` — kategoriyadan (meros); `true`/`false` — mahsulotning o'zida belgilangan. */
  isBad: boolean | null;
  expiryTracked: boolean | null;
  /** BE-41: fiskal chek qatori — CPA mahsuloti ularsiz tasdiqlanmaydi. */
  mxikCode: string;
  packageCode: string;
  /** Yangi mahsulot: yuklangan rasm va video URL lari (kamida bitta rasm — backend talabi). */
  images: string[];
  videos: string[];
}

export type ProductField = keyof ProductFormValues;
export type ProductErrors = Partial<Record<ProductField, ProductErrorCode>>;

const decimal = (value: string) => value.trim().replace(',', '.');
/** «0.3» kg → 300 g; «32» sm → 320 mm. Butun bo'lmagan sonlar yaxlitlanadi. */
export const toGrams = (kg: string) => Math.round(Number(decimal(kg)) * 1000);
export const toMm = (cm: string) => Math.round(Number(decimal(cm)) * 10);
const fromGrams = (grams: number | null | undefined) => (grams ? String(grams / 1000) : '');
const fromMm = (mm: number | null | undefined) => (mm ? String(mm / 10) : '');
export const moneyDigits = (value: string) => value.replace(/\D/g, '');

export function emptyProductForm(wholesalerId = ''): ProductFormValues {
  return {
    wholesalerId, name: '', slug: '', categoryId: '', subtitle: '', description: '', weightKg: '', lengthCm: '', widthCm: '', heightCm: '',
    basePrice: '', isBad: null, expiryTracked: null, mxikCode: '', packageCode: '', images: [], videos: [],
  };
}

export function formFromProduct(product: AdminProduct): ProductFormValues {
  return {
    wholesalerId: product.shopId,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId ?? '',
    subtitle: product.subtitle ?? '',
    description: product.description ?? '',
    weightKg: fromGrams(product.weightGrams),
    lengthCm: fromMm(product.lengthMm),
    widthCm: fromMm(product.widthMm),
    heightCm: fromMm(product.heightMm),
    basePrice: product.basePrice === null || product.basePrice === undefined ? '' : String(product.basePrice),
    // BE-07: `isBad` — o'z belgisi (`false` — kategoriyadan, `badByCategory`); `expiryTracked` — samarali qiymat, o'z
    // belgisi backendda yo'q (taklif) — forma kategoriyadan meros deb ochiladi.
    isBad: product.isBad ? true : null,
    expiryTracked: null,
    mxikCode: product.mxikCode ?? '',
    packageCode: product.packageCode ?? '',
    images: product.images,
    videos: [],
  };
}

/** Slug nomdan avtomatik (kategoriyadagi kabi); qo'lda o'zgartirilsa — o'sha. */
export const productSlug = (name: string) => categorySlug(name);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const positive = (value: string) => {
  const number = Number(decimal(value));
  return value.trim() !== '' && Number.isFinite(number) && number > 0;
};

export type ProductErrorCode = 'required' | 'weight' | 'dimension' | 'slug' | 'price' | 'mxik' | 'package' | 'image' | 'contract' | 'slugTaken';

/** Backend maydon nomi → forma maydoni (gramm va mm — kg va sm katakchalari). */
const API_FIELDS: Record<string, ProductField> = {
  weightGrams: 'weightKg', lengthMm: 'lengthCm', widthMm: 'widthCm', heightMm: 'heightCm', imageUrl: 'images', images: 'images',
  name: 'name', slug: 'slug', categoryId: 'categoryId', subtitle: 'subtitle', description: 'description', basePrice: 'basePrice',
  mxikCode: 'mxikCode', packageCode: 'packageCode', wholesalerId: 'wholesalerId',
};
const FIELD_CODES: Partial<Record<ProductField, ProductErrorCode>> = {
  weightKg: 'weight', lengthCm: 'dimension', widthCm: 'dimension', heightCm: 'dimension', slug: 'slug', basePrice: 'price', mxikCode: 'mxik', packageCode: 'package', images: 'image',
};

/**
 * Server xatosi → maydon xatolari: 409 va `slug` — «slug band» (BE-07 TC4), boshqa 409 — shartnomasiz optovik (OPT-1),
 * 400 `details[].field` — o'sha maydon. Hech biriga tushmasa — bo'sh (umumiy xabar ko'rsatiladi).
 */
export function productErrorsFromApi(status: number | null, fields: readonly string[]): ProductErrors {
  if (status === 409) return fields.includes('slug') ? { slug: 'slugTaken' } : { wholesalerId: 'contract' };
  const errors: ProductErrors = {};
  for (const name of fields) {
    const field = API_FIELDS[name];
    if (field) errors[field] = FIELD_CODES[field] ?? 'required';
  }
  return errors;
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Xato kodi → matn (maydon nomi bilan); `slugTaken` — band qilgan mahsulot nomi va taklif slug (BE-07 TC4). */
export function errorText(field: ProductField, code: ProductErrorCode | undefined, t: Translate, extra: { conflictName?: string | null; slug?: string } = {}): string | undefined {
  if (!code) return undefined;
  if (code === 'slugTaken') {
    return extra.conflictName
      ? t('apf.error.slugTaken', { name: extra.conflictName, slug: extra.slug ?? '' })
      : t('apf.error.slugTakenShort', { slug: extra.slug ?? '' });
  }
  return t(`apf.error.${code}` as TranslationKey, { field: t(`apf.field.${field}` as TranslationKey) });
}

/** Xato maydonlar — ekrandagi tartibda (xatolar xulosasi va birinchi xatoga fokus). */
export const FIELD_ORDER: readonly ProductField[] = [
  'wholesalerId', 'name', 'slug', 'categoryId', 'subtitle', 'description', 'images', 'weightKg', 'lengthCm', 'widthCm', 'heightCm', 'mxikCode', 'packageCode', 'basePrice',
];

/**
 * Tekshiruv backenddagidek: nomi, kategoriya, tavsif, og'irlik (> 0), uch o'lcham (> 0), bazaviy narx (butun so'm);
 * yangi mahsulotda kamida bitta rasm. Sotuvdagi CPA mahsulotida MXIK (17 raqam) va qadoq kodi (raqam) — majburiy (BE-41).
 */
export function validateProductForm(values: ProductFormValues, options: { isNew: boolean; requireCodes: boolean }): ProductErrors {
  const errors: ProductErrors = {};
  if (!values.wholesalerId) errors.wholesalerId = 'required';
  if (!values.name.trim()) errors.name = 'required';
  if (!values.slug.trim()) errors.slug = 'required';
  else if (!SLUG.test(values.slug.trim())) errors.slug = 'slug';
  if (!values.categoryId) errors.categoryId = 'required';
  if (!values.description.trim()) errors.description = 'required';
  if (!positive(values.weightKg)) errors.weightKg = values.weightKg.trim() ? 'dimension' : 'weight';
  for (const field of ['lengthCm', 'widthCm', 'heightCm'] as const) {
    if (!positive(values[field])) errors[field] = values[field].trim() ? 'dimension' : 'required';
  }
  if (!moneyDigits(values.basePrice) || Number(moneyDigits(values.basePrice)) <= 0) errors.basePrice = values.basePrice.trim() ? 'price' : 'required';
  if (values.mxikCode.trim() && !/^\d{17}$/.test(values.mxikCode.trim())) errors.mxikCode = 'mxik';
  if (values.packageCode.trim() && !/^\d{1,20}$/.test(values.packageCode.trim())) errors.packageCode = 'package';
  if (options.requireCodes) {
    if (!values.mxikCode.trim()) errors.mxikCode = 'required';
    if (!values.packageCode.trim()) errors.packageCode = 'required';
  }
  if (options.isNew && !values.images.length) errors.images = 'image';
  return errors;
}

/** API tanasi (`AdminCreateProductDto` / `AdminUpdateProductDto`). `slug`, `subtitle`, `expiryTracked`, `videos` — taklif. */
export function productBody(values: ProductFormValues) {
  const optionalText = (value: string) => (value.trim() ? value.trim() : null);
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    categoryId: values.categoryId || null,
    subtitle: optionalText(values.subtitle),
    description: values.description.trim(),
    weightGrams: toGrams(values.weightKg),
    lengthMm: toMm(values.lengthCm),
    widthMm: toMm(values.widthCm),
    heightMm: toMm(values.heightCm),
    basePrice: Number(moneyDigits(values.basePrice)),
    isBad: values.isBad === true,
    expiryTracked: values.expiryTracked ?? undefined,
    mxikCode: optionalText(values.mxikCode),
    packageCode: optionalText(values.packageCode),
  };
}

export type ProductBody = ReturnType<typeof productBody>;

/** Faqat o'zgargan maydonlar (PATCH): `null` bilan tozalash — faqat MXIK va qadoq kodi uchun ruxsat (BE-07). */
export function changedFields(values: ProductFormValues, initial: ProductFormValues): Partial<ProductBody> {
  const next = productBody(values);
  const before = productBody(initial);
  const changed: Partial<ProductBody> = Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key as keyof ProductBody])));
  return changed;
}

export function isDirty(values: ProductFormValues, initial: ProductFormValues): boolean {
  return JSON.stringify(values) !== JSON.stringify(initial);
}

/** Kategoriya bayrog'i (BAD, muddat) — o'zida yoki eng yaqin otadan; hech qayerda bo'lmasa — yo'q. */
export function inheritedFlag(categories: readonly Category[], categoryId: string, flag: 'isBad' | 'expiryTracked'): { value: boolean; from: string | null } {
  const byId = new Map<string, Category>();
  const collect = (items: readonly Category[]) => items.forEach((item) => { byId.set(item.id, item); collect(item.children); });
  collect(categories);
  for (let current = byId.get(categoryId); current; current = current.parentId ? byId.get(current.parentId) : undefined) {
    const value = current[flag];
    if (value !== null && value !== undefined) return { value, from: current.id === categoryId ? null : current.name };
  }
  return { value: false, from: null };
}
