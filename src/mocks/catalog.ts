import { offerReadiness } from '../features/adminProducts/lib/offerReadiness';
import type { Creative } from '../features/adminProducts/model/adminProductTypes';
import type { OfferCreative } from '../features/affiliate/model/offerTypes';
import { db } from './db';
import { mockDelivery, mockPricing, type MockAdminProduct } from './fixtures/adminProducts';
import type { MockOffer } from './fixtures/offers';

/**
 * Sotuvchi katalogi admin holatidan (FE-12): tasdiq (ADM-1), to'xtatish, «Faqat sayt», tasdiqlangan narx va
 * kamida bitta video (SOT-9 — BE-27 taklifi). Haq va kreativlar admin kutubxonasidan; FE-05 dagi boy
 * tafsilot (natijalar, taqsimot) 501–505 uchun `fixtures/offers.ts` dan qoladi.
 */
export const categoryNameOf = (id: string | null) => (id ? db.categories.find((category) => category.id === id)?.name ?? null : null);

export const creativesOf = (productId: string): Creative[] => db.creatives[productId] ?? [];

export function readinessOf(product: MockAdminProduct) {
  return offerReadiness(product, {
    videos: creativesOf(product.id).filter((creative) => creative.type === 'VIDEO').length,
    stock: product.stock?.available ?? null,
  });
}

const toOfferCreative = (creative: Creative): OfferCreative => ({
  id: creative.id, type: creative.type, url: creative.url, caption: creative.caption ?? null, processing: false, approvedAt: creative.createdAt,
});

/** Seed'da yo'q, keyin ochilgan mahsulot (masalan, 509 tasdiqlangach) uchun offer. */
function offerFromProduct(product: MockAdminProduct): MockOffer {
  const delivery = mockDelivery(product);
  const pricing = mockPricing(product);
  const stock = product.stock?.available ?? 0;
  return {
    productId: product.id, name: product.name, imageUrl: product.images[0] ?? null, approvedPrice: product.approvedPrice ?? 0,
    maxSalePrice: pricing.maxSalePrice ?? product.approvedPrice ?? 0, affiliateFee: product.affiliateFee ?? 0,
    epc: null, approveRate: null, saleRate: null, stock, hasVideo: false, creatives: [],
    categoryId: product.categoryId ?? '', categoryName: categoryNameOf(product.categoryId), subtitle: product.subtitle ?? null,
    description: product.description, boxContents: (db.offerContents[product.id]?.boxContents ?? []).join(', ') || null,
    weightKg: product.weightGrams === null ? null : product.weightGrams / 1000, deliveryMode: product.deliveryMode,
    centerDeliveryFee: delivery.visibleCenter, addressDeliveryFee: delivery.visibleAddress, isBad: product.isBad,
    state: stock > 0 ? 'OPEN' : 'OUT_OF_STOCK', stoppedAt: null, stopReason: null,
    onSaleSince: (product.statusChangedAt ?? product.updatedAt).slice(0, 10), results: null, priceSplit: null, createdOrder: 100 + Number(product.id),
  };
}

/** Sotuvchiga ko'rinadigan offerlar (`GET /affiliate/offers`, tafsilot, sahifa yaratish). */
export function sellerOffers(): MockOffer[] {
  return db.adminProducts.flatMap((product) => {
    if (!readinessOf(product).visibleToSellers) return [];
    const offer = db.offers.find((item) => item.productId === product.id) ?? offerFromProduct(product);
    const creatives = creativesOf(product.id).map(toOfferCreative);
    return [{
      ...offer,
      affiliateFee: product.affiliateFee ?? offer.affiliateFee,
      approvedPrice: product.approvedPrice ?? offer.approvedPrice,
      creatives,
      hasVideo: creatives.some((creative) => creative.type === 'VIDEO'),
    }];
  });
}
