import { CircleCheck, CircleX, Eye, Plus } from 'lucide-react';
import type { AffiliateOffer } from '../../affiliate/model/offerTypes';
import { OfferCardView } from '../../affiliate/ui/OfferCardView';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { useCreativesQuery } from '../api/adminProductsQueries';
import { offerReadiness } from '../lib/offerReadiness';
import type { AdminProductListItem } from '../model/adminProductTypes';
import { productBadgeCode } from './adminProductModerationConfig';
import styles from './SellerPreviewDialog.module.css';

interface SellerPreviewDialogProps {
  product: AdminProductListItem;
  categoryName: string | null;
  onClose: () => void;
}

/**
 * «Sotuvchi sifatida ko'rish» (admin-mahsulotlar 3): offer kartasi sotuvchi katalogidagidek (`OfferCardView`)
 * va nega katalogda ko'rinadi yoki ko'rinmaydi — holat, kanal, narx, video, qoldiq (`offerReadiness`).
 */
export function SellerPreviewDialog({ product, categoryName, onClose }: SellerPreviewDialogProps) {
  const { t } = useTranslation();
  const creatives = useCreativesQuery(product.id).data ?? [];
  const videos = creatives.filter((creative) => creative.type === 'VIDEO').length;
  const images = creatives.length - videos;
  const stock = product.stock?.available ?? 0;
  const readiness = offerReadiness(product, { videos, stock });
  const price = product.approvedPrice ?? product.listPrice?.customer ?? 0;
  const offer: AffiliateOffer = {
    productId: product.id,
    name: product.name,
    imageUrl: product.images[0] ?? null,
    approvedPrice: price,
    maxSalePrice: price,
    affiliateFee: product.affiliateFee ?? 0,
    epc: product.results?.epc ?? null,
    approveRate: product.results?.approveRate ?? null,
    saleRate: product.results?.saleRate ?? null,
    stock,
    hasVideo: videos > 0,
    creatives: creatives.map(({ id, type, url }) => ({ id, type, url })),
    categoryName,
    centerDeliveryFee: product.listPrice?.delivery ?? null,
  };
  const listed = product.status === 'ACTIVE' && !product.isBlocked;
  const conditions: { ok: boolean; title: string; hint: string }[] = [
    {
      ok: listed,
      title: t('sellerView.status', { status: t(`status.product.${productBadgeCode(product)}` as TranslationKey) }),
      hint: t(listed ? 'sellerView.statusOk' : 'sellerView.statusNo'),
    },
    { ok: product.cpaEnabled, title: t(product.cpaEnabled ? 'sellerView.channel' : 'sellerView.channelOff'), hint: t(product.cpaEnabled ? 'sellerView.channelHint' : 'sellerView.channelOffHint') },
    {
      ok: readiness.conditions.price,
      title: t(readiness.conditions.price ? 'sellerView.price' : 'sellerView.priceMissing'),
      hint: product.approvedPrice === null ? t('sellerView.priceMissingHint') : t('sellerView.priceHint', { price: formatMoney(product.approvedPrice) }),
    },
    {
      ok: readiness.conditions.video,
      title: t(readiness.conditions.video ? 'sellerView.video' : 'sellerView.videoMissing'),
      hint: readiness.conditions.video ? t('sellerView.media', { videos, images }) : t('sellerView.videoMissingHint'),
    },
    {
      ok: readiness.conditions.stock,
      title: t(readiness.conditions.stock ? 'sellerView.stock' : 'sellerView.stockMissing'),
      hint: readiness.conditions.stock ? t('sellerView.stockHint', { count: formatMoney(stock) }) : t('sellerView.stockMissingHint'),
    },
  ];

  return (
    <Dialog
      open
      title={t('sellerView.title')}
      description={t('sellerView.subtitle', { name: product.name })}
      icon={<Eye />}
      width={760}
      onClose={onClose}
      testId="seller-preview"
    >
      <div className={styles.layout}>
        <div className={styles.card}>
          <OfferCardView
            offer={offer}
            href={null}
            action={(
              <button type="button" className={styles.create} disabled>
                <Plus aria-hidden />
                {t('sellerView.create')}
              </button>
            )}
          />
        </div>
        <div className={styles.why}>
          <p className={styles.caption}>{t(readiness.visibleToSellers ? 'sellerView.why' : 'sellerView.whyNot')}</p>
          <ul>
            {conditions.map((item) => (
              <li key={item.title}>
                {item.ok ? <CircleCheck aria-hidden data-ok /> : <CircleX aria-hidden />}
                <span>
                  <span><span className={styles.visuallyHidden}>{t(item.ok ? 'sellerView.done' : 'sellerView.notDone')} </span>{item.title}</span>
                  <span>{item.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
