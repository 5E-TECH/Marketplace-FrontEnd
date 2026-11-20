import { CirclePause, Hourglass, Package } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import { useAffiliateOfferQuery, useCreateStreamMutation } from '../../features/affiliate/api/offersApi';
import type { OfferCreative, StreamTemplate } from '../../features/affiliate/model/offerTypes';
import { AdRulesDialog } from '../../features/affiliate/ui/AdRules';
import { TemplatePreviewDialog } from '../../features/affiliate/ui/TemplatePreviewDialog';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { DownloadAllDialog, ImagesDialog, VideoDialog } from './components/CreativeDialogs';
import { CreateAction, FeeCard, MyStreamsCard, RulesCard } from './components/OfferAside';
import { CreativesCard, PriceSplitCard, ProductCard, ResultsCard, TemplatesCard } from './components/OfferSections';
import styles from './AffiliateOfferPage.module.css';

type OpenDialog =
  | { kind: 'video'; creative: OfferCreative }
  | { kind: 'images'; startId: string }
  | { kind: 'download' }
  | { kind: 'preview'; template: StreamTemplate }
  | { kind: 'rules' };

const BANNERS = {
  OUT_OF_STOCK: { tone: 'warning', icon: Package, title: 'offer.bannerStock', text: 'offer.bannerStockText' },
  STOPPED: { tone: 'neutral', icon: CirclePause, title: 'offer.bannerStopped', text: 'offer.bannerStoppedText' },
  SHORT_EXPIRY: { tone: 'warning', icon: Hourglass, title: 'offer.bannerExpiry', text: 'offer.bannerExpiryText' },
} as const;

/**
 * «Offer tafsiloti va kreativlar» (FE-05, sotuvchi-offer): mahsulot, hamma sotuvchilar natijasi,
 * kreativlar, shablonlar va narx taqsimoti; o'ngda haq va «Sahifa yaratish», shu offerdagi sahifalaringiz,
 * reklama qoidalari. Yaratilgan sahifa «Sahifani sozlash» da ochiladi — havola va «Nusxa olish» shu yerda.
 */
export default function AffiliateOfferPage() {
  const { t } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const offer = useAffiliateOfferQuery(productId);
  const streamsQuery = useAffiliateStreamsQuery();
  const create = useCreateStreamMutation();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  usePageTitle(offer.data?.name);

  if (offer.isError && !offer.data) {
    return <LoadError variant="page" error={offer.error} onRetry={() => void offer.refetch()} />;
  }
  const data = offer.data;
  if (!data) return <div className={styles.loading} aria-busy="true" aria-label={t('offers.loading')} />;

  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const streams = (streamsQuery.data?.items ?? []).filter((stream) => stream.productId === data.productId);
  const asOf = offer.dataUpdatedAt ? tashkentClock(offer.dataUpdatedAt) : null;
  const banner = data.state === 'OPEN' ? null : BANNERS[data.state];
  const createProps = {
    creating: create.isPending,
    failed: create.isError,
    onCreate: () => create.mutate(data.productId, { onSuccess: (stream) => void navigate(`/affiliate/pages/${stream.id}`, { state: { created: true } }) }),
  };
  const close = () => setDialog(null);

  return (
    <div className={styles.page}>
      {banner ? (
        <div className={styles.banner} data-tone={banner.tone} role="status">
          <banner.icon aria-hidden />
          <span>
            <strong>{t(banner.title)}</strong>
            <span>
              {t(banner.text, {
                product: data.name,
                date: data.stoppedAt ? tashkentDateTime(data.stoppedAt) : '—',
                reason: data.stopReason ?? '—',
              })}
            </span>
          </span>
        </div>
      ) : null}
      <div className={styles.layout}>
        <aside className={styles.aside} aria-label={t('offer.asideLabel')}>
          <FeeCard offer={data} sum={sum} phone={phone} {...createProps} />
          <MyStreamsCard offer={data} streams={streams} sum={sum} />
          <RulesCard />
        </aside>
        <div className={styles.main}>
          <ProductCard
            offer={data}
            onImages={() => setDialog({ kind: 'images', startId: data.creatives.find((creative) => creative.type === 'IMAGE')?.id ?? '' })}
            onBadRules={() => setDialog({ kind: 'rules' })}
          />
          <ResultsCard offer={data} streams={streams} asOf={asOf} sum={sum} />
          <CreativesCard
            offer={data}
            onVideo={(creative) => setDialog({ kind: 'video', creative })}
            onImage={(creative) => setDialog({ kind: 'images', startId: creative.id })}
            onDownloadAll={() => setDialog({ kind: 'download' })}
          />
          <TemplatesCard onPreview={(template) => setDialog({ kind: 'preview', template })} />
          <PriceSplitCard offer={data} sum={sum} />
        </div>
      </div>

      <PageActionBar>
        <CreateAction offer={data} block {...createProps} />
      </PageActionBar>

      {dialog?.kind === 'video' ? <VideoDialog offer={data} creative={dialog.creative} onClose={close} /> : null}
      {dialog?.kind === 'images' ? <ImagesDialog offer={data} startId={dialog.startId} onClose={close} /> : null}
      {dialog?.kind === 'download' ? <DownloadAllDialog offer={data} onClose={close} /> : null}
      {dialog?.kind === 'preview' ? (
        <TemplatePreviewDialog
          open
          onClose={close}
          initial={dialog.template}
          product={data}
          price={data.approvedPrice}
          centerFee={data.deliveryMode === 'FREE' ? 0 : data.centerDeliveryFee}
          doorFee={data.addressDeliveryFee}
        />
      ) : null}
      <AdRulesDialog open={dialog?.kind === 'rules'} onClose={close} />
    </div>
  );
}
