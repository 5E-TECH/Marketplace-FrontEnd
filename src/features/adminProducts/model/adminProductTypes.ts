import type { components } from '../../../generated/api-types';

type Schemas = components['schemas'];

/**
 * Admin: mahsulot moderatsiyasi va offer sozlash (FE-12). Asos — BE-07 `ProductDto`; ixtiyoriy maydonlar —
 * taklif (docs/api-taklif/fe-12-admin-moderatsiya.md). Alohida faylda: mock (`src/mocks`) ham ishlatadi,
 * u esa `httpClient` ni import qilmasligi kerak.
 */
export type ProductStatus = Schemas['ProductDto']['status'];
export type DeliveryMode = NonNullable<Schemas['PricePolicyDto']['deliveryMode']>;
export type PriceStatus = Schemas['PriceDecisionViewDto']['status'];

/** Taklif, 1-bo'lim: backend qo'shguncha kelmasligi mumkin — UI zaxira qiymat ko'rsatadi. */
export interface AdminProductExtras {
  shop?: { id: string; name: string; hasContract?: boolean } | null;
  subtitle?: string | null;
  submittedAt?: string | null;
  statusChangedAt?: string | null;
  /** Holatni o'zgartirgan admin («14.01.2027, 14:37 · Nodira K.»). */
  statusChangedBy?: string | null;
  blockReason?: string | null;
  expiryTracked?: boolean;
  certificate?: ProductCertificate | null;
}

export interface ProductCertificate {
  name: string;
  url: string;
  uploadedAt: string;
}

/** Sxemada `unknown` bo'lib chiqqan maydonlar (bigint, text, jsonb) aniq tip bilan — `normalizeProduct` beradi. */
type ProductDtoFields = Omit<Schemas['ProductDto'], 'categoryId' | 'description' | 'imageUrl' | 'oldPrice' | 'attributes'> & {
  categoryId: string | null;
  description: string | null;
  imageUrl: string | null;
  oldPrice: number | null;
  attributes: Record<string, unknown>;
};

export type AdminProduct = ProductDtoFields & AdminProductExtras & { results?: OfferResults | null };

/** Taklif, 1-bo'lim: «Mahsulotlar va offerlar» jadvali uchun ro'yxat elementidagi qo'shimchalar. */
export interface AdminProductListExtras {
  stock?: ProductStockSummary | null;
  results?: OfferResults | null;
  /** «Narx — mijoz ko'radi»: tasdiqlangan narx yoki (`recommended`) tavsiya; `ProductDto.price` — eski storefront narxi. */
  listPrice?: { customer: number; recommended: boolean; delivery: number; deliveryMode: DeliveryMode } | null;
  hasVideo?: boolean;
}

/** Hamma sotuvchi, sotuvga chiqqandan beri (taklif). Ro'yxatda — birinchi to'rttasi, kartada — hammasi. */
export interface OfferResults {
  leads: number;
  epc: number | null;
  approveRate: number | null;
  saleRate: number | null;
  clicks?: number;
  validLeads?: number;
  confirmed?: number;
  delivered?: number;
  refused?: number;
  inTransit?: number;
  revenue?: number;
}

export interface ProductStockSummary {
  available: number;
  onHand: number;
  reserved: number;
  incoming: number;
}

export type AdminProductListItem = AdminProduct & AdminProductListExtras;

