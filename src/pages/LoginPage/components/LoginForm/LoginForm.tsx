import { Button, Form, Input } from 'antd';
import { PasswordInput } from '../../../../shared/ui/PasswordInput/PasswordInput';
import styles from './LoginForm.module.css';
import { useTranslation } from '../../../../shared/i18n/useTranslation';

export interface LoginFormValues {
  phone: string;
  password: string;
}

interface LoginFormProps {
  isSubmitting: boolean;
  onSubmit: (values: LoginFormValues) => void;
}

const PHONE_NUMBER_PATTERN = /^\d{9}$/;

export function LoginForm({
  isSubmitting,
  onSubmit,
}: LoginFormProps) {
  const { t } = useTranslation();
  return (
    <Form<LoginFormValues>
      layout="vertical"
      requiredMark
      disabled={isSubmitting}
      onFinish={onSubmit}
      autoComplete="on"
      size="large"
    >
      <Form.Item
        className={styles.field}
        label={t('auth.phone').toLocaleUpperCase()}
        name="phone"
        normalize={(value?: string) => (value ?? '').replace(/\D/g, '').slice(0, 9)}
        rules={[
          { required: true, message: t('auth.phoneRequired') },
          {
            pattern: PHONE_NUMBER_PATTERN,
            message: t('auth.phoneNineDigits'),
          },
        ]}
      >
        <Input
          className={styles.input}
          variant="borderless"
          prefix={<span className={styles.phonePrefix}>+998</span>}
          inputMode="numeric"
          maxLength={9}
          autoComplete="tel"
          spellCheck={false}
          placeholder="90 123 45 67"
          aria-label={t('auth.phone')}
        />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label={t('auth.password').toLocaleUpperCase()}
        name="password"
        rules={[
          { required: true, message: t('auth.passwordRequired') },
          { max: 128, message: t('auth.passwordMax') },
        ]}
      >
        <PasswordInput
          className={styles.input}
          variant="borderless"
          autoComplete="current-password"
          maxLength={128}
          spellCheck={false}
          placeholder={t('auth.passwordPlaceholder')}
          aria-label={t('auth.password')}
        />
      </Form.Item>

      <Button
        className={styles.submitButton}
        type="primary"
        htmlType="submit"
        loading={isSubmitting}
      >
        {t('auth.signIn').toLocaleUpperCase()}
      </Button>

    </Form>
  );
}
