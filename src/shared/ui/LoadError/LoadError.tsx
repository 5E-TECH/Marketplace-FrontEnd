import { CircleAlert, CircleX, Hand, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getApiRequestId, getRetryAfterSeconds } from '../../api/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import { tashkentClock } from '../../lib/tashkentTime';
import { CopyButton } from '../CopyButton/CopyButton';
import styles from './LoadError.module.css';

const AUTO_RETRY_SECONDS = 60;

interface LoadErrorProps {
  error: unknown;
  onRetry: () => void;
  /** Ekranda qolgan ma'lumotning vaqti (`dataUpdatedAt`); bo'lmasa 0. Faqat sahifa xatosida ko'rinadi. */
  lastSuccessAt?: number;
  /**
   * `block` — karta ichidagi bitta blok (umumiy-xato-yuklanish asosiy ko'rinish: markazda, och fon);
   * `page` — sahifaning asosiy ma'lumoti ochilmadi (holatlar «Server xatosi (500)»: oq karta, chapda);
   * `row` — ro'yxat yoki jadval ichidagi qator (komponentlar-E §30: ikonka, matn, o'ngda tugma).
   */
  variant?: 'block' | 'page' | 'row';
  /** `row`: sarlavha («Offerlarni yuklab bo‘lmadi») va matn oxiri («Sahifalaringiz ishlashda davom etadi.»). */
  title?: string;
  note?: string;
}

/**
 * Yuklanmadi (umumiy-xato-yuklanish): nima bo'ldi — oddiy o'zbekcha, bitta keyingi qadam;
 * 60 soniyada o'zi qayta urinadi; «Xato raqami» — backend `requestId`.
 * 429 — kutish vaqti tugaguncha «Qayta urinish · 12» (holatlar «429»).
 */
export function LoadError({ error, onRetry, lastSuccessAt = 0, variant = 'block', title, note }: LoadErrorProps) {
  const { t } = useTranslation();
  const retryAfter = getRetryAfterSeconds(error);
  const requestId = getApiRequestId(error);
  const [deadline] = useState(() => Date.now() + (retryAfter ?? AUTO_RETRY_SECONDS) * 1000);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Avtomatik qayta urinish: 60 s (yoki server aytgan kutish vaqti) o'tganda bir marta.
  useEffect(() => {
    if (secondsLeft === 0) onRetry();
  }, [secondsLeft, onRetry]);

  if (retryAfter !== null) {
    const waiting = secondsLeft > 0;
    return (
      <section className={styles.rate} role="alert" data-testid="load-error">
        <span className={`${styles.badge} ${styles.badgeWarning}`} aria-hidden><Hand /></span>
        <span className={styles.rateBody}>
          <span className={styles.rateTitle}>{t('loadError.rateTitle')}</span>
          <span className={styles.rateText}>{t('loadError.rateText', { seconds: retryAfter })}</span>
        </span>
        <button type="button" className={`${styles.button} ${styles.small}`} onClick={onRetry} disabled={waiting}>
          <RefreshCw aria-hidden />
          {waiting ? t('loadError.rateRetryIn', { seconds: secondsLeft }) : t('loadError.retry')}
        </button>
      </section>
    );
  }

  const code = requestId ? (
    <span className={styles.code}>
      {t('loadError.code', { code: requestId })}
      <CopyButton text={requestId} size="sm" ariaLabel={t('loadError.copyCode')} successMessage={t('loadError.copied')} />
    </span>
  ) : null;

  if (variant === 'row') {
    return (
      <section className={`${styles.rate} ${styles.row}`} role="alert" data-testid="load-error">
        <span className={styles.badge} aria-hidden><CircleX /></span>
        <span className={styles.rateBody}>
          <span className={styles.rateTitle}>{title ?? t('loadError.title')}</span>
          <span className={styles.rateText}>
            {[t('loadError.rowText'), requestId ? `${t('loadError.code', { code: requestId })}.` : null, note].filter(Boolean).join(' ')}
          </span>
        </span>
        <button type="button" className={`${styles.button} ${styles.small}`} onClick={onRetry}>
          <RefreshCw aria-hidden />
          {t('loadError.retry')}
        </button>
      </section>
    );
  }

  if (variant === 'page') {
    return (
      <section className={styles.page} role="alert" data-testid="load-error">
        <div className={styles.pageBody}>
          <span className={`${styles.badge} ${styles.badgeLarge}`} aria-hidden><CircleAlert /></span>
          <h2 className={styles.pageTitle}>{t('loadError.title')}</h2>
          <p className={styles.text}>{t('loadError.text')}</p>
          <div className={styles.pageActions}>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onRetry}>
              <RefreshCw aria-hidden />
              {t('loadError.retry')}
            </button>
            <span className={styles.meta}>
              {t('loadError.autoRetry')}
              {lastSuccessAt ? (
                <>
                  {' · '}
                  {t('loadError.lastSuccessLabel')} <strong>{tashkentClock(lastSuccessAt)}</strong>
                </>
              ) : null}
            </span>
            {code}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.block} role="alert" data-testid="load-error">
      <span className={`${styles.badge} ${styles.badgeLarge}`} aria-hidden><CircleX /></span>
      <h2 className={styles.blockTitle}>{t('loadError.title')}</h2>
      <p className={`${styles.text} ${styles.blockText}`}>{t('loadError.blockText')}</p>
      <div className={styles.blockActions}>
        <button type="button" className={styles.button} onClick={onRetry}>
          <RefreshCw aria-hidden />
          {t('loadError.retry')}
        </button>
        {code}
      </div>
    </section>
  );
}
