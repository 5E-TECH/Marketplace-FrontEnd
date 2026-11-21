import type { components } from '../../generated/api-types';
import type {
  AdminProductListItem,
  Creative,
  DeliveryMode,
  OfferContent,
  PriceStatus,
  ProductAuditEntry,
  ProductPricing,
} from '../../features/adminProducts/model/adminProductTypes';
import { mockOffers, OFFER_CATEGORIES, type MockOffer } from './offers';

type Schemas = components['schemas'];

/**
 * Admin mahsulotlari (FE-12): 501–505 — sotuvchi offerlari (`fixtures/offers.ts`) bilan bir xil sonlar;
 * 506 «Bug‘li dazmol» — moderatsiya namunasi (admin-moderatsiya); 507 rad etilgan BAD; 508 qoralama;
 * 509 — narxi va videosi tayyor, tasdiqlansa katalogga chiqadi (TC1); 510 — faol, lekin videosiz (TC5).
 */
export const MOCK_SHOP = { id: '7', name: 'Namuna Savdo MChJ', hasContract: true };

/** Admin kategoriyalari (tekis ro'yxat — mock CRUD uchun); BAD va muddat — taklif (9-bo'lim). */
export type MockCategory = Omit<Schemas['CategoryTreeDto'], 'children'> & { isBad: boolean | null; expiryTracked: boolean | null };

export function mockCategories(): MockCategory[] {
  return [
    ...OFFER_CATEGORIES.map(({ id, name, slug, parentId, iconUrl, sortOrder, isActive }) => ({ id, name, slug, parentId, iconUrl, sortOrder, isActive, isBad: null, expiryTracked: null })),
    { id: '14', name: 'Go‘zallik va salomatlik', slug: 'gozallik-va-salomatlik', parentId: null, iconUrl: null, sortOrder: 3, isActive: true, isBad: null, expiryTracked: true },
    { id: '15', name: 'Biologik faol qo‘shimchalar', slug: 'biologik-faol-qoshimchalar', parentId: '14', iconUrl: null, sortOrder: 0, isActive: true, isBad: true, expiryTracked: null },
    { id: '16', name: 'Kosmetika', slug: 'kosmetika', parentId: '14', iconUrl: null, sortOrder: 1, isActive: true, isBad: null, expiryTracked: null },
  ];
}

/** Daraxt: ota → bolalar, `sortOrder` bo'yicha. */
export function categoryTree(items: readonly MockCategory[], parentId: string | null = null): (MockCategory & { children: unknown[] })[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({ ...item, children: categoryTree(items, item.id) }));
}

/** Kategoriya narx sozlamasi qatlamlari (null — globaldan): Uy-ro'zg'or — eshikkacha o'zida. */
export const mockCategoryPolicies = (): Record<string, Partial<Schemas['PricePolicyDto']>> => ({ '12': { visibleAddress: 45_000 } });

/** Narx sozlamasi audit yozuvi (backend `admin-pricing.controller.ts` `setPolicy`): before/after — qatlamlar. */
export interface MockPolicyAudit {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: 'pricing.policy.update';
  entityType: 'PricePolicy';
  entityId: string;
  meta: { scope: 'GLOBAL' | 'CATEGORY' | 'PRODUCT'; before: Record<string, unknown> | null; after: Record<string, unknown> };
}

export const mockPolicyAudit = (): MockPolicyAudit[] => [{
  id: 'A-P-12-1', createdAt: minutesAgo(3 * 24 * 60 + 200), actorId: '7', actorName: 'Nodira Karimova', action: 'pricing.policy.update', entityType: 'PricePolicy',
  entityId: '12', meta: { scope: 'CATEGORY', before: { visibleAddress: 50_000 }, after: { visibleAddress: 45_000 } },
}];

export const GLOBAL_POLICY: Schemas['PricePolicyDto'] = {
  kSale70: 1.43, kSale100: 1, targetMargin: 0.1, taxRate: 0.04, paymentRate: 0.0185, callCenterFee: 12_000, affiliateCoef: 1.29,
  adCost: 50_420, markupCapPercent: 10, deliveryMode: 'PARTIAL', visibleCenter: 30_000, visibleAddress: 50_000,
};

