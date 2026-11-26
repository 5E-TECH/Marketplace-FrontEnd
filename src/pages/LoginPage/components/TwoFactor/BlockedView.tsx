import { Button } from 'antd';
import { CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { formatCountdown } from '../../../../features/sellerAuth/lib/useCountdown';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import authStyles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import { identityLine } from '../../model/twoFactorView';

/**
 * «Kirish vaqtincha yopildi» (umumiy-2fa.holatlar 2): 3 xato koddan keyin 15 daqiqa — taymer, yopiq «Tasdiqlash».
 * Kod kiritishda ham, ilovani ulashda ham (BE-26: bitta hisob).
 */
export function BlockedView({ challenge, identity, secondsLeft }: { challenge: TwoFactorChallenge; identity: ReactNode; secondsLeft: number }) {
  const { t } = useTranslation();
  return (
    <div className={authStyles.form} data-testid="tfa-blocked">
      {identity}
      <h1 id="tfa-title" className={authStyles.title}>{t('tfa.blockedTitle')}</h1>
      <AuthNotice tone="danger" icon={<CircleX aria-hidden />} title={t('tfa.blockedNotice')} text={t('tfa.blockedText')} />
      <div className={authStyles.timerBox}>
        <span className={authStyles.timerLabel}>{t('tfa.retryIn')}</span>
        <span role="timer" className={authStyles.timerValue} aria-label={t('tfa.retryInAria', { minutes: Math.floor(secondsLeft / 60), seconds: secondsLeft % 60 })}>
          {formatCountdown(secondsLeft)}
        </span>
        <span className={authStyles.timerPhone}>{identityLine(challenge, t)}</span>
      </div>
      <div className={authStyles.actions}>
        <Button className={authStyles.submit} type="primary" block disabled>{t('tfa.confirm')}</Button>
        <p className={authStyles.caption}>{t('tfa.unlockHint')}</p>
      </div>
    </div>
  );
}
