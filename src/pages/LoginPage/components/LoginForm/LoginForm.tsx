import { Button, Form, type FormInstance } from 'antd';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { PasswordInput } from '../../../../shared/ui/PasswordInput/PasswordInput';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import styles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import { PhoneInput } from '../../../../shared/ui/PhoneInput/PhoneInput';

export interface LoginFormValues {
  phone: string;
  password: string;
}

/** Forma ostidagi holat bloki: 429 — ogohlantirish, server/tarmoq — xato. */
export interface LoginNotice {
  tone: 'warning' | 'danger';
  title: string;
  text: string;
}

interface LoginFormProps {
  form: FormInstance<LoginFormValues>;
  isSubmitting: boolean;
  notice: LoginNotice | null;
  onSubmit: (values: LoginFormValues) => void;
  onChange: () => void;
  /** «Kim sifatida kirasiz» tanlovi — sarlavha ostida (FE-04). */
  roleSwitch?: ReactNode;
}

const PHONE_NUMBER_PATTERN = /^\d{9}$/;

/** Platforma xodimi: telefon raqami va parol (umumiy-kirish §3). */
export function LoginForm({ form, isSubmitting, notice, onSubmit, onChange, roleSwitch }: LoginFormProps) {
  const { t } = useTranslation();
  return (
    <Form<LoginFormValues>
      form={form}
      className={styles.form}
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
      onValuesChange={onChange}
      size="large"
      aria-labelledby="login-title"
    >
      <h1 id="login-title" className={styles.title}>{t('login.title')}</h1>
      {roleSwitch}

      <Form.Item
        className={styles.field}
        label={t('auth.phone')}
        name="phone"
        rules={[
          { required: true, message: t('auth.phoneRequired') },
          { pattern: PHONE_NUMBER_PATTERN, message: t('auth.phoneNineDigits') },
        ]}
      >
        <PhoneInput size="large" />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label={t('auth.password')}
        name="password"
        rules={[
          { required: true, message: t('auth.passwordRequired') },
          { max: 128, message: t('auth.passwordMax') },
        ]}
      >
        <PasswordInput className={styles.password} autoComplete="current-password" maxLength={128} spellCheck={false} />
      </Form.Item>

      {notice ? (
        <div className={notice.tone === 'warning' ? styles.warning : styles.danger} role="alert">
          {notice.tone === 'warning' ? <TriangleAlert aria-hidden /> : <CircleAlert aria-hidden />}
          <div>
            <p className={styles.noticeTitle}>{notice.title}</p>
            <p className={styles.noticeText}>{notice.text}</p>
          </div>
        </div>
      ) : null}

      <Button className={styles.submit} type="primary" htmlType="submit" loading={isSubmitting} block>
        {t('auth.login')}
      </Button>

      <p className={styles.hint}>{t('login.staffHint')}</p>
    </Form>
  );
}
