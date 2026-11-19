import { Skeleton } from 'antd';
import { CircleMinus, Clock, ShieldCheck, TriangleAlert, CircleCheck } from 'lucide-react';
import type { AffiliateStatsRow, AffiliateStream } from '../../../features/affiliate/api/affiliateApi';
import {
  pageQuality,
  QUALITY_CONFIRM_THRESHOLD,
  QUALITY_MIN_LEADS,
  QUALITY_VALID_THRESHOLD,
  type PageQuality,
} from '../../../features/affiliate/lib/statsBreakdown';
import { emptyStatsRow } from '../../../features/affiliate/lib/statsSummary';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import styles from '../AffiliateStatsPage.module.css';

interface PageQualityCardProps {
  streams: readonly AffiliateStream[];
  /** `groupBy=STREAM` qatorlari (kalit — sahifa kodi). */
  rows: readonly AffiliateStatsRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  range: string;
}

const clamp = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

function Meter({ value, mark }: { value: number | null; mark?: number }) {
  return (
    <span className={styles.meter} aria-hidden>
      <span className={styles.meterFill} style={{ width: clamp(value ?? 0) }} />
      {mark !== undefined ? <span className={styles.meterMark} style={{ left: clamp(mark) }} /> : null}
    </span>
  );
}

function StateBadge({ quality }: { quality: PageQuality }) {
  const { t } = useTranslation();
  const map = {
    noLeads: { icon: <CircleMinus size={14} aria-hidden />, text: t('sellerStats.quality.noLeads') },
    notRated: { icon: <Clock size={14} aria-hidden />, text: t('sellerStats.quality.notRated', { count: quality.leadsToRate }) },
    ok: { icon: <CircleCheck size={14} aria-hidden />, text: t('sellerStats.quality.ok') },
    below: { icon: <TriangleAlert size={14} aria-hidden />, text: t('sellerStats.quality.below') },
  } as const;
  const { icon, text } = map[quality.state];
  return (
    <span className={styles.qualityState} data-state={quality.state}>
      {icon}
      {text}
    </span>
  );
}

/**
 * «Sahifa sifati» (sotuvchi-statistika, TZ 7): har sahifa — lidlar / 50, yaroqli lid (chegara 60 %),
 * tasdiq (chegara 25 %). 50 liddan kam — «Baholanmaydi · yana N lid». Ogohlantirish banneri va
 * sahifani to'xtatish — M2 («Sifat va choralar»).
 */
export function PageQualityCard({ streams, rows, loading, error, onRetry, range }: PageQualityCardProps) {
  const { t } = useTranslation();
  let body;
  if (error && !rows) {
    body = <LoadError error={error} onRetry={onRetry} />;
  } else if (loading || !rows) {
    body = <Skeleton active title={false} paragraph={{ rows: 3 }} />;
  } else if (streams.length === 0) {
    body = <p className={styles.muted}>{t('sellerStats.quality.empty')}</p>;
  } else {
    body = (
      <ul className={styles.quality}>
        {streams.map((stream) => {
          const quality = pageQuality(rows.find((row) => row.key === stream.code) ?? emptyStatsRow(stream.code));
          const row = rows.find((item) => item.key === stream.code) ?? emptyStatsRow(stream.code);
          return (
            <li key={stream.id} data-stream={stream.code}>
              <div>
                <span className={styles.code}>{stream.code}</span>
                <p className={styles.muted}>{stream.productName} · <span className={styles.nowrap}>{formatMoney(stream.salePrice)}</span></p>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricHead}>{t('sellerStats.quality.leads')}</span>
                <span className={styles.metricValue}>
                  {quality.leads} <span>/ {QUALITY_MIN_LEADS}</span>
                </span>
                <Meter value={(quality.leads / QUALITY_MIN_LEADS) * 100} />
              </div>
              <div className={styles.metric} data-below={quality.validBelow}>
                <span className={styles.metricHead}>
                  {t('sellerStats.quality.valid')}
                  <span>{t('sellerStats.quality.threshold', { value: QUALITY_VALID_THRESHOLD })}</span>
                </span>
                <span className={styles.metricValue}>
                  {quality.validPercent === null ? '—' : <>{quality.validPercent}% <span>· {row.validLeads} / {row.leads}</span></>}
                </span>
                <Meter value={quality.validPercent} mark={QUALITY_VALID_THRESHOLD} />
              </div>
              <div className={styles.metric} data-below={quality.confirmBelow}>
                <span className={styles.metricHead}>
                  {t('sellerStats.quality.confirm')}
                  <span>{t('sellerStats.quality.threshold', { value: QUALITY_CONFIRM_THRESHOLD })}</span>
                </span>
                <span className={styles.metricValue}>
                  {quality.confirmPercent === null ? '—' : <>{quality.confirmPercent}% <span>· {row.confirmed} / {row.validLeads}</span></>}
                </span>
                <Meter value={quality.confirmPercent} mark={QUALITY_CONFIRM_THRESHOLD} />
              </div>
              <StateBadge quality={quality} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="stats-quality" data-testid="stats-quality">
      <div className={styles.head}>
        <div>
          <h2 id="stats-quality">{t('sellerStats.quality.title')}</h2>
          <p className={styles.muted}>{t('sellerStats.quality.period', { range })}</p>
        </div>
      </div>
      {body}
      <p className={styles.note}>
        <ShieldCheck size={16} aria-hidden />
        {t('sellerStats.quality.note')}
      </p>
    </section>
  );
}
