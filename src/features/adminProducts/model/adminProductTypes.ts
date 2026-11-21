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

/**
 * `GET /admin/products/{id}/pricing` (BE-09) — sxemada javob tipsiz; FE-12 o'qiydigan qismi
 * (`catalog-service/src/pricing.service.ts` `view()`, `@app/common` `price-calculator`).
 */
export interface ProductPricing {
  productId: string;
  approvalCurrent: boolean;
  params: {
    adCost: number;
    affiliateCoef: number;
    markupCapPercent: number;
    deliveryMode: DeliveryMode;
    /** Tushum solig'i va to'lov xarajati (TZ 2.1) — haq oynasidagi formula uchun. */
    taxRate?: number;
    paymentRate?: number;
  };
  tariff: { centerBase: number; baseWeightGrams: number; perExtraKg: number; addressExtra: number };
  recommendedAffiliateFee: number;
  calculation: {
    recommendedBase: number;
    recommended: number;
    delivery: { tariffCenter: number; visibleCenter: number; visibleAddress: number; hidden: number };
  };
  evaluation: { status: PriceStatus; price: number; platformResult70: number; affiliateResult: number } | null;
  approvedPrice: number | null;
  priceStatus: PriceStatus | null;
  maxSalePrice: number | null;
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
