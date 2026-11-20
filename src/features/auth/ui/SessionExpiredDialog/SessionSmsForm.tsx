import { Form } from 'antd';
import { useState } from 'react';
import { loginWithOtp } from '../../../sellerAuth/api/sellerAuthApi';
import { otpCodeDigits } from '../../../sellerAuth/lib/fieldRules';
import { useCountdown } from '../../../sellerAuth/lib/useCountdown';
import { useOtpFlow } from '../../../sellerAuth/lib/useOtpFlow';
import { OtpBlockedPanel } from '../../../sellerAuth/ui/OtpBlockedPanel';
import { OtpCodeField } from '../../../sellerAuth/ui/OtpCodeField';
import { formatUzPhone, getUzLocalPhone } from '../../../../shared/lib/phone';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import authStyles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import { openSession } from '../../api/authApi';
import type { AuthSession } from '../../model/authTypes';
import { SessionActions, SessionPrimary } from './SessionActions';
import styles from './SessionExpiredDialog.module.css';

interface SessionSmsFormProps {
  phone: string;
  onSignedIn: (session: AuthSession) => void;
  onSignOut: () => void;
}

/**
 * Sotuvchi va optovik sessiyasi tugadi — joyida SMS kod bilan qayta kirish (umumiy-sessiya holatlar 1; FE-04;
 * xodimlar — parol). Kod qoidalari kirish sahifasidagidek: 5 daqiqa, 3 xato — 15 daqiqa.
 * Kod o'zi yuborilmaydi — foydalanuvchi qaytganda «Kod olish» ni bosadi (SMS behuda ketmasin).
 */
export function SessionSmsForm({ phone, onSignedIn, onSignOut }: SessionSmsFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ code?: string }>();
  const local = getUzLocalPhone(phone);
  const flow = useOtpFlow('LOGIN');
  const { state } = flow;
  const secondsLeft = useCountdown(state.phase === 'code' ? state.expiresAt : null);
  const expired = state.phase === 'code' && (secondsLeft === 0 || state.codeError?.kind === 'expired');
  const [verifying, setVerifying] = useState(false);

  const requestCode = (resend = false) => {
    form.setFieldValue('code', undefined);
    void flow.requestCode(local, { resend });
  };

  const verify = async ({ code }: { code?: string }) => {
    setVerifying(true);
    try {
      onSignedIn(await openSession(await loginWithOtp(`+998${local}`, otpCodeDigits(code))));
    } catch (error) {
      flow.handleVerifyError(error);
    } finally {
      setVerifying(false);
    }
  };

  if (state.phase === 'blocked') {
    return (
      <div className={styles.form}>
        <OtpBlockedPanel
          title={t('otp.blockedLoginTitle')}
          text={t('otp.blockedLoginText')}
          phone={local}
          blockedUntil={state.blockedUntil}
          sending={flow.sending}
          onRequestNew={() => requestCode()}
        />
        <SessionActions onSignOut={onSignOut} />
      </div>
    );
  }

  const sentText = state.phase === 'code' ? 'session.smsSent' : 'session.smsWillSend';
  const [before, after] = t(sentText, { phone: '\u0000' }).split('\u0000');

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void verify(values)} onValuesChange={flow.clearErrors} className={styles.form}>
      <p className={styles.sentTo}>
        {before}<strong>{formatUzPhone(phone)}</strong>{after}
      </p>
      {state.phase === 'code' ? (
        <div>
          <OtpCodeField
            id="session-sms-code"
            secondsLeft={secondsLeft}
            autoFocus
            error={expired ? t('otp.expired') : state.codeError?.kind === 'invalid' ? t('otp.invalidLogin', { count: state.codeError.attemptsLeft }) : null}
          />
          {expired ? null : (
            <p className={authStyles.fieldHint}>
              {state.delayed ? (
                t('otp.resending')
              ) : (
                <>
                  {t('otp.notReceived')}{' '}
                  <button type="button" className={authStyles.linkButton} disabled={flow.sending} onClick={() => requestCode(true)}>
                    {t('otp.resend')}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      ) : null}
      {state.phase === 'code' && state.delayed ? <AuthNotice tone="warning" title={t('otp.delayedTitle')} text={t('otp.delayedText')} /> : null}
      {state.notice?.kind === 'sendFailed' ? <AuthNotice tone="danger" title={t('otp.sendFailedTitle')} text={t('otp.sendFailedText')} /> : null}
      {state.notice?.kind === 'error' ? <AuthNotice tone="danger" title={t('login.failedTitle')} text={state.notice.message} /> : null}
      {state.notice?.kind === 'notFound' ? <AuthNotice tone="danger" title={t('sellerLogin.notFoundTitle')} /> : null}
      <SessionActions onSignOut={onSignOut}>
        {state.phase === 'code' && !expired ? (
          <SessionPrimary submit busy={verifying}>{t('session.signIn')}</SessionPrimary>
        ) : (
          <SessionPrimary busy={flow.sending} onClick={() => requestCode(state.phase === 'code')}>
            {state.phase === 'code' ? t('otp.newCode') : t('otp.getCode')}
          </SessionPrimary>
        )}
      </SessionActions>
    </Form>
  );
}
