import type { AffiliateOffer, AffiliateStream, OfferState } from '../model/offerTypes';

export type StreamDisplayStatus = 'ACTIVE' | 'STOPPED' | 'OUT_OF_STOCK' | 'PAUSED';

/**
 * Sahifa holati ekranda (T3 stream.status + offer): to'xtatilgan — serverdan; faol sahifaning offeri
 * qoldig'i 0 bo'lsa — «Qoldiq tugagan», offer to'xtatilgan yoki muddati qisqa bo'lsa — «Buyurtma qabul
 * qilmaydi» (landing ariza olmaydi; sotuvchi-sahifalarim 2, sotuvchi-offer 1).
 */
export function streamStatus(
  stream: Pick<AffiliateStream, 'status'>,
  offer: (Pick<AffiliateOffer, 'stock'> & { state?: OfferState }) | undefined,
): StreamDisplayStatus {
  if (stream.status === 'STOPPED') return 'STOPPED';
  if (offer?.state === 'STOPPED' || offer?.state === 'SHORT_EXPIRY') return 'PAUSED';
  return offer && offer.stock <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
}

/** «hozir yaratildi» belgisi: yaratilganiga 10 daqiqa bo'lmagan sahifa [taklif]. */
export const JUST_CREATED_MS = 10 * 60_000;
export const isJustCreated = (stream: Pick<AffiliateStream, 'createdAt'>, now: number) => now - Date.parse(stream.createdAt) < JUST_CREATED_MS;
