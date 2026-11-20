import { ChartColumn, ChevronRight, Download, Eye, ImageIcon, Pill, Play, RefreshCw, Video } from 'lucide-react';
import { Fragment } from 'react';
import type { AffiliateOfferDetail, AffiliateStream } from '../../../features/affiliate/api/offersApi';
import type { OfferCreative, StreamTemplate } from '../../../features/affiliate/model/offerTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { formatMoney, formatMoneyNbsp } from '../../../shared/ui/MoneyText/formatMoney';
import { CreativesChip } from '../../../features/affiliate/ui/CreativesChip';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { useCreativeName } from '../model/offerView';
import { DownloadLink } from './CreativeDialogs';
import styles from '../AffiliateOfferPage.module.css';

type Sum = (value: number) => string;


/** Mahsulot (sotuvchi-offer 1-blok): rasm, qisqa tavsif, «Qutida», kategoriya / og'irlik / yetkazadi; BAD ogohlantirishi. */
export function ProductCard({ offer, onImages, onBadRules }: { offer: AffiliateOfferDetail; onImages: () => void; onBadRules: () => void }) {
  const { t } = useTranslation();
  const hasImages = offer.creatives.some((creative) => creative.type === 'IMAGE');
  return (
    <section className={styles.product} aria-label={t('offer.product')} data-area="product">
      <figure className={styles.figure}>
        <button type="button" className={styles.figureButton} onClick={onImages} disabled={!hasImages} aria-label={t('offer.showImages')}>
          <span className={styles.photo}>
            <ImageIcon aria-hidden />
            {offer.imageUrl ? <SafeImage src={offer.imageUrl} alt={offer.name} /> : null}
          </span>
        </button>
        {offer.isBad ? (
          <span className={styles.badChip}>
            <Pill aria-hidden />
            {t('offer.badShort')}
          </span>
        ) : null}
        <CreativesChip creatives={offer.creatives} className={styles.figureChip} />
      </figure>
      <div className={styles.productText}>
        <div className={styles.productCopy}>
          {offer.subtitle ? <p className={styles.subtitle}>{offer.subtitle}</p> : null}
          {offer.description ? <p className={styles.description}>{offer.description}</p> : null}
          {offer.isBad ? <p className={styles.strongLine}>{t('offer.notMedicine')}</p> : null}
          {offer.boxContents ? (
            <p>
              <span className={styles.strong}>{t('offer.box')}</span> {offer.boxContents}
            </p>
          ) : null}
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>{t('offer.category')}</dt>
            <dd>{offer.categoryName ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('offer.weight')}</dt>
            <dd>{offer.weightKg === null ? '—' : t('offer.kg', { value: offer.weightKg })}</dd>
          </div>
          <div>
            <dt>{t('offer.courier')}</dt>
            <dd>{t('preview.courier')}</dd>
          </div>
        </dl>
        {offer.isBad ? (
          <div className={styles.badBox}>
            <Pill aria-hidden />
            <span>
              <strong>{t('offer.badTitle')}</strong>
              <span>{t('offer.badText')}</span>
              <button type="button" className={styles.inlineLink} onClick={onBadRules}>{t('offer.badRules')}</button>
            </span>
          </div>
        ) : null}
        <p className={styles.productNote}>{t('offer.sameForAll')}</p>
      </div>
    </section>
  );
}

const FUNNEL = [
  { field: 'clicks', label: 'statsCsv.clicks', hint: 'affiliateHome.clicksHint' },
  { field: 'leads', label: 'statsCsv.leads', hint: 'affiliateHome.leadsHint' },
  { field: 'validLeads', label: 'statsCsv.valid', hint: 'offer.validHint', wide: true },
  { field: 'confirmed', label: 'statsCsv.confirmed', hint: 'offer.confirmedHint', wide: true },
  { field: 'delivered', label: 'statsCsv.delivered', hint: 'affiliateHome.deliveredHint', wide: true },
] as const satisfies readonly { field: keyof NonNullable<AffiliateOfferDetail['results']>; label: TranslationKey; hint: TranslationKey; wide?: boolean }[];

