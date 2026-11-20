import { ChevronRight, Link2, Package, PauseCircle, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { splitStreamLink } from '../../../features/affiliate/lib/streamLink';
import { CopyLinkButton, OpenLinkButton, StreamLinkBox } from '../../../features/affiliate/ui/StreamLink';
import { StreamStatusBadges } from '../../../features/affiliate/ui/StreamStatusBadges';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { StreamRow } from '../model/streamRows';
import styles from '../AffiliatePagesPage.module.css';

/** «Tanlangan sahifa» (sotuvchi-sahifalarim): havola va nusxa, hamma vaqt natijasi, sozlamalar. */
export function SelectedStream({ row, phone }: { row: StreamRow; phone: boolean }) {
  const { t } = useTranslation();
  const { stream, offer } = row;
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const delivery = offer?.centerDeliveryFee;
  const settings: [TranslationKey, string][] = [
    ['pages.set.template', t(`streams.template.${stream.template}` as TranslationKey)],
    ['pages.set.price', delivery ? t('pages.priceDelivery', { price: formatMoney(stream.salePrice), delivery: formatMoney(delivery) }) : sum(stream.salePrice)],
    ['pages.set.fee', row.fee === null ? '—' : sum(row.fee)],
    ['pages.set.domain', splitStreamLink(stream.link).domain],
    ['pages.set.postback', t(stream.postbackUrl ? 'pages.configured' : 'pages.notConfigured')],
    ['pages.set.pixels', t(stream.metaPixelId || stream.tiktokPixelId || stream.hasCapiToken ? 'pages.configured' : 'pages.notConfigured')],
    ['pages.set.created', tashkentDay(stream.createdAt)],
  ];

  return (
    <section className={styles.selected} aria-labelledby="selected-h" data-testid="selected-stream">
      {phone ? null : <p className={styles.selectedLabel}>{t('pages.selected')}</p>}
      <div className={styles.selectedCols}>
        <div className={styles.selectedMain}>
          <div className={styles.selectedTitle}>
            <h2 id="selected-h">{stream.code}</h2>
            <StreamStatusBadges stream={stream} status={row.status} />
            <span>{offer?.categoryName ? `${stream.productName} · ${offer.categoryName}` : stream.productName}</span>
          </div>
          <div className={styles.selectedLink}>
            <StreamLinkBox link={stream.link} size="md" />
            {phone ? null : <CopyLinkButton link={stream.link} />}
          </div>
          <div className={styles.selectedActions}>
            <OpenLinkButton link={stream.link} size="md" block={phone} />
          </div>
          <p className={styles.attribution}>
            <Link2 aria-hidden />
            <span>{t('streams.attribution')}</span>
          </p>
        </div>
        <div className={styles.selectedCol}>
          <p className={styles.selectedLabel}>{t('pages.resultsAllTime')}</p>
          <div className={styles.resultBox}>
            <div><span>{t('offers.col.clicks')}</span><span>{formatMoney(stream.clicks)}</span></div>
            <div><span>{t('offers.col.leads')}</span><span>{formatMoney(stream.leads)}</span></div>
            <div><span>{t('offers.col.sales')}</span><span>{stream.sales === null ? '—' : formatMoney(stream.sales)}</span></div>
          </div>
          <div className={styles.income}>
            <span>{t('pages.col.income')}</span>
            <span>{row.income === null ? '—' : sum(row.income)}</span>
            {row.income !== null ? (
              <span>
                {row.fee !== null && stream.sales && stream.sales * row.fee === row.income ? `${t('pages.incomeFormula', { sales: formatMoney(stream.sales), fee: sum(row.fee) })} · ` : ''}
                {t('pages.incomeHold', { amount: formatMoney(row.hold ?? 0) })}
              </span>
            ) : null}
          </div>
          <div className={styles.links}>
            <Link to={`/affiliate/stats?page=${stream.id}`}>{t('pages.statsLink')}<ChevronRight aria-hidden /></Link>
            <Link to={`/affiliate/leads?page=${stream.id}`}>{t('pages.leadsLink')}<ChevronRight aria-hidden /></Link>
          </div>
        </div>
        <div className={styles.selectedCol} data-settings>
          <p className={styles.selectedLabel}>{t('pages.settings')}</p>
          <dl className={styles.settings}>
            {settings.map(([key, value]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd data-muted={key === 'pages.set.domain' || undefined}>{value}</dd>
              </div>
            ))}
          </dl>
          {phone ? null : (
            <Link to={`/affiliate/pages/${stream.id}`} className={styles.settingsButton}>
              <SlidersHorizontal aria-hidden />
              {t(row.stream.status === 'STOPPED' ? 'pages.viewSettings' : 'pages.menu.settings')}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

const WHEN_ITEMS = [
  { icon: ShieldCheck, title: 'pages.when.quality', text: 'pages.when.qualityText' },
  { icon: Package, title: 'pages.when.stock', text: 'pages.when.stockText' },
  { icon: PauseCircle, title: 'pages.when.offer', text: 'pages.when.offerText' },
] as const;

/** «Sahifa qachon ariza qabul qilmaydi» — ko'k ma'lumot bloki (sotuvchi-sahifalarim pastida). */
export function WhenNotAccepting() {
  const { t } = useTranslation();
  return (
    <section className={styles.when} aria-labelledby="when-h">
      <div className={styles.whenHead}>
        <h2 id="when-h">{t('pages.when.title')}</h2>
        <span>{t('pages.when.text')}</span>
      </div>
      <ul>
        {WHEN_ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <span className={styles.whenIcon} aria-hidden><Icon /></span>
            <span>
              <strong>{t(title)}</strong>
              <span>{t(text)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
