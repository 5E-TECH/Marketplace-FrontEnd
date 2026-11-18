import { Button } from 'antd';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../../shared/lib/phone';
import { AuthNotice } from '../../../shared/ui/AuthLayout/AuthNotice';
import styles from '../../../shared/ui/AuthLayout/authForm.module.css';
import { pendingLoading } from '../lib/fieldRules';
import { formatCountdown, useCountdown } from '../lib/useCountdown';

interface OtpBlockedPanelProps {
  title: string;
  text: string;
  phone: string;
  blockedUntil: number | null;
  sending: boolean;
  onRequestNew: () => void;
}

/** 3 marta xato kod — 15 daqiqa blok: «Qayta urinishgacha 12:40», tugma vaqt tugagach ochiladi. */
export function OtpBlockedPanel({ title, text, phone, blockedUntil, sending, onRequestNew }: OtpBlockedPanelProps) {
  const { t } = useTranslation();
  const left = useCountdown(blockedUntil);
  return (
    <>
      <AuthNotice tone="danger" title={title} text={text} />
      <div className={styles.timerBox}>
        <span className={styles.timerLabel}>{t('otp.retryIn')}</span>
        <span
          role="timer"
          className={styles.timerValue}
          aria-label={t('otp.retryInAria', { minutes: Math.floor(left / 60), seconds: left % 60 })}
        >
          {formatCountdown(left)}
        </span>
        <span className={styles.timerPhone}>{formatUzPhone(phone)}</span>
      </div>
      <div className={styles.actions}>
        <Button className={styles.submit} type="primary" block disabled={left > 0} loading={pendingLoading(sending)} onClick={onRequestNew}>
          {t('otp.newCode')}
        </Button>
        {left > 0 ? <p className={styles.caption}>{t('otp.unlockHint')}</p> : null}
      </div>
    </>
  );
}
