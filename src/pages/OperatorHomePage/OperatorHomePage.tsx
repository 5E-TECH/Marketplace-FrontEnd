import { Headset } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOperatorLeadsQuery, useOperatorStatsQuery, useOperatorStateQuery, DEFAULT_MAX_BOOKINGS } from '../../features/operator/api/operatorQueries';
import type { OperatorLead } from '../../features/operator/api/operatorApi';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { LiveStamp } from '../../shared/ui/ConnectionBanner/ConnectionBanner';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import styles from './OperatorHomePage.module.css';

const formatLeft = (until: string | null, now: number) => {
  if (!until) return '—';
  const seconds = Math.max(0, Math.round((Date.parse(until) - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * Operator «Ish joyi» — faol lid yo'q holati (operator-bosh, FE-02 TC1): bronlar,
 * bugungi rejalashtirilgan qo'ng'iroqlar va statistika jonli. Lid kartasi, natijalar
 * va «Keyingi lid» — FE-08.
 */
export default function OperatorHomePage() {
  const { t } = useTranslation();
  const today = tashkentDate();
  const leads = useOperatorLeadsQuery();
  const stats = useOperatorStatsQuery(today, today);
  const max = useOperatorStateQuery().data?.maxBookings ?? DEFAULT_MAX_BOOKINGS;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const booked = leads.data?.filter((lead) => lead.status === 'BOOKED') ?? [];
  const callbacks = (leads.data ?? [])
    .filter((lead): lead is OperatorLead & { callbackAt: string } => lead.status === 'CALLBACK' && Boolean(lead.callbackAt) && tashkentDate(Date.parse(lead.callbackAt ?? '')) === today)
    .sort((a, b) => a.callbackAt.localeCompare(b.callbackAt));

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <LiveStamp updatedAt={leads.dataUpdatedAt} live={!leads.isError} />
      </div>

      <section className={styles.idle} aria-labelledby="operator-idle">
        <span className={styles.idleIcon} aria-hidden><Headset /></span>
        <div>
          <h2 id="operator-idle">{t('operatorHome.idleTitle')}</h2>
          <p>{t('operatorHome.idleText')}</p>
        </div>
      </section>

      {leads.isError && !leads.data ? (
        <LoadError error={leads.error} onRetry={() => void leads.refetch()} />
      ) : (
        <div className={styles.columns}>
          <section className={styles.card} aria-labelledby="operator-bookings-title">
            <h2 id="operator-bookings-title">{t('operatorHome.bookingsTitle', { count: booked.length, max })}</h2>
            {booked.length ? (
              <ul className={styles.list}>
                {booked.map((lead) => (
                  <li key={lead.id}>
                    <strong>{lead.customerName}</strong> <span className={styles.muted}>{lead.id} · {lead.productName}</span>
                    <span className={styles.badge}>{t('operatorHome.bookedLeft', { time: formatLeft(lead.bookedUntil, now) })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>{t('operatorHome.bookingsEmpty')}</p>
            )}
          </section>

          <section className={styles.card} aria-labelledby="operator-callbacks-title">
            <h2 id="operator-callbacks-title">{t('operatorHome.callbacksTitle')}</h2>
            {callbacks.length ? (
              <ul className={styles.list}>
                {callbacks.map((lead) => (
                  <li key={lead.id}>
                    <strong>{tashkentClock(Date.parse(lead.callbackAt))}</strong> {lead.customerName}{' '}
                    <span className={styles.muted}>{lead.productName}</span>
                    {lead.reminderDue ? <span className={styles.soon}>{t('operatorHome.callbackSoon')}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>{t('operatorHome.callbacksEmpty')}</p>
            )}
          </section>
        </div>
      )}

      <section className={styles.card} aria-labelledby="operator-today-title">
        <h2 id="operator-today-title">{t('operatorHome.todayTitle')}</h2>
        {stats.isError && !stats.data ? (
          <LoadError error={stats.error} onRetry={() => void stats.refetch()} />
        ) : (
          <dl className={styles.metrics}>
            <div><dt>{t('operatorHome.attempts')}</dt><dd>{stats.data?.attempts ?? '—'}</dd></div>
            <div><dt>{t('operatorHome.confirmed')}</dt><dd>{stats.data?.confirmed ?? '—'}</dd></div>
            <div><dt>{t('operatorHome.approveRate')}</dt><dd>{stats.data?.approveRate == null ? '—' : `${Math.round(stats.data.approveRate * 100)}%`}</dd></div>
            <div><dt>{t('operatorHome.firstCall')}</dt><dd>{stats.data?.firstCallMedianMinutes == null ? '—' : t('operatorHome.minutes', { count: stats.data.firstCallMedianMinutes })}</dd></div>
          </dl>
        )}
      </section>
    </div>
  );
}
