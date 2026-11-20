import { App, Button, Form } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTokenSignInMutation } from '../../../../features/auth/api/useLoginMutation';
import { loginWithOtp } from '../../../../features/sellerAuth/api/sellerAuthApi';
import { otpCodeDigits, pendingLoading } from '../../../../features/sellerAuth/lib/fieldRules';
import { useCountdown } from '../../../../features/sellerAuth/lib/useCountdown';
import { useOtpFlow, type OtpFlowState } from '../../../../features/sellerAuth/lib/useOtpFlow';
import { OtpBlockedPanel } from '../../../../features/sellerAuth/ui/OtpBlockedPanel';
import { OtpCodeField } from '../../../../features/sellerAuth/ui/OtpCodeField';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { getUzLocalPhone } from '../../../../shared/lib/phone';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import { PhoneInput } from '../../../../shared/ui/PhoneInput/PhoneInput';
import styles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import { uzPhoneRules } from '../../../../shared/lib/phoneRules';

interface SellerLoginValues {
  phone: string;
  code?: string;
}

interface SellerLoginFormProps {
  /** «Kim sifatida kirasiz» tanlovi — sarlavha ostida. */
  roleSwitch: ReactNode;
  /** Ro'yxat sahifasidan kelgan raqam («Bu raqam bilan hisob bor» → «Kirishga o‘tish»). */
  initialPhone?: string;
}

const PHONE_ID = 'seller-login-phone';
const CODE_ID = 'seller-login-code';

/** Sotuvchi va optovik: telefon va SMS kod (umumiy-kirish §1; SOT-1, BE-06). */
export function SellerLoginForm({ roleSwitch, initialPhone }: SellerLoginFormProps) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm<SellerLoginValues>();
  const flow = useOtpFlow('LOGIN');
  const { state } = flow;
  const signIn = useTokenSignInMutation(({ phone, code }: { phone: string; code: string }) => loginWithOtp(`+998${phone}`, code));
  const secondsLeft = useCountdown(state.phase === 'code' ? state.expiresAt : null);
  const expired = state.phase === 'code' && (secondsLeft === 0 || state.codeError?.kind === 'expired');

  const requestCode = (phone: string, resend = false) => {
    form.setFieldValue('code', undefined);
    void flow.requestCode(phone, { resend });
  };

  const handleFinish = (values: SellerLoginValues) => {
    if (state.phase === 'phone') {
      requestCode(values.phone);
      return;
    }
    signIn.mutate(
      { phone: state.phone, code: otpCodeDigits(values.code) },
      {
        onSuccess: () => void message.success(t('auth.loginSuccess')),
        onError: (error) => {
          flow.handleVerifyError(error);
        },
      },
    );
  };

  const codeError = expired
    ? t('otp.expired')
    : state.codeError?.kind === 'invalid'
      ? t('otp.invalidLogin', { count: state.codeError.attemptsLeft })
      : null;

  const footer = (
    <div className={styles.footer}>
      <p>
        {t('sellerLogin.notSeller')}{' '}
        <Link className={styles.link} to="/register">{t('sellerLogin.register')}</Link>
      </p>
    </div>
  );

  return (
    <Form<SellerLoginValues>
      form={form}
      className={styles.form}
      layout="vertical"
      requiredMark={false}
      initialValues={{ phone: initialPhone ? getUzLocalPhone(initialPhone) : undefined }}
      onFinish={handleFinish}
      onValuesChange={flow.clearErrors}
      size="large"
      aria-labelledby="login-title"
    >
      <h1 id="login-title" className={styles.title}>{t('login.title')}</h1>
      {roleSwitch}

      {state.phase === 'blocked' ? (
        <>
          <OtpBlockedPanel
            title={t('otp.blockedLoginTitle')}
            text={t('otp.blockedLoginText')}
            phone={state.phone}
            blockedUntil={state.blockedUntil}
            sending={flow.sending}
            onRequestNew={() => requestCode(state.phone)}
          />
          {footer}
        </>
      ) : (
        <>
          {state.phase === 'code' && state.delayed ? (
            <AuthNotice tone="warning" title={t('otp.delayedTitle')} text={t('otp.delayedText')} />
          ) : null}
          {state.notice?.kind === 'resent' ? (
            <AuthNotice tone="success" title={t('otp.resentTitle')} text={t('otp.resentText')} />
          ) : null}

          <div>
            <div className={styles.fieldHead}>
              <label htmlFor={PHONE_ID} className={styles.fieldLabel}>{t('auth.phone')}</label>
              {state.phase === 'code' ? (
                <button type="button" className={styles.linkButton} onClick={flow.editPhone}>{t('otp.change')}</button>
              ) : null}
            </div>
            <Form.Item
              className={styles.field}
              name="phone"
              rules={state.phase === 'phone' ? uzPhoneRules(t) : []}
              validateTrigger={['onBlur', 'onSubmit']}
              validateStatus={state.phoneError ? 'error' : undefined}
              help={state.phoneError ? t('phone.operator') : undefined}
              extra={state.phase === 'code' ? t('otp.sentTo') : t('sellerLogin.phoneHint')}
            >
              <PhoneInput size="large" id={PHONE_ID} readOnly={state.phase === 'code'} autoFocus={state.phase === 'phone'} />
            </Form.Item>
          </div>

          {state.phase === 'code' ? (
            <div>
              <OtpCodeField id={CODE_ID} secondsLeft={secondsLeft} error={codeError} autoFocus />
              {expired ? null : (
                <p className={styles.fieldHint}>
                  {state.delayed ? (
                    t('otp.resending')
                  ) : (
                    <>
                      {t('otp.notReceived')}{' '}
                      <button type="button" className={styles.linkButton} disabled={flow.sending} onClick={() => requestCode(state.phone, true)}>
                        {t('otp.resend')}
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          ) : null}

          <PhoneNotice state={state} />

          {expired ? (
            // Kod maydoni tekshirilmaydi — yangi kod so'raladi.
            <Button className={styles.submit} type="primary" block loading={pendingLoading(flow.sending)} onClick={() => requestCode(state.phone, true)}>
              {t('otp.newCode')}
            </Button>
          ) : (
            <Button className={styles.submit} type="primary" htmlType="submit" block loading={pendingLoading(flow.sending || signIn.isPending)}>
              {submitLabel(state, t)}
            </Button>
          )}

          {state.notice?.kind === 'notFound' ? null : footer}
        </>
      )}
    </Form>
  );
}

function submitLabel(state: OtpFlowState, t: ReturnType<typeof useTranslation>['t']): string {
  if (state.phase === 'code') return t('auth.login');
  return state.notice?.kind === 'sendFailed' ? t('otp.retry') : t('otp.getCode');
}

function PhoneNotice({ state }: { state: OtpFlowState }) {
  const { t } = useTranslation();
  switch (state.notice?.kind) {
    case 'notFound':
      return (
        <AuthNotice tone="info" title={t('sellerLogin.notFoundTitle')} text={t('sellerLogin.notFoundText')}>
          <Link className={styles.link} to="/register">{t('sellerLogin.register')}</Link>
        </AuthNotice>
      );
    case 'sendFailed':
      return <AuthNotice tone="danger" title={t('login.serverTitle')} text={t('sellerLogin.serverText')} />;
    case 'error':
      return <AuthNotice tone="danger" title={t('login.failedTitle')} text={state.notice.message} />;
    default:
      return null;
  }
}
