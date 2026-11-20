import { App, Button, Form } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { verifyRegisterOtp } from '../../features/sellerAuth/api/sellerAuthApi';
import { otpCodeDigits, pendingLoading } from '../../features/sellerAuth/lib/fieldRules';
import { useCountdown } from '../../features/sellerAuth/lib/useCountdown';
import { useOtpFlow } from '../../features/sellerAuth/lib/useOtpFlow';
import { OtpBlockedPanel } from '../../features/sellerAuth/ui/OtpBlockedPanel';
import { OtpCodeField } from '../../features/sellerAuth/ui/OtpCodeField';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../shared/lib/phone';
import { AuthLayout } from '../../shared/ui/AuthLayout/AuthLayout';
import { AuthNotice } from '../../shared/ui/AuthLayout/AuthNotice';
import { PhoneInput } from '../../shared/ui/PhoneInput/PhoneInput';
import formStyles from '../../shared/ui/AuthLayout/authForm.module.css';
import { ChangePhoneModal } from './components/ChangePhoneModal';
import { OfferStep } from './components/OfferStep';
import { RegisterBenefits } from './components/RegisterBenefits';
import { RegisterSteps } from './components/RegisterSteps';
import styles from './RegisterPage.module.css';
import { uzPhoneRules } from '../../shared/lib/phoneRules';

interface OtpValues {
  phone: string;
  code?: string;
}

const PHONE_ID = 'register-phone';
const CODE_ID = 'register-code';

/**
 * Sotuvchi ro'yxati (sotuvchi-royxat; SOT-1, BE-06): telefon → SMS kod → oferta va rozilik.
 * Ism so'ralmaydi — Profilda kiritiladi. Hisob ochilgach sessiya darhol ochiladi va
 * `PublicOnlyRoute` sotuvchini bosh sahifaga olib o'tadi.
 */
