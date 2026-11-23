import { Printer } from 'lucide-react';
import { waveStats } from '../../../features/fulfillment/lib/pickRules';
import type { PickTask } from '../../../features/fulfillment/model/fulfillmentTypes';
import { loadHandoverDraft } from '../../../features/fulfillment/model/handoverDraft';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import styles from '../WarehousePickingPage.module.css';

export type WaveDay = 'today' | 'tomorrow';

interface WaveCardProps {
  day: WaveDay;
  date: string;
  items: readonly PickTask[];
  counts: Record<WaveDay, number>;
  onDay: (day: WaveDay) => void;
  /** Yig'ish varaqasi (hujjat-yigish-varaqasi) — yangi tabda A4. */
  sheetHref: string;
}

const Placeholder = ({ text }: { text: string }) => <span className={styles.muted}>{text}</span>;

/** «Bugungi to'lqin» (ombor-yigish): 14:00 qoidasi, bugun/ertaga, qadoqlangan / jami, Elchi, varaq va akt. */
export function WaveCard({ day, date, items, counts, onDay, sheetHref }: WaveCardProps) {
  const { t } = useTranslation();
  const stats = waveStats(items, { active: day === 'today' });
  const draft = loadHandoverDraft();
  const segments = [
    ...Array.from({ length: stats.packed }, () => 'packed'),
    ...Array.from({ length: stats.picking }, () => 'picking'),
    ...Array.from({ length: stats.queued }, () => 'queued'),
  ];
  return (
    <section className={styles.card} data-testid="wave-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{t(day === 'today' ? 'ful.wave.today' : 'ful.wave.tomorrow', { date: isoToDots(date) })}</h2>
          <span>{t('ful.wave.rule')} <Placeholder text={t('ful.wave.pickupTbd')} /></span>
        </div>
        <div className={styles.pills} role="tablist" aria-label={t('ful.wave.dayAria')}>
          {(['today', 'tomorrow'] as const).map((value) => (
            <button key={value} type="button" role="tab" className={styles.pill} aria-selected={day === value} onClick={() => onDay(value)}>
              {t(value === 'today' ? 'ful.wave.dayToday' : 'ful.wave.dayTomorrow')}
              <span className={styles.pillCount}>{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>
      {items.length ? (
        <div className={styles.waveBody}>
          <div className={styles.waveProgress}>
            <div className={styles.waveTotal}>
              <span>{t('ful.wave.packed')}</span>
              <span className={styles.waveValue} data-testid="wave-packed">{stats.packed} / {stats.total}<span> {t('ful.wave.parcelUnit')}</span></span>
            </div>
            <div className={styles.segments} role="img" aria-label={t('ful.wave.barAria', { total: stats.total, packed: stats.packed, picking: stats.picking, queued: stats.queued })}>
              {segments.map((kind, index) => <span key={index} data-kind={kind} />)}
            </div>
            <div className={styles.legend}>
              <span><i data-kind="packed" />{t('ful.wave.packed')} <strong>{stats.packed}</strong></span>
              <span><i data-kind="picking" />{t('ful.wave.picking')} <strong>{stats.picking}</strong>{stats.current ? ` · ${stats.current.orderNumber}` : ''}</span>
              <span><i />{t('ful.wave.queued')} <strong>{stats.queued}</strong></span>
            </div>
          </div>
          <div className={styles.waveFacts}>
            <dl className={styles.facts}>
              <div><dt>{t('ful.wave.pickup')}</dt><dd><Placeholder text={t('ful.wave.pickupTbd')} /></dd></div>
              <div>
                <dt>{t('ful.wave.sheet')}</dt>
                <dd><a className={styles.linkButton} href={sheetHref} target="_blank" rel="noopener"><Printer aria-hidden />{t('ful.wave.sheetPrint')}</a></dd>
              </div>
              <div>
                <dt>{t('ful.wave.act')}</dt>
                <dd>{draft?.tokens.length ? t('ful.wave.actValue', { scanned: draft.tokens.length, packed: stats.packed }) : t('ful.wave.actNone')}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <p className={styles.emptyWave} data-testid="wave-empty">
          <strong>{t(day === 'today' ? 'ful.wave.emptyToday' : 'ful.wave.emptyTomorrow')}</strong>
          {t('ful.wave.emptyText')}
        </p>
      )}
    </section>
  );
}
