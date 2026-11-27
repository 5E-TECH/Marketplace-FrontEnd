import { App, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { useTokenSignInMutation } from '../../../../features/auth/api/useLoginMutation';
import { formatRecoveryInput, normalizeRecoveryCode, readTwoFactorFailure, verifyTwoFactor } from '../../../../features/auth/api/twoFactorApi';
import type { TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { normalizeOtpCode, otpCodeDigits, pendingLoading } from '../../../../features/sellerAuth/lib/fieldRules';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import authStyles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import type { TwoFactorLeave } from '../../model/twoFactorView';
import { useAttemptGuard } from '../../../../features/auth/lib/useAttemptGuard';
import { BlockedView } from './BlockedView';
import { IdentityCard } from './IdentityCard';
import { LostPhoneDialog } from '../../../../features/auth/ui/TwoFactor/LostPhoneDialog';
import styles from './TwoFactor.module.css';

interface CodeStepProps {
  challenge: TwoFactorChallenge;
  /** Parol bosqichiga: «Boshqa hisob» — maydonlar bo'sh; muddat o'tdi (5 daqiqa) — ogohlantirish bilan. */
  onLeave: (reason: TwoFactorLeave) => void;
}

type Mode = 'code' | 'recovery';
interface Values {
  code?: string;
  recovery?: string;
}

/**
 * Ilovadagi kod (umumiy-2fa, TZ T8, BE-26): parol tekshirilgach 6 xonali TOTP yoki zaxira kod. Xato kodda qolgan
 * urinishlar (taklif `attemptsLeft`, kelmasa shu bosqichda o'zi sanaydi), 3 xatoda — 15 daqiqa blok taymer bilan,
 * «Telefonim yo'qoldi» oynasi. To'g'ri kod — sessiya ochiladi va panel (PublicOnlyRoute).
 */
export function TwoFactorCodeStep({ challenge, onLeave }: CodeStepProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const verify = useTokenSignInMutation(verifyTwoFactor);
  const [mode, setMode] = useState<Mode>('code');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'warning' | 'danger'; title: string; text: string } | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const attempts = useAttemptGuard();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    form.resetFields();
  };

  const block = (seconds: number) => {
    attempts.block(seconds);
    setError(null);
    form.resetFields();
  };

  const submit = (values: Values) => {
    if (attempts.blocked || verify.isPending) return;
    setError(null);
    setNotice(null);
    const payload = mode === 'code'
      ? { challengeToken: challenge.token, code: otpCodeDigits(values.code) }
      : { challengeToken: challenge.token, recoveryCode: normalizeRecoveryCode(values.recovery ?? '') };
    verify.mutate(payload, {
      onSuccess: () => void message.success(t('auth.loginSuccess')),
      onError: (failure) => {
        const reason = readTwoFactorFailure(failure);
        switch (reason.kind) {
          case 'invalid': {
            const attemptsLeft = attempts.wrong(reason.attemptsLeft);
            if (attemptsLeft <= 0) {
              setError(null);
              form.resetFields();
              return;
            }
            const key = mode === 'code' ? (attemptsLeft === 1 ? 'tfa.codeWrongLast' : 'tfa.codeWrong') : (attemptsLeft === 1 ? 'tfa.recoveryWrongLast' : 'tfa.recoveryWrong');
            setError(t(key, { count: attemptsLeft }));
            return;
          }
          case 'blocked':
            block(reason.retryAfter);
            return;
          case 'expired':
            onLeave('expired');
            return;
          case 'alreadyEnabled':
            onLeave('alreadyEnabled');
            return;
          case 'tooMany':
            setNotice({ tone: 'warning', title: t('tfa.tooManyTitle'), text: t('tfa.tooManyText') });
            return;
          case 'network':
            setNotice({ tone: 'danger', title: t('login.serverTitle'), text: t('login.serverText') });
            return;
          default:
            setNotice({ tone: 'danger', title: t('tfa.failedTitle'), text: reason.message });
        }
      },
    });
  };

  const identity = <IdentityCard challenge={challenge} actionLabel={t('tfa.otherAccount')} onAction={() => onLeave('signOut')} />;

  if (attempts.blocked) return <BlockedView challenge={challenge} identity={identity} secondsLeft={attempts.left} />;

  const recovery = mode === 'recovery';
  return (
    <Form<Values>
      form={form}
      name="tfa"
      className={authStyles.form}
      layout="vertical"
      requiredMark={false}
      onFinish={submit}
      onValuesChange={() => {
        setError(null);
        setNotice(null);
      }}
      size="large"
      aria-labelledby="tfa-title"
      data-testid="tfa-code-step"
    >
      {identity}
      <div className={styles.heading}>
        <h1 id="tfa-title" className={authStyles.title}>{t(recovery ? 'tfa.recoveryTitle' : 'tfa.codeTitle')}</h1>
        <p className={styles.lead}>{t(recovery ? 'tfa.recoveryText' : 'tfa.codeText')}</p>
      </div>

      {recovery ? (
        <Form.Item
          className={`${authStyles.field} ${styles.fieldError}`}
          label={t('tfa.recoveryLabel')}
          name="recovery"
          normalize={formatRecoveryInput}
          rules={[{ required: true, message: t('tfa.recoveryRequired') }]}
          validateTrigger="onSubmit"
          validateStatus={error ? 'error' : undefined}
          help={error ?? undefined}
        >
          <Input
            className={`${authStyles.code} ${styles.recoveryInput}`}
            autoComplete="one-time-code"
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={t('tfa.recoveryPlaceholder')}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
        </Form.Item>
      ) : (
        <Form.Item
          className={`${authStyles.field} ${styles.fieldError}`}
          label={t('tfa.codeLabel')}
          name="code"
          normalize={normalizeOtpCode}
          rules={[
            { required: true, message: t('tfa.codeRequired') },
            { validator: (_rule, value: unknown) => (typeof value !== 'string' || !value || otpCodeDigits(value).length === 6 ? Promise.resolve() : Promise.reject(new Error(t('tfa.codeFormat')))) },
          ]}
          validateTrigger="onSubmit"
          validateStatus={error ? 'error' : undefined}
          help={error ?? undefined}
        >
          <Input
            className={authStyles.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder={t('tfa.codePlaceholder')}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
        </Form.Item>
      )}

      {notice ? <AuthNotice tone={notice.tone} title={notice.title} text={notice.text} /> : null}

      <Button className={authStyles.submit} type="primary" htmlType="submit" block loading={pendingLoading(verify.isPending)}>
        {t(recovery ? 'tfa.signIn' : 'tfa.confirm')}
      </Button>

      <div className={styles.links}>
        {recovery ? (
          <button type="button" className={styles.textButton} onClick={() => switchMode('code')}>{t('tfa.useApp')}</button>
        ) : (
          <>
            <button type="button" className={styles.textButton} onClick={() => switchMode('recovery')}>{t('tfa.useRecovery')}</button>
            <button type="button" className={styles.textButton} onClick={() => setLostOpen(true)}>{t('tfa.lostPhone')}</button>
          </>
        )}
      </div>

      <div className={styles.footnote}>
        <p>{t(recovery ? 'tfa.recoveryHint' : 'tfa.codeHint')}</p>
      </div>

      {lostOpen ? (
        <LostPhoneDialog
          onClose={() => setLostOpen(false)}
          onUseRecovery={() => {
            setLostOpen(false);
            switchMode('recovery');
          }}
        />
      ) : null}
    </Form>
  );
}