export interface AdminProductsPage {
  items: AdminProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** «Mahsulotlar» yorliqlari: holat yoki «To'xtatilgan» (`isBlocked`). */
export type ProductListTab = 'ALL' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'BLOCKED' | 'DRAFT';

/** Taklif, 2-bo'lim: `GET /admin/moderation/summary`. */
export interface ModerationSummary {
  productsPending: number;
  pricesPending: number;
  byStatus: Record<ProductListTab, number>;
  outOfStock: number;
  expirySoon: number;
}

/** BE-08 (PR #127, merge kutilmoqda) — sxemaga kirguncha qo'lda. */
export type CreativeType = 'IMAGE' | 'VIDEO';

export interface Creative {
  id: string;
  productId: string;
  type: CreativeType;
  url: string;
  mimeType: string;
  size: number;
  position: number;
  createdAt: string;
  /** Taklif (FE-05 bilan bir xil): «asosiy», «g'ilofda» — kelmasa faqat «Rasm 2/4». */
  caption?: string | null;
  /** Video davomiyligi, soniya (taklif) — «Video · 0:28». */
  durationSec?: number | null;
}

export interface CreativeUploadPolicy {
  url: string;
  fields: Record<string, string>;
  objectKey: string;
  expiresAt: string;
  maxSize: number;
}

export type OfferContent = Schemas['OfferContentDto'];

/** Narx parametrlari (ADM-2; global → kategoriya → mahsulot qatlamlari birlashgani). Pul — so'mda, foiz — ulush. */
export interface PricingParams {
  /** K — har sotuvdagi qat'iy xarajatlar, sotilish 70% (TZ 2.1: 29 688). */
  kSale70: number;
  /** K — har tasdiqlangan buyurtma sotilganda (qat'iy pastki chegara, 15 232). */
  kSale100: number;
  /** M — platformaning maqsadli minimal natijasi (9 000). */
  targetMargin: number;
  taxRate: number;
  paymentRate: number;
  callCenterFee: number;
  affiliateCoef: number;
  adCost: number;
  markupCapPercent: number;
  deliveryMode: DeliveryMode;
  visibleCenter: number;
  visibleAddress: number;
  /** Taklif: yetkazish rejimi qaysi qatlamdan («qisman, global sozlamadan»). */
  deliveryModeSource?: PolicySource | null;
}

export type PolicySource = 'GLOBAL' | 'CATEGORY' | 'PRODUCT';

export interface PricingDelivery {
  tariffCenter: number;
  tariffAddress: number;
  visibleCenter: number;
  visibleAddress: number;
  /** Tovar narxiga qo'shiladigan yashirilgan qism (markazgacha tarif − ko'rinadigan). */
  hidden: number;
  /** Yashirilgan qism ÷ (1 − soliq − to'lov), 1 000 ga yuqoriga. */
  hiddenPriceAdd: number;
}

export interface PriceEvaluation {
  status: PriceStatus;
  price: number;
  /** To'rt qator taqsimot (TZ 2.2) va yashirilgan yetkazish; platforma xizmati — qoldiq. */
  split: { wholesaler: number; affiliate: number; callCenter: number; platformService: number; hiddenDelivery: number };
  platformResult70: number;
  platformResult100: number;
  /** Sotuvchi natijasi: haq − reklama xarajati. */
  affiliateResult: number;
  belowRecommended: number;
  /** NRX-13: hech kim zarar ko'rmaydigan eng katta sotuvchi haqi; yo'q bo'lsa — null. */
  safeAffiliateFee: number | null;
  /** Taklif: platforma zarar ko'rmaydigan eng katta haq (reklama xarajatidan kam bo'lsa ham) — qizil holat izohi. */
  maxAffiliateFee?: number | null;
}

/** Taklif: uch rejim solishtiruvi — har rejimda tavsiya tovar narxi, ko'rinadigan yetkazish va natija. */
export interface PricingModeRow {
  mode: DeliveryMode;
  goodsPrice: number;
  delivery: number;
  customerTotal: number;
  platformResult70: number;
  platformResult100: number;
}

/** Bozor narxi tekshiruvi (NRX-5): `POST …/market-check` javobi; `source`, `checkedAt` — taklif. */
export interface MarketCheckResult {
  competitorTotal: number;
  ourTotal: number;
  verdict: 'MOS' | 'QIMMAT';
  maxBasePrice: number | null;
  source?: string | null;
  checkedAt?: string | null;
}

/**
 * `GET /admin/products/{id}/pricing` (BE-09) — sxemada javob tipsiz; shakl `catalog-service/src/pricing.service.ts`
 * `view()` va `@app/common` `price-calculator` dan. Hisob faqat serverda — UI natijani ko'rsatadi (FE-13).
 * Ixtiyoriy maydonlar — taklif (docs/api-taklif/fe-13-admin-narx.md).
 */
export interface ProductPricing {
  productId: string;
  /** Tasdiq joriymi: asos o'zgarib holat yomonlashgan bo'lsa — false (narx navbatiga qaytadi). */
  approvalCurrent: boolean;
  params: PricingParams;
  tariff: { centerBase: number; baseWeightGrams: number; perExtraKg: number; addressExtra: number };
  recommendedAffiliateFee: number;
  calculation: {
    basePrice: number;
    affiliateFee: number;
    recommendedBase: number;
    /** Taklif: tavsiya 1 000 ga yaxlitlanmasdan (formula izohidagi «= 250 120»). */
    recommendedBaseExact?: number;
    breakevenBase: number;
    hardFloorBase: number;
    delivery: PricingDelivery;
    /** Mijoz ko'radigan tavsiya tovar narxi (joriy rejimda). */
    recommended: number;
    yellowFrom: number;
    orangeFrom: number;
    platformSharePercent: number;
  };
  /** Kiritilgan (yoki tasdiqlangan, yo'q bo'lsa tavsiya) narx holati. */
  evaluation: PriceEvaluation | null;
  approvedPrice: number | null;
  priceStatus: PriceStatus | null;
  marketTotal: number | null;
  maxSalePrice: number | null;
  /** Taklif: uch rejim solishtiruvi. */
  modes?: PricingModeRow[];
  /** Taklif: oxirgi bozor narxi tekshiruvi (manba bilan). */
  market?: MarketCheckResult | null;
}

/** Taklif: narx navbati qatori (`GET /admin/moderation/prices`) — optovik narxi → tavsiya. */
export interface PriceQueueItem {
  productId: string;
  name: string;
  shopName: string | null;
  basePrice: number;
  recommended: number;
  deliveryMode: DeliveryMode;
  /** Narx navbatiga tushgan vaqt (yuborilgan yoki asos o'zgargan). */
  queuedAt: string;
}

/** `reason` sxemada satr, lekin sababsiz qarorda backend `null` qaytaradi. */
export type PriceDecision = Omit<Schemas['PriceDecisionViewDto'], 'reason'> & { reason: string | null; decidedByName?: string | null };

/** Taklif, 3-bo'lim: shu mahsulot audit yozuvlari (`identity.audit.log`: action + meta). */
export interface ProductAuditEntry {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  meta: Record<string, unknown>;
}