/** «Offer natijalari» — hamma sotuvchilar, sotuvga chiqqandan beri; ostida o'zingizning sahifalaringiz. */
export function ResultsCard({ offer, streams, asOf, sum }: { offer: AffiliateOfferDetail; streams: readonly AffiliateStream[]; asOf: string | null; sum: Sum }) {
  const { t } = useTranslation();
  const results = offer.results;
  const mine = streams.reduce((total, stream) => ({ clicks: total.clicks + stream.clicks, leads: total.leads + stream.leads, sales: total.sales + (stream.sales ?? 0) }), { clicks: 0, leads: 0, sales: 0 });
  return (
    <section className={styles.card} aria-labelledby="offer-results-h" data-testid="offer-results" data-area="results">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2 id="offer-results-h">{t('offer.results')}</h2>
          <span>{t('offer.resultsHint')}</span>
        </div>
        <span className={styles.refresh}>
          <RefreshCw aria-hidden />
          {t('sellerHome.statusLabel')} ·<b>{asOf ?? '—'}</b>
        </span>
      </div>
      {results ? (
        <>
          <div className={styles.bigStats}>
            <div>
              <span className={styles.label}>{t('offers.epc')}</span>
              <span className={styles.bigValue}>{offer.epc === null ? '—' : formatMoney(offer.epc)} <small>{t('preview.som')}</small></span>
              <span className={styles.hint}>{t('offer.epcHint', { revenue: sum(results.revenue), clicks: formatMoney(results.clicks) })}</span>
            </div>
            <div>
              <span className={styles.label}>{t('offers.approveRate')}</span>
              <span className={styles.bigValue}>{offer.approveRate === null ? '—' : `${offer.approveRate}%`}</span>
              <span className={styles.hint}>{t('offer.approveHint', { confirmed: formatMoney(results.confirmed), valid: formatMoney(results.validLeads) })}</span>
            </div>
            <div>
              <span className={styles.label}>{t('offers.saleRate')}</span>
              <span className={styles.bigValue}>{offer.saleRate === null ? '—' : `${offer.saleRate}%`}</span>
              <span className={styles.hint}>{t('offer.saleHint', { delivered: formatMoney(results.delivered), refused: formatMoney(results.refused) })}</span>
            </div>
          </div>
          <div className={styles.funnelBlock}>
            <ol className={styles.funnel} aria-label={t('offer.funnel')}>
              {FUNNEL.map((item, index) => (
                <Fragment key={item.field}>
                  {index ? <li className={styles.funnelArrow} aria-hidden><ChevronRight /></li> : null}
                  <li className={styles.funnelItem} data-wide={'wide' in item || undefined}>
                    <span className={styles.label}>{t(item.label)}</span>
                    <span className={styles.funnelValue}>{formatMoney(results[item.field])}</span>
                    <span className={styles.hint}>{t(item.hint)}</span>
                  </li>
                </Fragment>
              ))}
            </ol>
            <p className={styles.hint}>
              {t('offer.confirmedSplit', {
                confirmed: formatMoney(results.confirmed),
                delivered: formatMoney(results.delivered),
                refused: formatMoney(results.refused),
                transit: formatMoney(Math.max(0, results.confirmed - results.delivered - results.refused)),
              })}{' '}
              {streams.length
                ? t('offer.mine', { count: streams.length, clicks: formatMoney(mine.clicks), leads: formatMoney(mine.leads), sales: formatMoney(mine.sales) })
                : t('offer.mineNone')}
            </p>
          </div>
        </>
      ) : (
        <div className={styles.noStats}>
          <span className={styles.noStatsIcon} aria-hidden><ChartColumn /></span>
          <span>
            <strong>{t('offers.noStats')}</strong>
            <span>{t('offer.noStatsText', { date: tashkentDay(`${offer.onSaleSince}T12:00:00+05:00`) })}</span>
          </span>
        </div>
      )}
    </section>
  );
}

/** «Kreativlar» — video va rasmlar, har biri ko'rish va yuklab olish; «Hammasini yuklab olish». */
export function CreativesCard({ offer, onVideo, onImage, onDownloadAll }: {
  offer: AffiliateOfferDetail;
  onVideo: (creative: OfferCreative) => void;
  onImage: (creative: OfferCreative) => void;
  onDownloadAll: () => void;
}) {
  const { t } = useTranslation();
  const name = useCreativeName(offer.creatives);
  const counts = t('offers.creatives', {
    videos: offer.creatives.filter((creative) => creative.type === 'VIDEO').length,
    images: offer.creatives.filter((creative) => creative.type === 'IMAGE').length,
  });
  return (
    <section className={styles.card} aria-labelledby="offer-creatives-h" data-testid="offer-creatives" data-area="creatives">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2 id="offer-creatives-h">{t('offer.creatives')}</h2>
          <span>{t('offer.creativesHint', { counts })}</span>
        </div>
        {offer.creatives.length ? (
          <button type="button" className={styles.smallButton} onClick={onDownloadAll}>
            <Download aria-hidden />
            {t('offer.downloadAll')}
          </button>
        ) : null}
      </div>
      <div className={styles.creativeGrid}>
        {offer.creatives.map((creative) => {
          const label = name(creative);
          return (
            <figure key={creative.id} className={styles.creative} data-kind={creative.type === 'VIDEO' ? 'video' : undefined}>
              {creative.type === 'VIDEO' ? (
                <div className={styles.tile} data-kind="video">
                  <span className={styles.tileChip}>
                    <Video aria-hidden />
                    {t('offer.video')}
                  </span>
                  {creative.processing ? (
                    <span className={styles.processing}>{t('offer.processing')}</span>
                  ) : (
                    <button type="button" className={styles.tilePlay} onClick={() => onVideo(creative)} aria-label={t('offer.watchVideo')}>
                      <Play aria-hidden />
                    </button>
                  )}
                </div>
              ) : (
                <button type="button" className={styles.tileButton} onClick={() => onImage(creative)} aria-label={t('offer.zoom', { name: label })}>
                  <span className={styles.tile}>
                    <ImageIcon aria-hidden />
                    <SafeImage src={creative.url} alt="" loading="lazy" />
                  </span>
                </button>
              )}
              <figcaption className={styles.caption}>
                <span>
                  <span>{label}</span>
                  {creative.caption ? <span>{creative.caption}</span> : null}
                </span>
                <DownloadLink creative={creative} label={label} />
              </figcaption>
            </figure>
          );
        })}
      </div>
      <p className={styles.hint}>{t('offer.creativesNote')}</p>
    </section>
  );
}

