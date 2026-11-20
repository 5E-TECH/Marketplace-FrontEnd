import type { AffiliateOfferDetail } from '../../../features/affiliate/api/offersApi';
import type { OfferCreative } from '../../../features/affiliate/model/offerTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';

/** Nega sahifa ochilmaydi (sotuvchi-offer 1-bo'lim): holat bo'yicha; ochiq bo'lsa — `null`. */
export function blockReason(offer: AffiliateOfferDetail): TranslationKey | null {
  if (offer.state === 'STOPPED') return 'offer.blockStopped';
  if (offer.state === 'SHORT_EXPIRY') return 'offer.blockExpiry';
  if (offer.state === 'OUT_OF_STOCK' || offer.stock <= 0) return 'offer.blockStock';
  return null;
}

/** Fayl turi URL kengaytmasidan: «MP4», «JPG». */
export const fileFormat = (url: string) => (url.split('?')[0].split('.').pop() ?? '').toUpperCase();

/** Kreativ nomi: «Video», «Rasm 2/4» — tartib raqami rasmlar ichida. */
export function useCreativeName(creatives: readonly OfferCreative[]) {
  const { t } = useTranslation();
  const images = creatives.filter((creative) => creative.type === 'IMAGE');
  return (creative: OfferCreative) =>
    creative.type === 'VIDEO' ? t('offer.video') : t('offer.imageN', { index: images.indexOf(creative) + 1, total: images.length });
}
