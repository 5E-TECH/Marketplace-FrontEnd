import { Button, Form, Input } from 'antd';
import { PasswordInput } from '../../../shared/ui/PasswordInput/PasswordInput';
import styles from '../../LoginPage/components/LoginForm/LoginForm.module.css';

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
        label="ISM VA FAMILIYA"
        name="name"
        rules={[
          { required: true, whitespace: true, message: 'Ism va familiyangizni kiriting' },
          { min: 2, message: 'Ism kamida 2 belgidan iborat bo‘lsin' },
          { max: 80, message: 'Ism 80 belgidan oshmasligi kerak' },
        ]}
      >
        <Input
          className={styles.input}
          variant="borderless"
          autoComplete="name"
          maxLength={80}
          placeholder="Ism Familiya"
          aria-label="Ism va familiya"
        />
      </Form.Item>

      <Form.Item className={styles.field} label="EMAIL" name="email" rules={[{ type: 'email', message: 'Email manzilini to‘g‘ri kiriting' }]}>
        <Input className={styles.input} variant="borderless" autoComplete="email" maxLength={120} placeholder="seller@example.com" aria-label="Email" />
      </Form.Item>

      <Form.Item className={styles.field} label="DO‘KON NOMI" name="shopName" rules={[{ required: true, whitespace: true, message: 'Do‘kon nomini kiriting' }, { max: 80 }]}>
        <Input className={styles.input} variant="borderless" maxLength={80} placeholder="Ali Market" aria-label="Do‘kon nomi" />
      </Form.Item>

      <Form.Item className={styles.field} label="DO‘KON TAVSIFI" name="shopDescription" rules={[{ max: 500 }]}>
        <Input className={styles.input} variant="borderless" maxLength={500} placeholder="Maishiy texnika do‘koni" aria-label="Do‘kon tavsifi" />
      </Form.Item>

      <Form.Item className={styles.field} label="MANZIL" name="address" rules={[{ max: 180 }]}>
        <Input className={styles.input} variant="borderless" maxLength={180} placeholder="Toshkent shahri" aria-label="Manzil" />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label="TELEFON RAQAMI"
        name="phone"
        normalize={(value?: string) =>
          (value ?? '').replace(/\D/g, '').slice(0, 9)
        }
        rules={[
          { required: true, message: 'Telefon raqamini kiriting' },
          { pattern: PHONE_NUMBER_PATTERN, message: '9 xonali telefon raqamini kiriting' },
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
          aria-label="Telefon raqami"
        />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label="PAROL"
        name="password"
        rules={[
          { required: true, message: 'Parolni kiriting' },
          {
            pattern: STRONG_PASSWORD_PATTERN,
            message: 'Kamida 8 belgi, harf va raqam ishlating',
          },
        ]}
      >
        <PasswordInput
          className={styles.input}
          variant="borderless"
          autoComplete="new-password"
          maxLength={128}
          placeholder="Kamida 8 belgi"
          aria-label="Parol"
        />
      </Form.Item>

      <Form.Item
        className={styles.field}
        label="PAROLNI TASDIQLANG"
        name="confirmPassword"
        dependencies={['password']}
        rules={[
          { required: true, message: 'Parolni qayta kiriting' },
          ({ getFieldValue }) => ({
            validator(_, value: string | undefined) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Parollar bir xil emas'));
            },
          }),
        ]}
      >
        <PasswordInput
          className={styles.input}
          variant="borderless"
          autoComplete="new-password"
          maxLength={128}
          placeholder="Parolni takrorlang"
          aria-label="Parolni tasdiqlash"
        />
      </Form.Item>

      <Button
        className={styles.submitButton}
        type="primary"
        htmlType="submit"
        loading={isSubmitting}
      >
        RO‘YXATDAN O‘TISH
      </Button>
    </Form>
  );
}
