import { Input, type InputProps } from 'antd';
import styles from './authForm.module.css';

/**
 * «+998» bilan telefon maydoni (umumiy-kirish, sotuvchi-royxat). Qiymat — mahalliy 9 raqam;
 * Form.Item da `normalize={(v) => getUzLocalPhone(v ?? '')}` bilan ishlatiladi.
 * maxLength yo'q: u joylangan «+998 90 …» ni normalize'dan oldin kesib qo'yadi.
 */
export function PhoneInput({ className, readOnly, ...props }: Omit<InputProps, 'prefix' | 'type'>) {
  return (
    <Input
      {...props}
      readOnly={readOnly}
      className={[styles.phone, readOnly ? styles.phoneReadonly : '', className ?? ''].filter(Boolean).join(' ')}
      prefix={<span className={styles.phonePrefix}>+998</span>}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      spellCheck={false}
      placeholder="90 123 45 67"
    />
  );
}
