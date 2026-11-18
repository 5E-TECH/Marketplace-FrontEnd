import { Form, Input } from 'antd';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../../../shared/ui/AuthLayout/authForm.module.css';
import { normalizeOtpCode, otpCodeRules } from '../lib/fieldRules';
import { formatCountdown } from '../lib/useCountdown';

interface OtpCodeFieldProps {
  id: string;
  secondsLeft: number;
  /** Server yoki taymer xatosi — maydon ostida qizil (`Kod noto‘g‘ri…`, `Kod muddati o‘tdi…`). */
  error: string | null;
  autoFocus?: boolean;
}

/**
 * «SMS kod · amal qiladi: 04:12» (umumiy-kirish §1, sotuvchi-royxat §2): bitta maydon,
 * raqamli klaviatura, SMS dan avtomatik to'ldirish (`one-time-code`).
 */
export function OtpCodeField({ id, secondsLeft, error, autoFocus }: OtpCodeFieldProps) {
  const { t } = useTranslation();
  return (
    <div>
      <div className={styles.fieldHead}>
        <label htmlFor={id} className={styles.fieldLabel}>{t('otp.codeLabel')}</label>
        <span className={styles.fieldAside}>
          {t('otp.validFor')}{' '}
          <strong role="timer" data-expired={secondsLeft === 0}>{formatCountdown(secondsLeft)}</strong>
        </span>
      </div>
      <Form.Item
        className={styles.field}
        name="code"
        normalize={normalizeOtpCode}
        rules={otpCodeRules(t)}
        validateTrigger="onSubmit"
        validateStatus={error ? 'error' : undefined}
        help={error ?? undefined}
      >
        <Input
          id={id}
          className={styles.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          placeholder={t('otp.codePlaceholder')}
          autoFocus={autoFocus}
          // Server/taymer xatosi `help` orqali — antd o'zi aria-invalid qo'ymaydi.
          aria-invalid={error ? true : undefined}
        />
      </Form.Item>
    </div>
  );
}
