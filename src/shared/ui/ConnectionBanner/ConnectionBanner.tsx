import { CloudOff, RefreshCw, ScanLine, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { refetchFailingLiveQueries, useLiveSummary } from '../../api/liveQuery';
import { useTranslation } from '../../i18n/useTranslation';
import { tashkentClock } from '../../lib/tashkentTime';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import styles from './ConnectionBanner.module.css';

const RESTORED_VISIBLE_MS = 4_000;

interface ConnectionBannerProps {
  /**
   * Ombor skan sahifalari (umumiy-aloqa-uzildi «Ombor — skan navbati»): navbat yuborilmayotgan bo'lsa — internet banneri
   * o'rniga «3 ta skan yuborilmadi»; navbat yuborilgach 4 soniya «Navbatdagi 3 ta skan yuborildi».
   */
  scanQueue?: { queued: number; stalled: boolean; flushed: { count: number; at: number } | null };
}

/**
 * Yuqori qator ostidagi banner (umumiy-aloqa-uzildi, komponentlar-E §28):
 *  - internet yo'q — «… 14:37 dan beri»;
 *  - aloqa tiklandi — 4 soniyada o'zi yopiladi (ma'lumotni TanStack o'zi qayta so'raydi);
 *  - internet bor, lekin jonli so'rovlar yiqilyapti — «Oxirgi yangilanish» va «Yangilash».
 */
export function ConnectionBanner({ scanQueue }: ConnectionBannerProps = {}) {
  const { t } = useTranslation();
  const { online, changedAt, restoredAt } = useOnlineStatus();
  const live = useLiveSummary();
  // «Aloqa tiklandi» 4 soniya ko'rinadi: muddat tugaganda bir marta qayta chiziladi.
  const [hiddenRestoredAt, setHiddenRestoredAt] = useState<number | null>(null);
  useEffect(() => {
    if (!restoredAt) return undefined;
    const left = restoredAt + RESTORED_VISIBLE_MS - Date.now();
    const timer = window.setTimeout(() => setHiddenRestoredAt(restoredAt), Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [restoredAt]);
  const showRestored = online && restoredAt !== null && hiddenRestoredAt !== restoredAt;
  const flushedAt = scanQueue?.flushed?.at ?? null;
  const [hiddenFlushedAt, setHiddenFlushedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!flushedAt) return undefined;
    const timer = window.setTimeout(() => setHiddenFlushedAt(flushedAt), Math.max(0, flushedAt + RESTORED_VISIBLE_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [flushedAt]);

  if (scanQueue?.queued && scanQueue.stalled) {
    return (
      <div className={styles.banner} data-tone="warning" role="alert" data-testid="connection-banner" data-state="scan-queue">
        <ScanLine aria-hidden />
        <p><strong>{t('wh.queue.title', { count: scanQueue.queued })}</strong> {t('wh.queue.text')}</p>
        <span className={styles.meta}>{t('wh.queue.meta', { count: scanQueue.queued })}</span>
      </div>
    );
  }

  if (online && scanQueue?.flushed && flushedAt !== hiddenFlushedAt) {
    return (
      <div className={styles.banner} data-tone="success" role="status" data-testid="connection-banner" data-state="scan-queue-sent">
        <Wifi aria-hidden />
        <p><strong>{t('connection.restoredTitle')}</strong> {t('wh.queue.flushed', { count: scanQueue.flushed.count })}</p>
        <span className={styles.meta}>{tashkentClock(scanQueue.flushed.at)}</span>
      </div>
    );
  }

  if (!online) {
    return (
      <div className={styles.banner} data-tone="danger" role="alert" data-testid="connection-banner" data-state="offline">
        <WifiOff aria-hidden />
        <p><strong>{t('connection.offlineTitle')}</strong> {t('connection.offline')}</p>
        <span className={styles.meta}>{t('connection.since', { time: tashkentClock(changedAt) })}</span>
      </div>
    );
  }

  if (live.failing) {
    return (
      <div className={styles.banner} data-tone="warning" role="status" data-testid="connection-banner" data-state="live-stopped">
        <CloudOff aria-hidden />
        <p><strong>{t('connection.liveStoppedTitle')}</strong> {t('connection.liveStopped')}</p>
        <span className={styles.meta}>{t('connection.lastUpdated', { time: tashkentClock(live.lastSuccessAt) })}</span>
        <button type="button" className={styles.refresh} onClick={refetchFailingLiveQueries}>
          <RefreshCw aria-hidden />
          {t('connection.refresh')}
        </button>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className={styles.banner} data-tone="success" role="status" data-testid="connection-banner" data-state="restored">
        <Wifi aria-hidden />
        <p><strong>{t('connection.restoredTitle')}</strong> {t('connection.restored')}</p>
        <span className={styles.meta}>{tashkentClock(restoredAt)}</span>
      </div>
    );
  }

  return null;
}

interface LiveStampProps {
  updatedAt: number;
  /** Oxirgi so'rov muvaffaqiyatli va internet bor. */
  live: boolean;
}

/** Chap slotdagi belgi: «Real vaqtda yangilanadi» yoki «Oxirgi yangilanish: 14:37». */
export function LiveStamp({ updatedAt, live }: LiveStampProps) {
  const { t } = useTranslation();
  const { online } = useOnlineStatus();
  return (
    <span className={styles.stamp} data-live={live && online}>
      {live && online ? t('live.realtime') : t('connection.lastUpdated', { time: updatedAt ? tashkentClock(updatedAt) : '—' })}
    </span>
  );
}