/** Mock ichki maydonlari javobga chiqmaydi (`productResponse`). */
export interface MockAdminProduct extends AdminProductListItem {
  deliveryMode: DeliveryMode;
  /** 501–505: sotuvchi offeridagi chegara (FE-05 bilan bir xil). */
  fixedMaxSalePrice: number | null;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days: number, hour = 10) => {
  const date = new Date(Date.now() - days * 24 * 3_600_000);
  date.setUTCHours(hour - 5, 0, 0, 0);
  return date.toISOString();
};

const image = (productId: string, index: number) => `https://cdn.elchi.example/products/${productId}-${index}.jpg`;

function base(id: string, name: string, slug: string): Omit<MockAdminProduct, 'status' | 'categoryId' | 'basePrice' | 'weightGrams'> {
  return {
    id, shopId: MOCK_SHOP.id, ownerUserId: 'U-0002', name, slug, description: null, price: 0, oldPrice: null, imageUrl: null, images: [],
    attributes: {}, hasVariants: false, moderationNote: null, affiliateFee: 65_000, lengthMm: null, widthMm: null, heightMm: null,
    approvedPrice: null, priceStatus: null, marketTotal: null, cpaEnabled: true, isBad: false, isBlocked: false, rating: 0,
    createdAt: daysAgo(30), updatedAt: daysAgo(1), shop: MOCK_SHOP, subtitle: null, submittedAt: null, statusChangedAt: null,
    blockReason: null, statusChangedBy: null, expiryTracked: false, certificate: null, deliveryMode: 'PARTIAL', fixedMaxSalePrice: null,
    stock: null, results: null, hasVideo: false,
  };
}

const SLUGS: Record<string, string> = {
  '501': 'simsiz-quloqchinlar', '502': 'oshxona-tarozisi', '503': 'elektr-choynak', '504': 'bolalar-termos-shishasi', '505': 'aqlli-soat',
};
const DIMENSIONS: Record<string, [number, number, number]> = {
  '501': [120, 80, 50], '502': [240, 200, 40], '503': [230, 170, 250], '504': [90, 90, 230], '505': [110, 90, 60],
};

/** Sotuvchi offeri (FE-05 mocki) → admin mahsuloti: narx, haq, qoldiq va natijalar bir xil. */
function fromOffer(offer: MockOffer, onSaleDays: number): MockAdminProduct {
  const [length, width, height] = DIMENSIONS[offer.productId];
  const results = offer.results;
  return {
    ...base(offer.productId, offer.name, SLUGS[offer.productId]),
    status: 'ACTIVE', categoryId: offer.categoryId, description: offer.description, subtitle: offer.subtitle,
    images: Array.from({ length: Math.max(1, offer.creatives.length - 1) }, (_, index) => image(offer.productId, index + 1)),
    basePrice: offer.priceSplit?.wholesale ?? null, affiliateFee: offer.affiliateFee, approvedPrice: offer.approvedPrice, price: offer.approvedPrice,
    priceStatus: 'GREEN', weightGrams: offer.weightKg === null ? null : Math.round(offer.weightKg * 1000), lengthMm: length, widthMm: width, heightMm: height,
    statusChangedAt: daysAgo(onSaleDays), submittedAt: daysAgo(onSaleDays + 1), fixedMaxSalePrice: offer.maxSalePrice,
    stock: { available: offer.stock, onHand: offer.stock + (offer.stock ? 8 : 1), reserved: offer.stock ? 8 : 1, incoming: offer.productId === '504' ? 60 : 0 },
    results: results && {
      leads: results.leads, epc: offer.epc, approveRate: offer.approveRate, saleRate: offer.saleRate,
      clicks: results.clicks, validLeads: results.validLeads, confirmed: results.confirmed, delivered: results.delivered,
      refused: results.refused, inTransit: Math.max(0, results.confirmed - results.delivered - results.refused), revenue: results.revenue,
    },
    hasVideo: offer.hasVideo,
  };
}

const ON_SALE_DAYS: Record<string, number> = { '501': 51, '502': 5, '503': 32, '504': 42, '505': 20 };

