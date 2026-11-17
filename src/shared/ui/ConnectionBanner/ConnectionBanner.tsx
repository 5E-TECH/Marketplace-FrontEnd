import { Button } from 'antd';
import { CircleCheck, RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { refetchFailingLiveQueries, useLiveSummary } from '../../api/liveQuery';
import { useTranslation } from '../../i18n/useTranslation';
import { tashkentClock } from '../../lib/tashkentTime';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import styles from './ConnectionBanner.module.css';

const RESTORED_VISIBLE_MS = 4_000;

/**
 * Yuqori qator ostidagi banner (umumiy-aloqa-uzildi, komponentlar-E §28):
 *  - internet yo'q — «… 14:37 dan beri»;
 *  - aloqa tiklandi — 4 soniyada o'zi yopiladi (ma'lumotni TanStack o'zi qayta so'raydi);
 *  - internet bor, lekin jonli so'rovlar yiqilyapti — «Oxirgi yangilanish» va «Yangilash».
 */
export function ConnectionBanner() {
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

  if (!online) {
    return (
      <div className={styles.warning} role="status" data-testid="connection-banner" data-state="offline">
        <WifiOff aria-hidden />
        <p>{t('connection.offline')}</p>
        <span className={styles.meta}>{t('connection.since', { time: tashkentClock(changedAt) })}</span>
      </div>
    );
  }

  if (live.failing) {
    return (
      <div className={styles.warning} role="status" data-testid="connection-banner" data-state="live-stopped">
        <RefreshCw aria-hidden />
        <p>
          {t('connection.liveStopped')}{' '}
          <span className={styles.meta}>{t('connection.lastUpdated', { time: tashkentClock(live.lastSuccessAt) })}</span>
        </p>
        <Button size="small" onClick={refetchFailingLiveQueries}>{t('connection.refresh')}</Button>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className={styles.success} role="status" data-testid="connection-banner" data-state="restored">
        <CircleCheck aria-hidden />
        <p>{t('connection.restored')}</p>
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
