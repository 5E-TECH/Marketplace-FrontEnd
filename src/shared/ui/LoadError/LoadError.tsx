import { App, Button } from 'antd';
import { CircleAlert, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getApiRequestId, getRetryAfterSeconds } from '../../api/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import { tashkentClock } from '../../lib/tashkentTime';
import styles from './LoadError.module.css';

const AUTO_RETRY_SECONDS = 60;

interface LoadErrorProps {
  error: unknown;
  onRetry: () => void;
  /** Ekranda qolgan ma'lumotning vaqti (`dataUpdatedAt`); bo'lmasa 0. */
  lastSuccessAt?: number;
}

/**
 * Bitta blok yuklanmadi (umumiy-xato-yuklanish §1): nima bo'ldi — oddiy o'zbekcha,
 * bitta keyingi qadam; 60 soniyada o'zi qayta urinadi; «Xato raqami» — backend `requestId`.
 * 429 — kutish vaqti tugaguncha «Qayta urinish · 12» (§4).
 */
export function LoadError({ error, onRetry, lastSuccessAt = 0 }: LoadErrorProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
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

  const copyCode = () => {
    if (!requestId) return;
    navigator.clipboard.writeText(requestId).then(
      () => void message.success(t('loadError.copied')),
      () => undefined,
    );
  };

  const rateLimited = retryAfter !== null;
  return (
    <section className={styles.panel} role="alert" data-testid="load-error">
      <CircleAlert className={styles.icon} aria-hidden />
      <div className={styles.body}>
        <h2 className={styles.title}>{rateLimited ? t('loadError.rateTitle') : t('loadError.title')}</h2>
        <p className={styles.text}>{rateLimited ? t('loadError.rateText', { seconds: retryAfter }) : t('loadError.text')}</p>
        <div className={styles.actions}>
          <Button onClick={onRetry} disabled={rateLimited && secondsLeft > 0}>
            {rateLimited && secondsLeft > 0 ? t('loadError.rateRetryIn', { seconds: secondsLeft }) : t('loadError.retry')}
          </Button>
          {!rateLimited ? (
            <span className={styles.meta}>
              {t('loadError.autoRetry')}
              {lastSuccessAt ? ` · ${t('loadError.lastSuccess', { time: tashkentClock(lastSuccessAt) })}` : null}
            </span>
          ) : null}
        </div>
        {requestId ? (
          <p className={styles.code}>
            {t('loadError.code', { code: requestId })}
            <button type="button" className={styles.copy} aria-label={t('loadError.copyCode')} onClick={copyCode}>
              <Copy aria-hidden />
            </button>
          </p>
        ) : null}
      </div>
    </section>
  );
}
