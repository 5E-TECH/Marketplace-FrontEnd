import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Form, Input } from 'antd';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { enableTwoFactor, readTwoFactorFailure, setupTwoFactor } from '../../../../features/auth/api/twoFactorApi';
import { ROLE_LABEL_KEYS } from '../../../../features/auth/lib/roleLabels';
import type { LoginResponse, TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { normalizeOtpCode, otpCodeDigits, pendingLoading } from '../../../../features/sellerAuth/lib/fieldRules';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { formatDateTime } from '../../../../shared/lib/date';
import { shortPersonName } from '../../../../shared/lib/personName';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import authStyles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import type { TwoFactorLeave } from '../../model/twoFactorView';
import { useAttemptGuard } from '../../../../features/auth/lib/useAttemptGuard';
import { BlockedView } from './BlockedView';
import { IdentityCard } from './IdentityCard';
import { KeyStep } from './KeyStep';
import styles from './TwoFactor.module.css';

export interface EnabledTwoFactor {
  recoveryCodes: string[];
  login: LoginResponse;
}

interface ConnectAppProps {
  challenge: TwoFactorChallenge;
  onLeave: (reason: TwoFactorLeave) => void;
  /** Ilova ulandi (BE-26 `enable`): zaxira kodlar va sessiya — kodlar ekraniga. */
  onEnabled: (result: EnabledTwoFactor) => void;
}

/**
 * Ilovani ulash (umumiy-2fa-ulash, TZ T8, BE-26): 1 — ilovani o'rnatish, 2 — QR (antd `QRCode`, `otpauthUrl` dan) va
 * qo'lda kiritish kaliti, 3 — ilovadagi kod → «Ulash». Superadmin tiklagan bo'lsa (taklif `reset`) — «2FA tiklandi».
 * Backend har `setup` da yangi sir yozadi — shu ekranda bir marta so'raladi (so'rov kesh kaliti — bosqich tokeni).
 */
export function ConnectApp({ challenge, onLeave, onEnabled }: ConnectAppProps) {
  const { t, locale } = useTranslation();
  const [form] = Form.useForm<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'warning' | 'danger'; title: string; text: string } | null>(null);
  const attempts = useAttemptGuard();
  const setup = useQuery({
    queryKey: ['auth', '2fa-setup', challenge.token],
    queryFn: () => setupTwoFactor(challenge.token),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const enable = useMutation({ mutationFn: enableTwoFactor });

  const setupFailure = setup.error ? readTwoFactorFailure(setup.error) : null;
  const leaveReason = setupFailure?.kind === 'expired' || setupFailure?.kind === 'alreadyEnabled' ? setupFailure.kind : null;
  // Bosqich muddati o'tgan yoki 2FA boshqa joyda ulangan — QR kerak emas, paroldan qayta.
  useEffect(() => {
    if (leaveReason) onLeave(leaveReason);
  }, [leaveReason, onLeave]);

  const submit = ({ code }: { code?: string }) => {
    if (!setup.data || attempts.blocked || enable.isPending) return;
    setError(null);
    setNotice(null);
    enable.mutate({ challengeToken: challenge.token, code: otpCodeDigits(code) }, {
      onSuccess: onEnabled,
      onError: (failure) => {
        const reason = readTwoFactorFailure(failure);
        switch (reason.kind) {
          case 'invalid': {
            const left = attempts.wrong(reason.attemptsLeft);
            if (left <= 0) {
              form.resetFields();
              return;
            }
            setError(t(left === 1 ? 'tfa.connectWrongLast' : 'tfa.connectWrong'));
            return;
          }
          case 'blocked':
            attempts.block(reason.retryAfter);
            form.resetFields();
            return;
          case 'expired':
          case 'alreadyEnabled':
            onLeave(reason.kind);
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

  const identity = <IdentityCard challenge={challenge} actionLabel={t('tfa.signOut')} onAction={() => onLeave('signOut')} />;
  if (attempts.blocked) return <BlockedView challenge={challenge} identity={identity} secondsLeft={attempts.left} />;

  const role = challenge.user ? t(ROLE_LABEL_KEYS[challenge.user.role]) : t('tfa.setupIntroRoleFallback');
  const reset = challenge.reset;
  return (
    <Form
      form={form}
      name="tfa-connect"
      className={`${authStyles.form} ${styles.wide}`}
      layout="vertical"
      requiredMark={false}
      onFinish={submit}
      onValuesChange={() => {
        setError(null);
        setNotice(null);
      }}
      size="large"
      aria-labelledby="tfa-title"
      data-testid="tfa-connect"
    >
      {identity}
      <div className={styles.heading}>
        <h1 id="tfa-title" className={authStyles.title}>{t(reset ? 'tfa.reconnectTitle' : 'tfa.connectTitle')}</h1>
        <p className={styles.lead}>{t(reset ? 'tfa.reconnectText' : 'tfa.connectText', { role })}</p>
      </div>
      {reset ? (
        <AuthNotice
          tone="info"
          icon={<ShieldAlert aria-hidden />}
          title={t('tfa.resetTitle')}
          text={t('tfa.resetText', { by: shortPersonName(reset.by), at: formatDateTime(reset.at, locale) })}
        />
      ) : null}

      <section className={styles.stepCard} aria-labelledby="tfa-step-1">
        <div className={styles.stepHead}>
          <span className={styles.stepNumber} aria-hidden>1</span>
          <h2 id="tfa-step-1" className={styles.stepCardTitle}>{t('tfa.step1Title')}</h2>
        </div>
        <p className={styles.lead}>{t('tfa.step1Text')}</p>
      </section>

      <KeyStep
        setup={setup.data}
        failure={setupFailure && !leaveReason ? (
          <AuthNotice
            tone="danger"
            title={t('tfa.setupFailedTitle')}
            text={setupFailure.kind === 'other' ? setupFailure.message : t(setupFailure.kind === 'tooMany' ? 'tfa.tooManyText' : 'login.serverText')}
          >
            <Button onClick={() => void setup.refetch()} loading={setup.isFetching}>{t('common.retry')}</Button>
          </AuthNotice>
        ) : null}
      />

      <section className={styles.stepCard} aria-labelledby="tfa-step-3">
        <div className={styles.stepHead}>
          <span className={styles.stepNumber} aria-hidden>3</span>
          <h2 id="tfa-step-3" className={styles.stepCardTitle}>{t('tfa.step3Title')}</h2>
        </div>
        <Form.Item
          className={`${authStyles.field} ${styles.fieldError}`}
          label={t('tfa.connectCodeLabel')}
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
          />
        </Form.Item>
      </section>

      {notice ? <AuthNotice tone={notice.tone} title={notice.title} text={notice.text} /> : null}

      <Button className={authStyles.submit} type="primary" htmlType="submit" block disabled={!setup.data} loading={pendingLoading(enable.isPending)}>
        {t('tfa.connectSubmit')}
      </Button>

      <div className={styles.footnote}>
        <p>{t('tfa.connectHelp')}</p>
      </div>
    </Form>
  );
}