export function mockAdminProducts(offers: readonly MockOffer[] = mockOffers()): MockAdminProduct[] {
  return [
    ...offers.map((offer) => fromOffer(offer, ON_SALE_DAYS[offer.productId] ?? 10)),
    {
      ...base('506', 'Bug‘li dazmol', 'bugli-dazmol'),
      status: 'PENDING_REVIEW', categoryId: '12', basePrice: 100_000, weightGrams: 1_600, lengthMm: 320, widthMm: 140, heightMm: 170,
      description: 'Keramik taglikli bug‘li dazmol: bug‘ zarbasi va vertikal bug‘lash, shaffof suv idishi. Ko‘ylak va pardani ilgan holida ham dazmollaydi.',
      subtitle: 'Bug‘ zarbasi va vertikal bug‘lash',
      images: [image('506', 1), image('506', 2), image('506', 3)], createdAt: minutesAgo(26 * 60), submittedAt: minutesAgo(190), statusChangedAt: minutesAgo(190),
      certificate: { name: 'Muvofiqlik sertifikati.pdf', url: 'https://cdn.elchi.example/certificates/506.pdf', uploadedAt: minutesAgo(192) },
    },
    {
      ...base('507', 'Magniy B6 kapsulalari', 'magniy-b6-kapsulalari'),
      status: 'REJECTED', categoryId: '15', basePrice: 60_000, weightGrams: 150, lengthMm: 60, widthMm: 60, heightMm: 110, isBad: true, expiryTracked: true,
      description: 'Magniy va B6 vitamini: charchoqni kamaytiradi va uyquni davolaydi. 60 kapsula.',
      moderationNote: 'Tavsifda «uyquni davolaydi» deyilgan — kasallikni davolash va’dasi taqiqlangan. Matnni tuzatib, qayta yuboring.',
      images: [image('507', 1)], submittedAt: minutesAgo(30 * 60), statusChangedAt: minutesAgo(26 * 60 + 50), statusChangedBy: 'Nodira Karimova',
      certificate: { name: 'Davlat ro‘yxatidan o‘tganlik guvohnomasi.pdf', url: 'https://cdn.elchi.example/certificates/507.pdf', uploadedAt: minutesAgo(31 * 60) },
    },
    {
      ...base('508', 'Changyutgich', 'changyutgich'),
      status: 'DRAFT', categoryId: '12', basePrice: 300_000, weightGrams: 6_000, lengthMm: 420, widthMm: 300, heightMm: 280, deliveryMode: 'SEPARATE',
      description: 'Simsiz vertikal changyutgich: 40 daqiqa ishlaydi, gilam va pol uchun.', createdAt: daysAgo(9, 16), statusChangedAt: daysAgo(9, 16),
    },
    {
      ...base('509', 'Soch quritgich', 'soch-quritgich'),
      status: 'PENDING_REVIEW', categoryId: '14', basePrice: 110_000, weightGrams: 700, lengthMm: 280, widthMm: 100, heightMm: 240,
      approvedPrice: 239_000, price: 239_000, priceStatus: 'GREEN', fixedMaxSalePrice: 262_000,
      description: 'Ionli soch quritgich: 3 harorat va 2 tezlik, sovuq havo tugmasi, ikki konsentrator.', subtitle: '2 000 Vt, ionlash, 3 harorat rejimi',
      images: [image('509', 1), image('509', 2)], submittedAt: minutesAgo(70), statusChangedAt: minutesAgo(70), createdAt: minutesAgo(5 * 60),
      certificate: { name: 'Muvofiqlik sertifikati.pdf', url: 'https://cdn.elchi.example/certificates/509.pdf', uploadedAt: minutesAgo(72) },
      stock: { available: 40, onHand: 40, reserved: 0, incoming: 0 }, hasVideo: true,
    },
    {
      ...base('510', 'Elektr ustara', 'elektr-ustara'),
      status: 'ACTIVE', categoryId: '11', basePrice: 95_000, weightGrams: 400, lengthMm: 170, widthMm: 70, heightMm: 60,
      approvedPrice: 199_000, price: 199_000, priceStatus: 'GREEN', fixedMaxSalePrice: 218_000,
      description: 'Uch boshli elektr ustara: quruq va nam soqol olish, 60 daqiqa quvvat.', subtitle: 'Quruq va nam soqol, 60 daqiqa',
      images: [image('510', 1), image('510', 2)], submittedAt: daysAgo(4), statusChangedAt: daysAgo(3),
      stock: { available: 30, onHand: 30, reserved: 0, incoming: 0 }, hasVideo: false,
    },
  ];
}

