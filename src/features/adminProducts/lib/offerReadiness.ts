import type { AdminProduct } from '../model/adminProductTypes';

/**
 * Offer holati (admin-offer «Offer holati — ochilish shartlari: narx, video, qoldiq»):
 * - `OPEN` — sotuvchilar katalogida ochiq;
 * - `OUT_OF_STOCK` — katalogda, lekin yangi sahifa ochilmaydi (qoldiq 0);
 * - `CLOSED` — «Ochilmaydi»: narx tasdiqlanmagan yoki video yo'q;
 * - `SITE_ONLY` — «Faqat sayt» (`cpaEnabled = false`);
 * - `BLOCKED` — admin to'xtatgan (`isBlocked`);
 * - `NOT_ACTIVE` — mahsulot moderatsiyadan o'tmagan (qoralama, ko'rib chiqilmoqda, rad, arxiv).
 */
export type OfferState = 'OPEN' | 'OUT_OF_STOCK' | 'CLOSED' | 'SITE_ONLY' | 'BLOCKED' | 'NOT_ACTIVE';

export interface OfferReadiness {
  state: OfferState;
  conditions: { price: boolean; video: boolean; stock: boolean };
  /** Sotuvchilar katalogida ko'rinadimi (FE-12 TC1, TC2, TC5). */
  visibleToSellers: boolean;
}

type ReadinessProduct = Pick<AdminProduct, 'status' | 'isBlocked' | 'cpaEnabled' | 'approvedPrice'>;

/**
 * Sotuvchiga ochilish — backend `isCpaAvailable` (BE-07) + tasdiqlangan narx (BE-09) + kamida bitta video
 * (SOT-9; BE-27 qo'shadi — taklif, 4-bo'lim). Mock (`src/mocks/handlers`) ham shu funksiya bilan filtrlaydi.
 */
export function offerReadiness(product: ReadinessProduct, media: { videos: number; stock: number | null }): OfferReadiness {
  const conditions = { price: product.approvedPrice !== null, video: media.videos > 0, stock: (media.stock ?? 0) > 0 };
  const listed = product.status === 'ACTIVE' && !product.isBlocked && product.cpaEnabled;
  const visibleToSellers = listed && conditions.price && conditions.video;
  const state: OfferState = product.isBlocked
    ? 'BLOCKED'
    : product.status !== 'ACTIVE'
      ? 'NOT_ACTIVE'
      : !product.cpaEnabled
        ? 'SITE_ONLY'
        : !conditions.price || !conditions.video
          ? 'CLOSED'
          : conditions.stock ? 'OPEN' : 'OUT_OF_STOCK';
  return { state, conditions, visibleToSellers };
}
