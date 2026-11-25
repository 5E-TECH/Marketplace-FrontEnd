import type { TranslationKey } from '../../../shared/i18n/translations';
import type { StatusCode } from '../../../shared/ui/StatusBadge/statusConfig';
import type { AdminProduct } from '../model/adminProductTypes';

/**
 * Mahsulot moderatsiyasi (ADM-1; admin-moderatsiya «Qaror»): holat belgisi, admin belgilaydigan qoidalar
 * va tizim tekshiruvlari bitta joyda — moderatsiya sahifasi va mahsulot kartasi shundan foydalanadi.
 */

/** Belgi: `isBlocked` holatdan ustun — admin to'xtatgan mahsulot «To'xtatilgan». */
export const productBadgeCode = (product: Pick<AdminProduct, 'status' | 'isBlocked'>): StatusCode<'product'> =>
  product.isBlocked ? 'BLOCKED' : product.status;

export interface ModerationRule {
  key: string;
  title: TranslationKey;
  /** Qo'llanadigan bandning izohi. */
  hint: TranslationKey;
  /** Berilmasa — har doim qo'llanadi; aks holda qo'llanmaganda `naHint` bilan o'chiq qator. */
  applies?: (product: AdminProduct) => boolean;
  naHint?: TranslationKey;
}

/** «Tekshiruv — mahsulot qoidalari» (TZ 7, 8; ADM-1). BAD va muddat bandlari — faqat tegishli toifada. */
export const MODERATION_RULES: readonly ModerationRule[] = [
  { key: 'banned', title: 'moderation.rule.banned', hint: 'moderation.rule.bannedHint' },
  { key: 'cure', title: 'moderation.rule.cure', hint: 'moderation.rule.cureHint' },
  { key: 'reviews', title: 'moderation.rule.reviews', hint: 'moderation.rule.reviewsHint' },
  { key: 'discount', title: 'moderation.rule.discount', hint: 'moderation.rule.discountHint' },
  { key: 'certificate', title: 'moderation.rule.certificate', hint: 'moderation.rule.certificateHint' },
  { key: 'notMedicine', title: 'moderation.rule.notMedicine', hint: 'moderation.rule.notMedicineHint', applies: (product) => product.isBad, naHint: 'moderation.rule.notMedicineNa' },
  { key: 'expiry', title: 'moderation.rule.expiry', hint: 'moderation.rule.expiryHint', applies: (product) => Boolean(product.expiryTracked), naHint: 'moderation.rule.expiryNa' },
];

export const appliesTo = (rule: ModerationRule, product: AdminProduct) => rule.applies?.(product) ?? true;

export interface SystemCheck {
  key: string;
  passes: (product: AdminProduct) => boolean;
  ok: TranslationKey;
  fail: TranslationKey;
}

/**
 * «Tizim tekshirdi» — backend tasdiqda ham tekshiradi (BE-07 `adminApprove`): optovik shartnomasi (OPT-1),
 * bazaviy narx, og'irlik va o'lcham, CPA uchun MXIK va qadoq kodi (BE-41). Slug takrori saqlashda rad etiladi — bu yerda
 * har doim bajarilgan.
 */
export const SYSTEM_CHECKS: readonly SystemCheck[] = [
  { key: 'contract', passes: (product) => product.shop?.hasContract !== false, ok: 'moderation.system.contract', fail: 'moderation.system.contractMissing' },
  {
    key: 'size',
    passes: (product) => product.basePrice !== null && Boolean(product.weightGrams && product.lengthMm && product.widthMm && product.heightMm),
    ok: 'moderation.system.size',
    fail: 'moderation.system.sizeMissing',
  },
  { key: 'slug', passes: () => true, ok: 'moderation.system.slug', fail: 'moderation.system.slug' },
  // BE-41: CPA mahsuloti fiskal chek uchun MXIK va qadoq kodisiz tasdiqlanmaydi (kodlar — mahsulot formasida, FE-25).
  {
    key: 'fiscal',
    passes: (product) => !product.cpaEnabled || Boolean(product.mxikCode && product.packageCode),
    ok: 'moderation.system.fiscal',
    fail: 'moderation.system.fiscalMissing',
  },
];

/** Tizim tekshiruvidan biri o'tmasa — backend tasdiqni rad etadi; «Mahsulotni tasdiqlash» o'chiq, sababi ko'rsatiladi. */
export const systemBlocked = (product: AdminProduct) => SYSTEM_CHECKS.some((check) => !check.passes(product));

/** Rad etish sababi: backend `RejectProductDto` — bo'sh emas, 500 belgigacha. */
export const REJECT_REASON_MAX = 500;
