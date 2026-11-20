/**
 * Narx va haq hisobi (TZ 2.5; backend `order-commission.ts` bilan bir xil): sotuvchi narxni
 * tasdiqlangan narxdan `maxSalePrice` gacha ko'taradi; ustamaning 85% i sotuvchiga, pastga
 * yaxlitlab. Ulush sozlama emas (11-qaror) — shuning uchun doimiy.
 */
export const MARKUP_AFFILIATE_PERCENT = 85;

interface PricedOffer {
  approvedPrice: number;
  maxSalePrice: number;
  affiliateFee: number;
}

export type PriceIssue = 'below' | 'above';

export function priceIssue(offer: Pick<PricedOffer, 'approvedPrice' | 'maxSalePrice'>, price: number): PriceIssue | null {
  if (!(price >= offer.approvedPrice)) return 'below';
  return price > offer.maxSalePrice ? 'above' : null;
}

/** Ustama (narx − tasdiqlangan narx). */
export const markupOf = (offer: Pick<PricedOffer, 'approvedPrice'>, price: number) => Math.max(0, price - offer.approvedPrice);

/** Ustamaning sotuvchi ulushi. */
export const markupShare = (markup: number) => Math.floor((markup * MARKUP_AFFILIATE_PERCENT) / 100);

/** Shu narxdagi har sotuvdan haq: sotuvchi haqi + ustamaning 85% i. */
export const feeAt = (offer: PricedOffer, price: number) => offer.affiliateFee + markupShare(markupOf(offer, price));

/** Ustama chegarasi foizda («+10%»). */
export const markupLimitPercent = (offer: Pick<PricedOffer, 'approvedPrice' | 'maxSalePrice'>) =>
  offer.approvedPrice > 0 ? Math.round(((offer.maxSalePrice - offer.approvedPrice) * 100) / offer.approvedPrice) : 0;

/** Kreativlar soni: «1 video, 4 rasm». */
export function creativeCounts(creatives: readonly { type: 'IMAGE' | 'VIDEO' }[]): { videos: number; images: number } {
  const videos = creatives.filter((creative) => creative.type === 'VIDEO').length;
  return { videos, images: creatives.length - videos };
}

/** Foiz, butun son; maxraj 0 — `null` («statistika yo'q»). Backend `percent` bilan bir xil. */
export const percentOf = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part * 100) / whole) : null);
