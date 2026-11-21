import { useTranslation } from '../../../shared/i18n/useTranslation';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { tashkentClock, tashkentDate, tashkentDay } from '../../../shared/lib/tashkentTime';
import { useNow } from '../../../shared/lib/useNow';
import { useScannerPresence } from '../lib/scannerPresence';
import styles from './WarehouseTopStatus.module.css';

/** «● Skaner: tayyor» — sahifada skan maydoni bo'lsa. Telefonda skan kartasi sarlavhasida. */
export function ScannerStatus() {
  const { t } = useTranslation();
  const { fields, focused } = useScannerPresence();
  if (!fields) return null;
  return (
    <span className={styles.scanner} data-ready={focused} data-testid="scanner-status" role="status">
      <span className={styles.dot} aria-hidden />
      {t('wh.scanner')}: <strong>{t(focused ? 'wh.scannerReady' : 'wh.scannerFocus')}</strong>
    </span>
  );
}

/** Omborchi yuqori qatori (karkas-E 1.7, 5.5): skaner holati va 1024 px dan Toshkent vaqti. */
export function WarehouseTopStatus() {
  const { t } = useTranslation();
  const now = useNow();
  const weekday = new Date(`${tashkentDate(now)}T00:00:00Z`).getUTCDay();
  return (
    <div className={styles.status}>
      <ScannerStatus />
      <time className={styles.clock} dateTime={new Date(now).toISOString()} title={`${tashkentDay(now)}, ${t(`sellerHome.weekday${weekday}` as TranslationKey)}`}>
        <strong>{tashkentClock(now)}</strong> {t('operator.clock')}
      </time>
    </div>
  );
}
