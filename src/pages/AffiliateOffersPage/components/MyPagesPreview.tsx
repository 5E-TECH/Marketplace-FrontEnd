import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { components } from '../../../generated/api-types';
import type { AffiliateOffer } from '../../../features/affiliate/api/offersApi';
import { streamStatus } from '../../../features/affiliate/lib/streamStatus';
import { StreamLinkInline } from '../../../features/affiliate/ui/StreamLink';
import { StreamStatusBadges } from '../../../features/affiliate/ui/StreamStatusBadges';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateOffersPage.module.css';

/** Offerlar sahifasida eng ko'pi shuncha sahifa — qolgani «Hammasi · N ›» da. */
const PREVIEW_ROWS = 5;

interface MyPagesPreviewProps {
  streams: UseQueryResult<components['schemas']['AffiliateStreamsPageDto']>;
  offers: ReadonlyMap<string, AffiliateOffer>;
  onBrowse: () => void;
}

/** «Mening sahifalarim» (sotuvchi-offerlar pastida): oxirgi sahifalar; bo'sh — «Hali sahifa yo‘q». */
export function MyPagesPreview({ streams, offers, onBrowse }: MyPagesPreviewProps) {
  const { t } = useTranslation();
  const page = streams.data;
  const rows = page?.items.slice(0, PREVIEW_ROWS) ?? [];

  return (
    <section className={styles.pagesCard} aria-labelledby="offers-pages-h" data-testid="my-pages-preview">
      <div className={styles.pagesHead}>
        <h2 id="offers-pages-h">{t('offers.myPages')}</h2>
        {page && page.total > 0 ? (
          <Link to="/affiliate/pages" className={styles.allLink}>
            {t('offers.myPagesAll', { count: page.total })}
            <ChevronRight aria-hidden />
          </Link>
        ) : null}
      </div>
      {streams.isError && !page ? (
        <LoadError variant="row" error={streams.error} onRetry={() => void streams.refetch()} />
      ) : !page ? (
        <div className={styles.pagesSkeleton} aria-busy="true" aria-label={t('offers.loading')} />
      ) : page.total === 0 ? (
        <div className={styles.pagesEmpty}>
          <span className={styles.emptyIcon} aria-hidden><Link2 /></span>
          <strong>{t('offers.myPagesEmpty')}</strong>
          <p>{t('offers.myPagesEmptyText')}</p>
          <button type="button" className={styles.outlineAction} onClick={onBrowse}>
            {t('offers.toOffers')}
            <ArrowRight aria-hidden />
          </button>
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={`${styles.table} ${styles.pagesTable}`}>
            <thead>
              <tr>
                <th>{t('offers.col.product')}</th>
                <th>{t('offers.col.link')}</th>
                <th>{t('offers.col.status')}</th>
                <th className={styles.num}>{t('offers.col.price')}</th>
                <th className={styles.num}>{t('offers.col.clicks')}</th>
                <th className={styles.num}>{t('offers.col.leads')}</th>
                <th className={styles.num}>{t('offers.col.sales')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((stream) => (
                <tr key={stream.id}>
                  <td className={styles.strong}>{stream.productName}</td>
                  <td><StreamLinkInline link={stream.link} /></td>
                  <td><StreamStatusBadges stream={stream} status={streamStatus(stream, offers.get(stream.productId))} /></td>
                  <td className={styles.num}>{t('affiliateHome.sum', { amount: formatMoney(stream.salePrice) })}</td>
                  <td className={styles.num}>{formatMoney(stream.clicks)}</td>
                  <td className={styles.num}>{formatMoney(stream.leads)}</td>
                  <td className={`${styles.num} ${styles.strong}`}>{stream.sales === null ? '—' : formatMoney(stream.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