const TEMPLATES: readonly { value: StreamTemplate; icon: typeof ImageIcon; text: TranslationKey }[] = [
  { value: 'STANDART', icon: ImageIcon, text: 'offer.templateStandard' },
  { value: 'VIDEO', icon: Play, text: 'offer.templateVideo' },
];

/** «Sahifa ko‘rinishi» — ikki shablon, «Standart» — sukut; har biri «Oldindan ko‘rish». */
export function TemplatesCard({ onPreview }: { onPreview: (template: StreamTemplate) => void }) {
  const { t } = useTranslation();
  return (
    <section className={styles.card} aria-labelledby="offer-templates-h" data-area="templates">
      <div className={styles.cardTitle}>
        <h2 id="offer-templates-h">{t('offer.templates')}</h2>
        <span>{t('offer.templatesHint')}</span>
      </div>
      <div className={styles.templates}>
        {TEMPLATES.map(({ value, icon: Icon, text }) => (
          <div key={value} className={styles.template}>
            <span className={styles.templateThumb} aria-hidden><Icon /></span>
            <div className={styles.templateBody}>
              <span className={styles.templateName}>
                <span>«{t(`streams.template.${value}` as TranslationKey)}»</span>
                {value === 'STANDART' ? <Badge tone="info">{t('offer.default')}</Badge> : null}
              </span>
              <span className={styles.templateText}>{t(text)}</span>
              <span>
                <button type="button" className={styles.smallButton} onClick={() => onPreview(value)}>
                  <Eye aria-hidden />
                  {t('offer.preview')}
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className={styles.hint}>{t('offer.templatesNote')}</p>
    </section>
  );
}

/** «Narx qanday bo‘linadi» — tavsiya narx taqsimoti; sotuvchi haqi ajratilgan. */
export function PriceSplitCard({ offer, sum }: { offer: AffiliateOfferDetail; sum: Sum }) {
  const { t } = useTranslation();
  const split = offer.priceSplit;
  if (!split) return null;
  const parts = [
    { key: 'wholesale', value: split.wholesale, mine: false },
    { key: 'fee', value: split.affiliateFee, mine: true },
    { key: 'callCenter', value: split.callCenter, mine: false },
    { key: 'platform', value: split.platform, mine: false },
  ] as const;
  const share = (value: number) => `${((value * 100) / split.recommended).toFixed(1)}%`;
  const mode = offer.deliveryMode === 'PARTIAL'
    ? t('offer.modePartial', { delivery: formatMoneyNbsp(split.deliveryInPrice), extra: formatMoneyNbsp(offer.approvedPrice - split.recommended) })
    : t(offer.deliveryMode === 'FREE' ? 'offer.modeFree' : 'offer.modeSeparate');

  return (
    <section className={styles.card} aria-labelledby="offer-split-h" data-area="split">
      <div className={styles.cardTitle} data-stack>
        <h2 id="offer-split-h">{t('offer.split')}</h2>
        <span>{t('offer.splitHint', { price: sum(split.recommended) })}</span>
      </div>
      <div className={styles.splitBar} role="img" aria-label={parts.map((part) => `${t(`offer.split.${part.key}` as TranslationKey)} ${formatMoney(part.value)}`).join(', ')}>
        {parts.map((part) => <span key={part.key} style={{ flexGrow: part.value }} data-mine={part.mine || undefined} />)}
      </div>
      <ul className={styles.splitList}>
        {parts.map((part) => (
          <li key={part.key} data-mine={part.mine || undefined}>
            <span className={styles.swatch} data-mine={part.mine || undefined} aria-hidden />
            <span className={styles.splitName}>
              <span>{t(`offer.split.${part.key}` as TranslationKey)}</span>
              <span>{t(`offer.split.${part.key}Hint` as TranslationKey)}</span>
            </span>
            <span className={styles.splitValue}>{sum(part.value)}</span>
            <span className={styles.splitShare}>{share(part.value)}</span>
          </li>
        ))}
        <li data-total>
          <span aria-hidden />
          <span className={styles.splitName}><span>{t('offer.split.total')}</span></span>
          <span className={styles.splitValue}>{sum(split.recommended)}</span>
          <span className={styles.splitShare}>100%</span>
        </li>
      </ul>
      <div className={styles.modeBox}>
        <p>{t('offer.customerSees', { price: sum(offer.approvedPrice) })}</p>
        <p>{mode}</p>
      </div>
    </section>
  );
}