/** Sotuvchi offeridagi kreativlar (FE-05) admin kutubxonasiga; 509 — video bilan, 510 — videosiz. */
export function mockCreatives(offers: readonly MockOffer[] = mockOffers()): Record<string, Creative[]> {
  const library: Record<string, Creative[]> = {};
  offers.forEach((offer) => {
    library[offer.productId] = offer.creatives.map((creative, index) => ({
      id: creative.id, productId: offer.productId, type: creative.type, url: creative.url,
      mimeType: creative.type === 'VIDEO' ? 'video/mp4' : 'image/jpeg', size: creative.type === 'VIDEO' ? 18_400_000 : 240_000,
      position: index, createdAt: creative.approvedAt ?? daysAgo(40), caption: creative.caption, durationSec: creative.type === 'VIDEO' ? 28 : null,
    }));
  });
  library['509'] = [
    { id: '5090', productId: '509', type: 'VIDEO', url: 'https://cdn.elchi.example/creatives/5090.mp4', mimeType: 'video/mp4', size: 21_000_000, position: 0, createdAt: minutesAgo(75), caption: 'asosiy', durationSec: 31 },
    { id: '5091', productId: '509', type: 'IMAGE', url: 'https://cdn.elchi.example/creatives/5091.jpg', mimeType: 'image/jpeg', size: 220_000, position: 1, createdAt: minutesAgo(75), caption: 'asosiy', durationSec: null },
  ];
  library['510'] = [
    { id: '5101', productId: '510', type: 'IMAGE', url: 'https://cdn.elchi.example/creatives/5101.jpg', mimeType: 'image/jpeg', size: 210_000, position: 0, createdAt: daysAgo(3), caption: 'asosiy', durationSec: null },
    { id: '5102', productId: '510', type: 'IMAGE', url: 'https://cdn.elchi.example/creatives/5102.jpg', mimeType: 'image/jpeg', size: 190_000, position: 1, createdAt: daysAgo(3), caption: 'qutida', durationSec: null },
  ];
  return library;
}

const HIGHLIGHTS: Record<string, string[]> = {
  '501': ['Telefonga Bluetooth orqali ulanadi.', 'Ixcham g‘ilofda saqlanadi va quvvatlanadi.', 'Qo‘ng‘iroqlarga quloqchin orqali javob berasiz.'],
  '503': ['Suv qaynagach o‘zi o‘chadi.', 'Suvsiz yoqilmaydi.'],
};

/** Offer matnlari: skript hali yozilmagan (admin-skript «1 · Skript yo‘q»), afzalliklar va «qutida» — offerdan. */
export function mockOfferContents(offers: readonly MockOffer[] = mockOffers()): Record<string, OfferContent> {
  const contents: Record<string, OfferContent> = {};
  offers.forEach((offer) => {
    contents[offer.productId] = {
      productId: offer.productId, callScript: null, highlights: HIGHLIGHTS[offer.productId] ?? [],
      boxContents: (offer.boxContents ?? '').replace(/\.$/, '').split(',').map((item) => item.trim()).filter(Boolean),
      updatedAt: daysAgo(ON_SALE_DAYS[offer.productId] ?? 10),
    };
  });
  return contents;
}

/** Audit: moderatsiya namunasidagi uch yozuv (admin-moderatsiya «Audit — shu mahsulot»). */
export function mockProductAudit(): (ProductAuditEntry & { entityId: string })[] {
  return [
    { id: 'A-506-1', entityId: '506', at: minutesAgo(192), actorName: MOCK_SHOP.name, action: 'product.certificate', meta: { fileName: 'Muvofiqlik sertifikati.pdf' } },
    { id: 'A-506-2', entityId: '506', at: minutesAgo(190), actorName: MOCK_SHOP.name, action: 'product.submit', meta: { from: 'DRAFT', to: 'PENDING_REVIEW' } },
    { id: 'A-506-3', entityId: '506', at: minutesAgo(190), actorName: null, action: 'price.recommended', meta: { recommendedBase: 210_000, recommended: 221_000 } },
    { id: 'A-507-1', entityId: '507', at: minutesAgo(26 * 60 + 50), actorName: 'Nodira Karimova', action: 'product.reject', meta: { reason: 'Tavsifda «uyquni davolaydi» deyilgan — kasallikni davolash va’dasi taqiqlangan. Matnni tuzatib, qayta yuboring.' } },
  ];
}

