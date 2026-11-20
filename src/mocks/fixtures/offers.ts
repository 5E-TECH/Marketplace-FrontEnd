import type { components } from '../../generated/api-types';
import type { AffiliateOfferDetail, OfferCreative } from '../../features/affiliate/model/offerTypes';

type Schemas = components['schemas'];

/**
 * Offerlar katalogi (sotuvchi-offerlar namunasi). 501–503 narxi operator mocki bilan bir xil
 * (`MOCK_PRODUCTS`); 505 — FE-05 TC4 namunasi (tasdiqlangan 251 000, chegara 276 000).
 * Rasm va video yo'q — kartada «[mahsulot fotosi]» o'rinbosari chiqadi.
 */
export const OFFER_CATEGORIES: Schemas['CategoryTreeDto'][] = [
  { id: '11', name: 'Elektronika', slug: 'elektronika', parentId: null, iconUrl: null, sortOrder: 0, isActive: true, children: [] },
  { id: '12', name: 'Uy-ro‘zg‘or', slug: 'uy-rozgor', parentId: null, iconUrl: null, sortOrder: 1, isActive: true, children: [] },
  { id: '13', name: 'Bolalar uchun', slug: 'bolalar-uchun', parentId: null, iconUrl: null, sortOrder: 2, isActive: true, children: [] },
];

const CAPTIONS = ['asosiy', 'g‘ilofda', 'quloqda', 'qutida'];

function creatives(productId: string, images: number, approvedAt: string): OfferCreative[] {
  const video: OfferCreative = { id: `${productId}0`, type: 'VIDEO', url: `https://cdn.elchi.example/creatives/${productId}0.mp4`, caption: 'asosiy', processing: false, approvedAt };
  return [
    video,
    ...Array.from({ length: images }, (_, index): OfferCreative => ({
      id: `${productId}${index + 1}`,
      type: 'IMAGE',
      url: `https://cdn.elchi.example/creatives/${productId}${index + 1}.jpg`,
      caption: CAPTIONS[index] ?? null,
      processing: false,
      approvedAt,
    })),
  ];
}

interface Seed {
  productId: string;
  name: string;
  categoryId: string;
  approvedPrice: number;
  maxSalePrice: number;
  affiliateFee: number;
  stock: number;
  images: number;
  /** null — statistika hali yo'q (lid yig'ilmagan). */
  results: AffiliateOfferDetail['results'];
  subtitle: string;
  description: string;
  boxContents: string;
  weightKg: number;
  onSaleSince: string;
  createdOrder: number;
}

const SEEDS: Seed[] = [
  {
    productId: '501', name: 'Simsiz quloqchinlar', categoryId: '11', approvedPrice: 262_000, maxSalePrice: 287_000, affiliateFee: 65_000, stock: 120, images: 4,
    results: { clicks: 3_000, leads: 240, validLeads: 204, confirmed: 102, delivered: 63, refused: 27, revenue: 4_180_000 },
    subtitle: 'Bluetooth orqali ulanadi, quvvatlovchi g‘ilof bilan',
    description: 'Kundalik foydalanish uchun simsiz quloqchinlar: musiqa, video va qo‘ng‘iroqlar uchun. Quloqchinlar g‘ilofda saqlanadi va quvvatlanadi.',
    boxContents: 'quloqchinlar (juft), quvvatlovchi g‘ilof, quvvat kabeli.', weightKg: 0.3, onSaleSince: '2026-10-01', createdOrder: 5,
  },
  {
    productId: '503', name: 'Elektr choynak', categoryId: '12', approvedPrice: 245_000, maxSalePrice: 269_000, affiliateFee: 65_000, stock: 26, images: 2,
    results: { clicks: 1_400, leads: 118, validLeads: 98, confirmed: 41, delivered: 26, refused: 12, revenue: 1_690_000 },
    subtitle: '1,7 litr, zanglamaydigan po‘lat, avtomatik o‘chadi',
    description: 'Tez qaynatadigan elektr choynak: suv qaynagach o‘zi o‘chadi, suvsiz yoqilmaydi.',
    boxContents: 'choynak, tagligi, yo‘riqnoma.', weightKg: 1.2, onSaleSince: '2026-10-20', createdOrder: 4,
  },
  {
    productId: '502', name: 'Oshxona tarozisi', categoryId: '12', approvedPrice: 189_000, maxSalePrice: 207_000, affiliateFee: 65_000, stock: 45, images: 3,
    results: null,
    subtitle: '5 kg gacha, 1 g aniqlik, shisha yuzali',
    description: 'Oshxona uchun elektron tarozi: idishning og‘irligini ayirib o‘lchaydi.',
    boxContents: 'tarozi, 2 ta AAA batareya.', weightKg: 0.6, onSaleSince: '2026-11-16', createdOrder: 3,
  },
  {
    productId: '504', name: 'Bolalar termos shishasi', categoryId: '13', approvedPrice: 180_000, maxSalePrice: 198_000, affiliateFee: 65_000, stock: 0, images: 2,
    results: { clicks: 1_250, leads: 100, validLeads: 84, confirmed: 42, delivered: 21, refused: 9, revenue: 1_365_000 },
    subtitle: 'Issiqni 12 soat saqlaydi, 350 ml',
    description: 'Bolalar uchun termos shisha: oziq-ovqat po‘latidan, to‘kilmaydigan qopqoq bilan.',
    boxContents: 'termos shisha, qo‘shimcha so‘rg‘ich.', weightKg: 0.4, onSaleSince: '2026-10-10', createdOrder: 2,
  },
  {
    productId: '505', name: 'Aqlli soat', categoryId: '11', approvedPrice: 251_000, maxSalePrice: 276_000, affiliateFee: 60_000, stock: 64, images: 1,
    results: { clicks: 900, leads: 70, validLeads: 58, confirmed: 22, delivered: 14, refused: 5, revenue: 840_000 },
    subtitle: 'Yurak urishi, qadam va uyqu, 5 kun quvvat',
    description: 'Telefon bilan ulanadigan aqlli soat: qo‘ng‘iroq va xabarlarni ko‘rsatadi.',
    boxContents: 'soat, quvvatlash kabeli.', weightKg: 0.1, onSaleSince: '2026-11-01', createdOrder: 1,
  },
];

