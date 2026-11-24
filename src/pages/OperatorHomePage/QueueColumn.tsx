import { ChevronRight, CircleAlert, CircleX, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { OperatorLead, OperatorStats } from '../../features/operator/api/operatorApi';
import { clock, mmss, outcomeLabel } from '../../features/operator/lib/leadFormat';
import { useNow } from '../../shared/lib/useNow';
import type { OperatorQueueSummary } from '../../features/operator/model/operatorTypes';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDate } from '../../shared/lib/tashkentTime';
import styles from './OperatorWorkspace.module.css';
import { Badge } from '../../shared/ui/Badge/Badge';

interface QueueColumnProps {
  bookings: OperatorLead[];
  callbacks: OperatorLead[];
  max: number;
  activeId: string | null;
  queue: OperatorQueueSummary | undefined;
  stats: OperatorStats | undefined;
  /** «Keyingi lid» o'chiq bo'lsa sababi (kulrang, xato emas). */
  blockedReason: string | null;
  nextPending: boolean;
  nextFailed: boolean;
  onNext: () => void;
  onOpen: (id: string) => void;
}

/**
 * «Navbat» paneli (operator-bosh, operator-lid-kartasi): «Keyingi lid», navbat soni, bronlarim,
 * bugungi rejalashtirilgan qo'ng'iroqlar va «Bugun» — bitta panelda, dizayndagi tartibda.
 */
export function QueueColumn({ bookings, callbacks, max, activeId, queue, stats, blockedReason, nextPending, nextFailed, onNext, onOpen }: QueueColumnProps) {
  const { t } = useTranslation();
  const now = useNow();
  const today = tashkentDate(now);
  const todayCallbacks = callbacks.filter((lead) => lead.callbackAt && tashkentDate(Date.parse(lead.callbackAt)) === today);
  const total = queue ? queue.newLeads + queue.dueCallbacks : null;
  const full = bookings.length >= max;

  return (
    <section className={`${styles.panel} ${styles.queue}`} aria-label={t('opw.queueLabel')}>
      <div className={styles.nextBlock}>
        <button
          type="button"
          className={styles.nextButton}
          data-variant={activeId ? 'outline' : undefined}
          disabled={Boolean(blockedReason) && !nextPending}
          aria-busy={nextPending || undefined}
          onClick={onNext}
          aria-keyshortcuts="F2"
          title={t('opw.nextTitle', { max })}
        >
          {nextPending ? t('opw.nextBooking') : t('opw.next')}
          <kbd className={activeId || blockedReason ? styles.kbd : `${styles.kbd} ${styles.kbdOnPrimary}`}>F2</kbd>
        </button>
        {nextFailed && !nextPending ? (
          <p className={`${styles.reason} ${styles.reasonError}`}><CircleX size={14} aria-hidden />{t('opw.nextFailed')}</p>
        ) : null}
        {blockedReason ? <p className={styles.reason} data-testid="next-reason"><CircleAlert size={14} aria-hidden />{blockedReason}</p> : null}
        {queue && total !== null ? (
          <div className={styles.queueInfo}>
            <p>{t('opw.queueCountLabel')} <strong>{t('opw.queueCountValue', { count: total })}</strong></p>
            <p>
              {total ? (
                <>
                  {queue.dueCallbacks && queue.newLeads ? (
                    <><strong>{queue.dueCallbacks}</strong> {t('opw.queueCallbacks')} <strong>{queue.newLeads}</strong> {t('opw.queueFresh')} </>
                  ) : null}
                  {t('opw.queueOrder')}
                </>
              ) : t('opw.queueEmptyHint')}
            </p>
          </div>
        ) : null}
      </div>

      <div className={styles.queueBlock}>
        <h2 className={styles.queueTitle}>{t('opw.bookings')} <span>({bookings.length}/{max})</span></h2>
        {bookings.length ? (
          <ul className={styles.bookingList}>
            {bookings.map((lead, index) => {
              const left = lead.bookedUntil ? Date.parse(lead.bookedUntil) - now : 0;
              const active = lead.id === activeId;
              const urgent = left <= 60_000 || (full && index === 0 && !activeId);
              return (
                <li key={lead.id}>
                  <button type="button" className={styles.booking} aria-current={active || undefined} onClick={() => onOpen(lead.id)}>
                    <span className={styles.bookingHead}><span>{lead.customerName}</span><span>{lead.id}</span></span>
                    <span className={styles.bookingProduct}>{lead.productName}</span>
                    <span className={styles.bookingFoot}>
                      <Badge tone={urgent ? 'warning' : 'plain'} icon={Timer}>{t('opw.bookedLeft', { time: mmss(left) })}</Badge>
                      {active ? <span className={styles.bookingActive}>{t('opw.active')}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyBox}>{t('opw.bookingsEmpty')}</p>
        )}
        <p className={styles.note}>{t('opw.bookingsRule', { max })}</p>
      </div>

      <div className={styles.callbacks}>
        <h2 className={styles.queueTitle}>
          <Link to="/operator/callbacks" className={styles.queueTitleLink}>
            <span>{t('opw.callbacksTitle')} <span>{t('opw.callbacksToday')}</span></span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        </h2>
        {todayCallbacks.length ? (
          <>
            <ul className={styles.callbackList}>
              {todayCallbacks.map((lead) => {
                const open = lead.id === activeId;
                return (
                  <li key={lead.id}>
                    <span className={styles.timePill} data-tone={open ? 'info' : undefined}>{clock(lead.callbackAt ?? '')}</span>
                    <span className={styles.callbackBody}>
                      <span className={styles.callbackHead}>
                        <span>{lead.customerName}</span>
                        <span data-open={open || undefined}>{open ? t('opw.callbackOpen') : lead.lastOutcome ? outcomeLabel(lead.lastOutcome, t) : ''}</span>
                      </span>
                      <span className={styles.callbackProduct}>{lead.productName}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className={`${styles.note} ${styles.callbacksNote}`}>{t('opw.callbacksRule')}</p>
          </>
        ) : (
          <p className={styles.emptyBox}>{t('opw.callbacksEmpty')}</p>
        )}
      </div>

      <div className={styles.today}>
        <div className={styles.todayHead}>
          <h2>{t('opw.todayTitle')}</h2>
          <Link to="/operator/stats" className={styles.textLink}>{t('opw.myStats')}<ChevronRight size={16} aria-hidden /></Link>
        </div>
        <TodayStatsList stats={stats} />
      </div>
    </section>
  );
}

/** «Bugun» ro'yxati (operator-bosh, operator-buyurtma-formasi.mobil): urinishlar, tasdiq, foiz, birinchi qo'ng'iroq, bonus. */
export function TodayStatsList({ stats }: { stats: OperatorStats | undefined }) {
  const { t } = useTranslation();
  return (
    <dl className={styles.todayList}>
      <div><dt>{t('opw.attempts')}</dt><dd>{stats?.attempts ?? '—'}</dd></div>
      <div><dt>{t('opw.confirmed')}</dt><dd>{stats?.confirmed ?? '—'}</dd></div>
      <div><dt>{t('opw.approveRate')}</dt><dd>{stats?.approveRate == null ? '—' : `${Math.round(stats.approveRate * 100)}%`}</dd></div>
      <div><dt>{t('opw.firstCall')}</dt><dd>{stats?.firstCallMedianMinutes == null ? '—' : t('opw.minutes', { count: stats.firstCallMedianMinutes })}</dd></div>
      <div><dt>{t('opw.bonus')}</dt><dd>{t('opw.bonusEmpty')}</dd></div>
    </dl>
  );
}
