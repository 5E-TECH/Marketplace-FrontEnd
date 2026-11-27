import { Form, Input } from 'antd';
import { CircleCheck, CircleX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { rich } from '../../../../shared/i18n/richText';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import { normalizeOtpCode, otpCodeDigits } from '../../../sellerAuth/lib/fieldRules';
import { formatCountdown } from '../../../sellerAuth/lib/useCountdown';
import { openSession } from '../../api/authApi';
import { formatRecoveryInput, normalizeRecoveryCode, readTwoFactorFailure, verifyTwoFactor } from '../../api/twoFactorApi';
import { useAttemptGuard } from '../../lib/useAttemptGuard';
import type { AuthSession, TwoFactorChallenge } from '../../model/authTypes';
import { LostPhoneDialog } from '../TwoFactor/LostPhoneDialog';
import { SessionPrimary } from './SessionActions';
import styles from './SessionExpiredDialog.module.css';

interface SessionTwoFactorStepProps {
  challenge: TwoFactorChallenge;
  /** Kim qatori: avatar, ism va rol — «Parol tekshirildi» bilan. */
  who: { initials: string; name: string; role: string };
  /** «Orqaga» yoki 2FA bosqichi muddati o'tdi — parol maydoniga. */
  onBack: (expired: boolean) => void;
  onSignedIn: (session: AuthSession) => void;
  /** Kod to'g'ri, lekin hisob shu orada yopilgan — `true` qaytarsa xato shu yerda ko'rsatilmaydi. */
  onLocked: (error: unknown) => boolean;
}

type Mode = 'code' | 'recovery';

/**
 * Admin, superadmin va moliya — «Sessiya tugadi» oynasida 2-qadam (umumiy-sessiya 3, 12; BE-26): parol to'g'ri,
 * endi ilovadagi kod yoki zaxira kod. Qoidalar kirish sahifasidagidek: 3 xato — 15 daqiqa, «Telefonim yo‘qoldi».
 */
export function SessionTwoFactorStep({ challenge, who, onBack, onSignedIn, onLocked }: SessionTwoFactorStepProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ code?: string; recovery?: string }>();
  const [mode, setMode] = useState<Mode>('code');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const attempts = useAttemptGuard();
  const recovery = mode === 'recovery';

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    form.resetFields();
  };

  const submit = async ({ code, recovery: recoveryCode }: { code?: string; recovery?: string }) => {
    if (attempts.blocked || submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const login = await verifyTwoFactor(recovery
        ? { challengeToken: challenge.token, recoveryCode: normalizeRecoveryCode(recoveryCode ?? '') }
        : { challengeToken: challenge.token, code: otpCodeDigits(code) });
      onSignedIn(await openSession(login));
    } catch (failure) {
      if (onLocked(failure)) return;
      const reason = readTwoFactorFailure(failure);
      if (reason.kind === 'invalid') {
        const left = attempts.wrong(reason.attemptsLeft);
        form.resetFields();
        if (left > 0) setError(t(recovery ? (left === 1 ? 'tfa.recoveryWrongLast' : 'tfa.recoveryWrong') : (left === 1 ? 'tfa.codeWrongLast' : 'tfa.codeWrong'), { count: left }));
      } else if (reason.kind === 'blocked') {
        attempts.block(reason.retryAfter);
        form.resetFields();
      } else if (reason.kind === 'expired' || reason.kind === 'alreadyEnabled') {
        onBack(true);
      } else if (reason.kind === 'tooMany') {
        setNotice({ title: t('tfa.tooManyTitle'), text: t('tfa.tooManyText') });
      } else {
        setNotice({ title: t('tfa.failedTitle'), text: reason.kind === 'network' ? t('login.serverText') : reason.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      onFinish={(values) => void submit(values)}
      onValuesChange={() => setError(null)}
      className={styles.form}
      data-testid="session-tfa"
    >
      <div className={styles.who}>
        <span className={styles.avatar} aria-hidden>{who.initials}</span>
        <span className={styles.whoText}>
          <span className={styles.whoName}>{who.name} <span className={styles.whoRole}>· {who.role}</span></span>
          <span className={styles.checked}><CircleCheck aria-hidden />{t('tfa.passwordChecked')}</span>
        </span>
      </div>

      {recovery ? (
        <Form.Item
          name="recovery"
          label={t('tfa.recoveryLabel')}
          normalize={formatRecoveryInput}
          rules={[{ required: true, message: t('tfa.recoveryRequired') }]}
          validateTrigger="onSubmit"
          validateStatus={error ? 'error' : undefined}
          help={error ?? undefined}
        >
          <Input className={styles.codeInput} autoComplete="one-time-code" spellCheck={false} autoCapitalize="characters" placeholder={t('tfa.recoveryPlaceholder')} disabled={attempts.blocked} autoFocus />
        </Form.Item>
      ) : (
        <Form.Item
          name="code"
          label={t('tfa.codeLabel')}
          normalize={normalizeOtpCode}
          rules={[
            { required: true, message: t('tfa.codeRequired') },
            { validator: (_rule, value: unknown) => (typeof value !== 'string' || !value || otpCodeDigits(value).length === 6 ? Promise.resolve() : Promise.reject(new Error(t('tfa.codeFormat')))) },
          ]}
          validateTrigger="onSubmit"
          validateStatus={error ? 'error' : undefined}
          help={error ?? undefined}
        >
          <Input className={styles.codeInput} inputMode="numeric" autoComplete="one-time-code" spellCheck={false} placeholder={t('tfa.codePlaceholder')} disabled={attempts.blocked} autoFocus />
        </Form.Item>
      )}

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

      {attempts.blocked ? (
        <AuthNotice tone="danger" icon={<CircleX aria-hidden />} title={t('tfa.blockedNotice')} text={t('session.tfaBlocked', { time: formatCountdown(attempts.left) })} />
      ) : notice ? <AuthNotice tone="warning" title={notice.title} text={notice.text} /> : null}

      <p className={styles.step}>{rich(t('session.tfaStep'), { step: <strong>2/2</strong> })}</p>

      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => onBack(false)}>{t('session.tfaBack')}</button>
        <SessionPrimary submit busy={submitting} disabled={attempts.blocked}>{t('tfa.confirm')}</SessionPrimary>
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