const CATEGORY_NAME = new Map(OFFER_CATEGORIES.map((category) => [category.id, category.name]));
const CENTER_FEE = 30_000;
const ADDRESS_FEE = 50_000;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);

export interface MockOffer extends AffiliateOfferDetail {
  categoryId: string;
  createdOrder: number;
}

export function mockOffers(): MockOffer[] {
  return SEEDS.map((seed) => {
    const list = creatives(seed.productId, seed.images, `${seed.onSaleSince}T09:00:00.000Z`);
    const results = seed.results;
    const recommended = seed.approvedPrice - 11_000;
    return {
      productId: seed.productId,
      name: seed.name,
      imageUrl: null,
      approvedPrice: seed.approvedPrice,
      maxSalePrice: seed.maxSalePrice,
      affiliateFee: seed.affiliateFee,
      epc: results ? Math.round(results.revenue / results.clicks) : null,
      approveRate: results ? percent(results.confirmed, results.validLeads) : null,
      saleRate: results ? percent(results.delivered, results.delivered + results.refused) : null,
      stock: seed.stock,
      hasVideo: list.some((creative) => creative.type === 'VIDEO'),
      creatives: list,
      categoryId: seed.categoryId,
      categoryName: CATEGORY_NAME.get(seed.categoryId) ?? null,
      subtitle: seed.subtitle,
      description: seed.description,
      boxContents: seed.boxContents,
      weightKg: seed.weightKg,
      deliveryMode: 'PARTIAL',
      centerDeliveryFee: CENTER_FEE,
      addressDeliveryFee: ADDRESS_FEE,
      isBad: false,
      state: seed.stock > 0 ? 'OPEN' : 'OUT_OF_STOCK',
      stoppedAt: null,
      stopReason: null,
      onSaleSince: seed.onSaleSince,
      results,
      priceSplit: {
        recommended,
        wholesale: recommended - seed.affiliateFee - 12_000 - 34_000,
        affiliateFee: seed.affiliateFee,
        callCenter: 12_000,
        platform: 34_000,
        deliveryInPrice: 10_000,
      },
      createdOrder: seed.createdOrder,
    };
  });
}

/** Tafsilot javobi (taklif): mock ichki maydonlarisiz. */
export function offerDetail(offer: MockOffer): AffiliateOfferDetail {
  const detail: Partial<MockOffer> = { ...offer };
  delete detail.categoryId;
  delete detail.createdOrder;
  return detail as AffiliateOfferDetail;
}

/** Ro'yxat elementi: tafsilotning BE-25 dagi maydonlari + taklif qilingan ikki maydon. */
export function offerListItem(offer: MockOffer): Schemas['AffiliateOfferDto'] & { categoryName: string | null; centerDeliveryFee: number } {
  return {
    productId: offer.productId, name: offer.name, imageUrl: offer.imageUrl, approvedPrice: offer.approvedPrice, maxSalePrice: offer.maxSalePrice,
    affiliateFee: offer.affiliateFee, epc: offer.epc, approveRate: offer.approveRate, saleRate: offer.saleRate, stock: offer.stock,
    hasVideo: offer.hasVideo, creatives: offer.creatives.map(({ id, type, url }) => ({ id, type, url })),
    categoryName: offer.categoryName, centerDeliveryFee: offer.centerDeliveryFee,
  };
}

/** Bo'sh ZIP arxiv (faqat «end of central directory» yozuvi) — mock yuklab olish uchun. */
export const EMPTY_ZIP = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)]);
