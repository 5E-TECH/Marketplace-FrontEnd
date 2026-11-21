import { ChevronRight, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDay } from '../../../shared/lib/tashkentTime';
import { submittedAt } from '../model/decision';
import styles from '../AdminModerationPage.module.css';


const stamp = (iso: string) => `${tashkentDay(iso)} · ${tashkentClock(Date.parse(iso))}`;

/** Ro'yxat yangilangan vaqt va «Yangilash» (har 60 soniyada o'zi ham yangilanadi). */
export function RefreshStatus({ updatedAt, onRefresh, refreshing, compact = false }: { updatedAt: number; onRefresh: () => void; refreshing: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={styles.updated}>
        {t('moderation.updatedAt')} <strong>{updatedAt ? tashkentClock(updatedAt) : '—'}</strong> {t('moderation.every60')}
      </span>
      {compact ? (
        <button type="button" className={styles.refreshIcon} onClick={onRefresh} disabled={refreshing} aria-label={t('moderation.refresh')} title={t('moderation.refresh')}>
          <RefreshCw aria-hidden data-spin={refreshing || undefined} />
        </button>
      ) : (
        <button type="button" className={styles.refresh} onClick={onRefresh} disabled={refreshing}>
          <RefreshCw aria-hidden data-spin={refreshing || undefined} />
          {t('moderation.refresh')}
        </button>
      )}
    </>
  );
}

interface QueueProps {
  items: readonly AdminProductListItem[];
  /** Birinchi yuklanish (holatlar 5.1): qatorlar skelet. */
  loading: boolean;
  selectedId: string | undefined;
  /** Desktop/planshet: `?product=` bilan shu sahifada; telefon: alohida sahifa. */
  hrefOf: (id: string) => string;
  status: ReactNode;
}

/** Desktop — chap ustun; planshetda (container) — 3 ustunli kataklar, pastida yangilanish qatori. */
export function ModerationQueue({ items, loading, selectedId, hrefOf, status }: QueueProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.queue} aria-labelledby="queue-h" data-testid="moderation-queue">
      <div className={styles.queueInner}>
        <div className={styles.queueHead}>
          <h2 id="queue-h">
            {t('moderation.queue.title')} <span>{t('moderation.queue.reviewing')}</span>{' '}
            {loading ? null : <span className={styles.nums}>{t('moderation.queue.count', { count: items.length })}</span>}
          </h2>
          <p>{t('moderation.queue.order')}</p>
        </div>
        <ul className={styles.queueList} aria-busy={loading || undefined}>
          {loading ? [0, 1, 2].map((index) => <li key={index}><span className={styles.queueSkeleton} /></li>) : null}
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={hrefOf(item.id)}
                className={styles.queueItem}
                aria-current={item.id === selectedId ? 'true' : undefined}
                aria-label={t('moderation.queue.openAria', { name: item.name })}
              >
                <span>{item.name}</span>
                <span>{item.shop?.name ?? '—'}</span>
                <span>{stamp(submittedAt(item))}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.queueFoot}>
          <p>{t('moderation.queue.note')}</p>
          <div className={styles.queueStatus}>{status}</div>
        </div>
      </div>
    </section>
  );
}

/** Telefon (holatlar 10.1): qator 64, «›»; mahsulot bosilsa — uning sahifasi. */
export function PhoneQueue({ items, hrefOf }: { items: readonly AdminProductListItem[]; hrefOf: (id: string) => string }) {
  const { t } = useTranslation();
  return (
    <section className={styles.phoneQueue} aria-labelledby="queue-h" data-testid="moderation-queue">
      <h2 id="queue-h">{t('moderation.queue.title')} {t('moderation.queue.count', { count: items.length })}</h2>
      <p>{t('moderation.queue.order')}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={hrefOf(item.id)} aria-label={t('moderation.queue.openAria', { name: item.name })}>
              <span>
                <span>{item.name}</span>
                <span>{`${item.shop?.name ?? '—'} · ${stamp(submittedAt(item))}`}</span>
              </span>
              <ChevronRight aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.phoneQueueNote}>{t('moderation.queue.note')}</p>
    </section>
  );
}