// ── Narx hisobi (BE-09) ────────────────────────────────────────────────────────
// FE-12 uchun soddalashtirilgan: namuna sonlari dizayndagi bilan bir xil (262 000 → 287 000, natija 10 185).
// Aniq TZ formulasi (K₇₀, K₁₀₀, M) — FE-13 da.
const AD_COST = 50_420;
const AFFILIATE_COEF = 1.29;
const MARKUP_CAP_PERCENT = 10;
export const TARIFF = { centerBase: 40_000, baseWeightGrams: 3_000, perExtraKg: 4_000, addressExtra: 20_000 };
const VISIBLE = { center: 30_000, address: 50_000 };
const up1000 = (value: number) => Math.ceil(value / 1000) * 1000;
const down1000 = (value: number) => Math.floor(value / 1000) * 1000;

export const recommendedAffiliateFee = () => down1000(AD_COST * AFFILIATE_COEF);

function tariffCenter(weightGrams: number) {
  return TARIFF.centerBase + Math.max(0, Math.ceil((weightGrams - TARIFF.baseWeightGrams) / 1000)) * TARIFF.perExtraKg;
}

export function mockDelivery(product: Pick<MockAdminProduct, 'weightGrams' | 'deliveryMode'>) {
  const center = tariffCenter(product.weightGrams ?? 0);
  if (product.deliveryMode === 'SEPARATE') return { tariffCenter: center, visibleCenter: center, visibleAddress: center + TARIFF.addressExtra, hidden: 0 };
  if (product.deliveryMode === 'FREE') return { tariffCenter: center, visibleCenter: 0, visibleAddress: 0, hidden: center };
  return { tariffCenter: center, visibleCenter: VISIBLE.center, visibleAddress: VISIBLE.address, hidden: center - VISIBLE.center };
}

export function mockPricing(product: MockAdminProduct, query: { price?: number; affiliateFee?: number } = {}): ProductPricing {
  const fee = query.affiliateFee ?? product.affiliateFee ?? recommendedAffiliateFee();
  const basePrice = product.basePrice ?? 0;
  const delivery = mockDelivery(product);
  const recommendedBase = up1000(1.025 * basePrice + 42_500 + fee);
  const recommended = recommendedBase + (delivery.hidden > 0 ? up1000(delivery.hidden / 0.9415) : 0);
  const price = query.price ?? product.approvedPrice ?? recommended;
  const platformResult70 = Math.floor(0.96 * (price - basePrice - fee) - 0.0185 * price - 29_688 - delivery.hidden);
  const affiliateResult = fee - AD_COST;
  const status: PriceStatus = platformResult70 + 15_000 < 0 ? 'RED' : affiliateResult < 0 ? 'ORANGE' : price >= recommended ? 'GREEN' : platformResult70 >= 0 ? 'YELLOW' : 'ORANGE';
  const approved = product.approvedPrice;
  return {
    productId: product.id,
    approvalCurrent: approved !== null,
    params: { adCost: AD_COST, affiliateCoef: AFFILIATE_COEF, markupCapPercent: MARKUP_CAP_PERCENT, deliveryMode: product.deliveryMode, taxRate: Number(GLOBAL_POLICY.taxRate), paymentRate: Number(GLOBAL_POLICY.paymentRate) },
    tariff: TARIFF,
    recommendedAffiliateFee: recommendedAffiliateFee(),
    calculation: { recommendedBase, recommended, delivery },
    evaluation: { status, price, platformResult70, affiliateResult },
    approvedPrice: approved,
    priceStatus: (product.priceStatus as PriceStatus | null) ?? null,
    maxSalePrice: approved === null ? null : product.fixedMaxSalePrice ?? approved + down1000((recommendedBase * MARKUP_CAP_PERCENT) / 100),
  };
}
