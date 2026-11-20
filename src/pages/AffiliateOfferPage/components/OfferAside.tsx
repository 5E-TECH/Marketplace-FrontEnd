import { ChevronRight, Copy, Loader2, Lock, Package, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AffiliateOfferDetail, AffiliateStream } from '../../../features/affiliate/api/offersApi';
import { feeAt, markupLimitPercent, markupOf, markupShare } from '../../../features/affiliate/lib/offerMath';
import { streamStatus } from '../../../features/affiliate/lib/streamStatus';
import { AdRulesList } from '../../../features/affiliate/ui/AdRules';
import { StreamLinkInline } from '../../../features/affiliate/ui/StreamLink';
import { StreamStatusBadges } from '../../../features/affiliate/ui/StreamStatusBadges';
import { useCopyLink } from '../../../features/affiliate/ui/useCopyLink';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { blockReason } from '../model/offerView';
import styles from '../AffiliateOfferPage.module.css';

type Sum = (value: number) => string;

interface CreateProps {
  creating: boolean;
  failed: boolean;
  onCreate: () => void;
}

/** «Sahifa yaratish» tugmasi va sababi (telefonda pastki panelda ham shu). */
export function CreateAction({ offer, creating, failed, onCreate, block }: CreateProps & { offer: AffiliateOfferDetail; block?: boolean }) {
  const { t } = useTranslation();
  const reason = blockReason(offer);
  return (
    <button
      type="button"
      className={styles.createButton}
      data-block={block || undefined}
      disabled={Boolean(reason)}
      aria-busy={creating || undefined}
      onClick={creating ? undefined : onCreate}
    >
      {creating ? <Loader2 className={styles.spin} aria-hidden /> : <Plus aria-hidden />}
      {creating ? t('offers.creating') : failed ? t('offers.retry') : t('offers.create')}
    </button>
  );
}

/** «Haqingiz» kartasi: narx, yetkazish, mijoz jami, ustama bilan haq, «Sahifa yaratish», qoldiq. */
export function FeeCard({ offer, sum, phone, ...create }: CreateProps & { offer: AffiliateOfferDetail; sum: Sum; phone: boolean }) {
  const { t } = useTranslation();
  const reason = blockReason(offer);
  const free = offer.deliveryMode === 'FREE';
  const maxFee = feeAt(offer, offer.maxSalePrice);
  const share = markupShare(markupOf(offer, offer.maxSalePrice));
  return (
    <section className={styles.feeCard} aria-labelledby="offer-fee-h" data-testid="offer-fee" data-area="fee">
      <div className={styles.feeHead}>
        <span id="offer-fee-h" className={styles.label}>{t('offers.fee')}</span>
        <span className={styles.bigValue}>{sum(offer.affiliateFee)}</span>
        <span className={styles.hint13}>{t('offers.feeHint')}</span>
      </div>
      <dl className={styles.feeRows}>
        <div>
          <dt>{t('offer.price')}</dt>
          <dd><span className={styles.strong}>{sum(offer.approvedPrice)}</span></dd>
        </div>
        <div>
          <dt>{t('offer.delivery')}</dt>
          <dd>
            {free ? <span className={styles.strong}>{t('offer.deliveryFree')}</span> : t('offer.deliveryCenter', { amount: sum(offer.centerDeliveryFee) })}
            {offer.addressDeliveryFee !== null ? (
              <>
                <br />
                <span className={styles.subValue}>{t('offer.deliveryDoor', { amount: sum(offer.addressDeliveryFee) })}</span>
              </>
            ) : null}
          </dd>
        </div>
      </dl>
      <div className={styles.totalBox}>
        <div>
          <span>{t(free ? 'offer.total' : 'offer.totalCenter')}</span>
          <span>{sum(offer.approvedPrice + (free ? 0 : offer.centerDeliveryFee))}</span>
        </div>
        <span>{t(free ? 'offer.totalFreeHint' : 'offer.totalHint')}</span>
      </div>
      {offer.maxSalePrice > offer.approvedPrice ? (
        <div className={styles.markup}>
          <p>{t('offer.raise', { price: sum(offer.maxSalePrice), fee: sum(maxFee) })}</p>
          <p>{t('offer.raiseHint', { percent: markupLimitPercent(offer), fee: formatMoney(offer.affiliateFee), share: formatMoney(share) })}</p>
        </div>
      ) : null}
      {phone ? null : (
        <div className={styles.createBlock}>
          <CreateAction offer={offer} block {...create} />
          {reason ? (
            <p className={styles.blocked}>
              <Lock aria-hidden />
              {t(reason)}
            </p>
          ) : create.failed ? (
            <p className={styles.createError} role="alert">{t('offers.createFailed')}</p>
          ) : (
            <p className={styles.hint}>{t('offer.createHint')}</p>
          )}
        </div>
      )}
      <div className={styles.stockRow}>
        <Package aria-hidden />
        <span>
          <span>
            {t('offers.stock')} <span className={styles.strong}>{offer.stock > 0 ? t('offers.stockCount', { count: formatMoney(offer.stock) }) : 0}</span>
          </span>
          <span className={styles.hint}>{t('offer.stockHint')}</span>
        </span>
      </div>
    </section>
  );
}

/** «Sahifalaringiz · N» — shu offerdagi sahifalar: havola, holat, narx va natija, nusxa. */
export function MyStreamsCard({ offer, streams, sum }: { offer: AffiliateOfferDetail; streams: readonly AffiliateStream[]; sum: Sum }) {
  const { t } = useTranslation();
  const copy = useCopyLink();
  return (
    <section className={styles.asideCard} aria-labelledby="offer-streams-h" data-testid="offer-streams" data-area="streams">
      <div className={styles.asideHead}>
        <h2 id="offer-streams-h">
          {t('offer.myStreams')} <span className={styles.count}>· {streams.length}</span>
        </h2>
        {streams.length ? (
          <Link to="/affiliate/pages" className={styles.allLink}>
            {t('offer.all')}
            <ChevronRight aria-hidden />
          </Link>
        ) : null}
      </div>
      {streams.length ? (
        <>
          <ul className={styles.streamList}>
            {streams.map((stream) => (
              <li key={stream.id}>
                <div>
                  <span className={styles.streamTop}>
                    <StreamLinkInline link={stream.link} />
                    <StreamStatusBadges stream={stream} status={streamStatus(stream, offer)} />
                  </span>
                  <span className={styles.streamMeta}>
                    <b>{sum(stream.salePrice)}</b> · {t('offer.streamStats', { clicks: formatMoney(stream.clicks), leads: formatMoney(stream.leads), sales: stream.sales === null ? '—' : formatMoney(stream.sales) })}
                  </span>
                </div>
                <button type="button" className={styles.iconButton} onClick={() => void copy(stream.link)} aria-label={t('offer.copyStream', { code: stream.code })} title={t('offer.copyStream', { code: stream.code })}>
                  <Copy aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.asideNote}>{t(offer.state === 'OPEN' ? 'offer.streamsNote' : 'offer.streamsPausedNote')}</p>
        </>
      ) : (
        <p className={styles.asideEmpty}>{t('offer.noStreams')}</p>
      )}
    </section>
  );
}

export function RulesCard() {
  const { t } = useTranslation();
  return (
    <section className={styles.asideCard} data-rules aria-labelledby="offer-rules-h" data-area="rules">
      <div className={styles.rulesHead}>
        <h2 id="offer-rules-h">{t('adRules.title')}</h2>
        <span>{t('adRules.intro')}</span>
      </div>
      <AdRulesList />
    </section>
  );
}
