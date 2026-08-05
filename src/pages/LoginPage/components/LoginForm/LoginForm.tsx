import { Button, Form, Input } from 'antd';
import { PasswordInput } from '../../../../shared/ui/PasswordInput/PasswordInput';
import styles from './LoginForm.module.css';

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
        label="TELEFON RAQAMI"
        name="phone"
        normalize={(value?: string) => (value ?? '').replace(/\D/g, '').slice(0, 9)}
        rules={[
          { required: true, message: 'Telefon raqamini kiriting' },
          {
            pattern: PHONE_NUMBER_PATTERN,
            message: '9 xonali telefon raqamini kiriting',
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
          aria-label="Telefon raqami"
        />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label="PAROL"
        name="password"
        rules={[
          { required: true, message: 'Parolni kiriting' },
          { max: 128, message: 'Parol 128 belgidan oshmasligi kerak' },
        ]}
      >
        <PasswordInput
          className={styles.input}
          variant="borderless"
          autoComplete="current-password"
          maxLength={128}
          spellCheck={false}
          placeholder="Parolingizni kiriting"
          aria-label="Parol"
        />
      </Form.Item>

      <Button
        className={styles.submitButton}
        type="primary"
        htmlType="submit"
        loading={isSubmitting}
      >
        PLATFORMAGA KIRISH
      </Button>

    </Form>
  );
}
