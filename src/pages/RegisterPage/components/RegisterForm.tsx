import { Button, Form, Input } from 'antd';
import { PasswordInput } from '../../../shared/ui/PasswordInput/PasswordInput';
import styles from '../../LoginPage/components/LoginForm/LoginForm.module.css';
import { useTranslation } from '../../../shared/i18n/useTranslation';

export interface RegisterFormValues {
  name: string;
  phone: string;
  email: string;
  shopName: string;
  shopDescription: string;
  address: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  isSubmitting: boolean;
  onSubmit: (values: RegisterFormValues) => void;
}

const PHONE_NUMBER_PATTERN = /^\d{9}$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export function RegisterForm({ isSubmitting, onSubmit }: RegisterFormProps) {
  const { t } = useTranslation();
  return (
    <Form<RegisterFormValues>
      layout="vertical"
      requiredMark
      disabled={isSubmitting}
      autoComplete="on"
      size="large"
      onFinish={onSubmit}
    >
      <Form.Item
        className={styles.field}
        label={t('auth.fullName').toLocaleUpperCase()}
        name="name"
        rules={[
          { required: true, whitespace: true, message: t('auth.fullNameRequired') },
          { min: 2, message: t('auth.nameMin') },
          { max: 80, message: t('auth.nameMax') },
        ]}
      >
        <Input
          className={styles.input}
          variant="borderless"
          autoComplete="name"
          maxLength={80}
          placeholder={t('auth.fullNamePlaceholder')}
          aria-label={t('auth.fullName')}
        />
      </Form.Item>

      <Form.Item className={styles.field} label="EMAIL" name="email" rules={[{ type: 'email', message: t('auth.emailInvalid') }]}>
        <Input className={styles.input} variant="borderless" autoComplete="email" maxLength={120} placeholder="seller@example.com" aria-label="Email" />
      </Form.Item>

      <Form.Item className={styles.field} label={t('auth.shopName').toLocaleUpperCase()} name="shopName" rules={[{ required: true, whitespace: true, message: t('auth.shopNameRequired') }, { max: 80 }]}>
        <Input className={styles.input} variant="borderless" maxLength={80} placeholder="Ali Market" aria-label={t('auth.shopName')} />
      </Form.Item>

      <Form.Item className={styles.field} label={t('auth.shopDescription').toLocaleUpperCase()} name="shopDescription" rules={[{ max: 500 }]}>
        <Input className={styles.input} variant="borderless" maxLength={500} placeholder={t('auth.shopDescriptionPlaceholder')} aria-label={t('auth.shopDescription')} />
      </Form.Item>

      <Form.Item className={styles.field} label={t('auth.address').toLocaleUpperCase()} name="address" rules={[{ max: 180 }]}>
        <Input className={styles.input} variant="borderless" maxLength={180} placeholder={t('auth.addressPlaceholder')} aria-label={t('auth.address')} />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label={t('auth.phone').toLocaleUpperCase()}
        name="phone"
        normalize={(value?: string) =>
          (value ?? '').replace(/\D/g, '').slice(0, 9)
        }
        rules={[
          { required: true, message: t('auth.phoneRequired') },
          { pattern: PHONE_NUMBER_PATTERN, message: t('auth.phoneNineDigits') },
        ]}
      >
        <Input
          className={styles.input}
          variant="borderless"
          prefix={<span className={styles.phonePrefix}>+998</span>}
          inputMode="numeric"
          maxLength={9}
          autoComplete="tel"
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
          {
            pattern: STRONG_PASSWORD_PATTERN,
            message: t('auth.strongPassword'),
          },
        ]}
      >
        <PasswordInput
          className={styles.input}
          variant="borderless"
          autoComplete="new-password"
          maxLength={128}
          placeholder={t('auth.passwordMinPlaceholder')}
          aria-label={t('auth.password')}
        />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label={t('auth.confirmPassword').toLocaleUpperCase()}
        name="confirmPassword"
        dependencies={['password']}
        rules={[
          { required: true, message: t('auth.confirmPasswordRequired') },
          ({ getFieldValue }) => ({
            validator(_, value: string | undefined) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error(t('auth.passwordMismatch')));
            },
          }),
        ]}
      >
        <PasswordInput
          className={styles.input}
          variant="borderless"
          autoComplete="new-password"
          maxLength={128}
          placeholder={t('auth.repeatPassword')}
          aria-label={t('auth.confirmPassword')}
        />
      </Form.Item>

      <Button
        className={styles.submitButton}
        type="primary"
        htmlType="submit"
        loading={isSubmitting}
      >
        {t('auth.register').toLocaleUpperCase()}
      </Button>
    </Form>
  );
}
