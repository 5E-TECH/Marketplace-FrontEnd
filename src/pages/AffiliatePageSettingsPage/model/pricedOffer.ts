import type { AffiliateOffer, AffiliateOfferDetail } from '../../../features/affiliate/api/offersApi';

/** Sozlash uchun offer: narx chegarasi, haq va yetkazish. Tafsilot (taklif) bo'lmasa — ro'yxatdagi offer. */
export interface PricedOffer {
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  categoryName?: string | null;
  approvedPrice: number;
  maxSalePrice: number;
  affiliateFee: number;
  centerDeliveryFee?: number | null;
  addressDeliveryFee?: number | null;
}

export const pricedOffer = (detail: AffiliateOfferDetail | undefined, listed: AffiliateOffer | undefined): PricedOffer | undefined => detail ?? listed;