export default function RegisterPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<OtpValues>();
  const flow = useOtpFlow('REGISTER');
  const { state } = flow;
  const [registration, setRegistration] = useState<{ token: string; phone: string } | null>(null);
  const [changingPhone, setChangingPhone] = useState(false);
  const verify = useMutation({ mutationFn: ({ phone, code }: { phone: string; code: string }) => verifyRegisterOtp(`+998${phone}`, code) });
  const secondsLeft = useCountdown(state.phase === 'code' && !registration ? state.expiresAt : null);
  const expired = state.phase === 'code' && (secondsLeft === 0 || state.codeError?.kind === 'expired');
  const step = registration ? 3 : state.phase === 'phone' ? 1 : 2;

  const requestCode = (phone: string, resend = false) => {
    form.setFieldValue('code', undefined);
    void flow.requestCode(phone, { resend });
  };

  const handleFinish = (values: OtpValues) => {
    if (state.phase === 'phone') {
      requestCode(values.phone);
      return;
    }
    verify.mutate(
      { phone: state.phone, code: otpCodeDigits(values.code) },
      {
        onSuccess: ({ registrationToken }) => setRegistration({ token: registrationToken, phone: state.phone }),
        onError: (error) => {
          flow.handleVerifyError(error);
        },
      },
    );
  };

  /** Oferta qadamida token eskirdi — telefon bosqichidan qayta. */
  const restart = () => {
    void message.warning(t('register.expired'));
    setRegistration(null);
    flow.editPhone();
  };

  const enterOtherNumber = () => {
    flow.editPhone();
    form.setFieldValue('phone', '');
    window.requestAnimationFrame(() => document.getElementById(PHONE_ID)?.focus());
  };

  return (
    <AuthLayout renderAside={(tone, brand) => <RegisterBenefits tone={tone} brand={brand} />}>
      <div className={styles.column}>
        <RegisterSteps current={step} />
        {registration ? (
          <OfferStep registrationToken={registration.token} onExpired={restart} />
        ) : (
          <Form<OtpValues>
            form={form}
            className={formStyles.form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleFinish}
            onValuesChange={flow.clearErrors}
            size="large"
            aria-labelledby="register-title"
          >
            {state.phase === 'blocked' ? (
              <>
                <div className={formStyles.lead}>
                  <h1 id="register-title" className={formStyles.title}>{t('otp.blockedRegisterTitle')}</h1>
                  <p>{t('otp.blockedRegisterText')}</p>
                </div>
                <OtpBlockedPanel
                  title={t('otp.blockedLoginTitle')}
                  text={t('otp.blockedRegisterNote')}
                  phone={state.phone}
                  blockedUntil={state.blockedUntil}
                  sending={flow.sending}
                  onRequestNew={() => requestCode(state.phone)}
                />
              </>
            ) : state.phase === 'phone' ? (
              <>
                <div className={formStyles.lead}>
                  <h1 id="register-title" className={formStyles.title}>{t('register.pageTitle')}</h1>
                  <p>{t('register.lead')}</p>
                </div>
                <div>
                  <div className={formStyles.fieldHead}>
                    <label htmlFor={PHONE_ID} className={formStyles.fieldLabel}>{t('auth.phone')}</label>
                  </div>
                  <Form.Item
                    className={formStyles.field}
                    name="phone"
                    rules={uzPhoneRules(t)}
                    validateTrigger={['onBlur', 'onSubmit']}
                    validateStatus={state.phoneError ? 'error' : undefined}
                    help={state.phoneError ? t('phone.operator') : undefined}
                    extra={state.notice?.kind === 'exists' || state.notice?.kind === 'sendFailed' ? undefined : t('register.phoneHint')}
                  >
                    <PhoneInput size="large" id={PHONE_ID} autoFocus />
                  </Form.Item>
                </div>

                {state.notice?.kind === 'exists' ? (
                  <>
                    <AuthNotice
                      tone="info"
                      title={t('register.existsTitle')}
                      text={t('register.existsText', { phone: formatUzPhone(state.notice.phone) })}
                    />
                    <div className={formStyles.actions}>
                      <Button className={formStyles.submit} type="primary" block onClick={() => void navigate('/login', { state: { phone: state.phone } })}>
                        {t('register.toLogin')}
                      </Button>
                      <Button className={formStyles.secondary} block onClick={enterOtherNumber}>{t('register.otherNumber')}</Button>
                    </div>
                  </>
                ) : (
                  <>
                    {state.notice?.kind === 'sendFailed' ? (
                      <AuthNotice tone="danger" title={t('otp.sendFailedTitle')} text={t('otp.sendFailedText')} />
                    ) : null}
                    {state.notice?.kind === 'error' ? (
                      <AuthNotice tone="danger" title={t('otp.sendFailedTitle')} text={state.notice.message} />
                    ) : null}
                    <div className={formStyles.actions}>
                      <Button className={formStyles.submit} type="primary" htmlType="submit" block loading={pendingLoading(flow.sending)}>
                        {flow.sending ? t('otp.sending') : state.notice?.kind === 'sendFailed' ? t('otp.retry') : t('otp.getCode')}
                      </Button>
                      {flow.sending || state.notice ? null : <p className={formStyles.caption}>{t('otp.rules')}</p>}
                    </div>
                    {flow.sending ? null : (
                      <div className={formStyles.footer}>
                        <p>
                          {t('register.haveAccount')} <Link className={formStyles.link} to="/login">{t('register.login')}</Link>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className={formStyles.lead}>
                  <h1 id="register-title" className={formStyles.title}>{t('register.codeTitle')}</h1>
                  <p>
                    <SentTo phone={state.phone} />{' '}
                    <button type="button" className={formStyles.linkButton} onClick={() => setChangingPhone(true)}>
                      {t('register.changeNumber')}
                    </button>
                  </p>
                </div>
                {state.notice?.kind === 'resent' ? (
                  <AuthNotice tone="success" title={t('otp.resentTitle')} text={t('otp.resentText')} />
                ) : null}
                <OtpCodeField
                  id={CODE_ID}
                  secondsLeft={secondsLeft}
                  autoFocus
                  error={
                    expired
                      ? t('otp.expired')
                      : state.codeError?.kind === 'invalid'
                        ? t('otp.invalidRegister', { count: state.codeError.attemptsLeft })
                        : null
                  }
                />
                {state.delayed && !expired ? (
                  <>
                    <AuthNotice tone="warning" title={t('otp.delayedTitle')} text={t('register.delayedText')} />
                    <div className={styles.checkNumber}>
                      <span className={styles.checkNumberTitle}>{t('register.phoneCorrect')}</span>
                      <span className={styles.checkNumberText}>
                        {formatUzPhone(state.phone)} ·{' '}
                        <button type="button" className={formStyles.linkButton} onClick={() => setChangingPhone(true)}>
                          {t('register.changeNumber')}
                        </button>
                      </span>
                    </div>
                  </>
                ) : null}
                {state.notice?.kind === 'sendFailed' ? (
                  <AuthNotice tone="danger" title={t('otp.sendFailedTitle')} text={t('otp.sendFailedText')} />
                ) : null}
                {state.notice?.kind === 'error' ? (
                  <AuthNotice tone="danger" title={t('login.failedTitle')} text={state.notice.message} />
                ) : null}
                <div className={formStyles.actions}>
                  {expired ? (
                    // Kod maydoni tekshirilmaydi — yangi kod so'raladi.
                    <Button className={formStyles.submit} type="primary" block loading={pendingLoading(flow.sending)} onClick={() => requestCode(state.phone, true)}>
                      {t('otp.newCode')}
                    </Button>
                  ) : (
                    <Button className={formStyles.submit} type="primary" htmlType="submit" block loading={pendingLoading(verify.isPending)}>
                      {t('register.confirm')}
                    </Button>
                  )}
                  {expired || state.delayed ? null : (
                    <p className={formStyles.caption}>
                      {t('otp.notReceived')}{' '}
                      <button type="button" className={formStyles.linkButton} disabled={flow.sending} onClick={() => requestCode(state.phone, true)}>
                        {t('otp.resend')}
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}
          </Form>
        )}
      </div>

      <ChangePhoneModal
        open={changingPhone}
        currentPhone={state.phone}
        requestCode={(phone) => flow.requestCode(phone, { quiet: true })}
        onDone={() => {
          setChangingPhone(false);
          form.setFieldValue('code', undefined);
        }}
        onCancel={() => setChangingPhone(false)}
      />
    </AuthLayout>
  );
}

/** «Kod +998 97 315 22 86 raqamiga yuborildi.» — raqam qalin, ajratilmaydi. */
function SentTo({ phone }: { phone: string }) {
  const { t } = useTranslation();
  const [before, after] = t('register.codeSent', { phone: '\u0000' }).split('\u0000');
  return (
    <>
      {before}
      <strong>{formatUzPhone(phone).replaceAll(' ', ' ')}</strong>
      {after}
    </>
  );
}
