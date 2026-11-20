import { Input, type InputProps, type InputRef } from 'antd';
import { useLayoutEffect, useRef } from 'react';
import { caretAfterDigits, digitsBeforeCaret } from '../../lib/caret';
import { formatLocalPhone, getUzLocalPhone } from '../../lib/phone';
import styles from './PhoneInput.module.css';

type PhoneInputProps = Omit<InputProps, 'prefix' | 'type' | 'value' | 'onChange' | 'size'> & {
  /** Mahalliy 9 raqam («901234567»); ekranda «90 123 45 67». */
  value?: string;
  onChange?: (value: string) => void;
  /** Kirish sahifalarida 52 px. */
  size?: 'middle' | 'large';
};

/**
 * Telefon maydoni (komponentlar-E §19): «+998» qotirilgan, raqam yozish paytida 2-3-2-2 guruhlanadi,
 * kursor joyida qoladi. «+998 90 …», «998 90 …», «8 90 …» joylansa prefiks tashlanadi. Qiymat — 9 raqam;
 * tekshiruv `uzPhoneRules` bilan (maydondan chiqqanda va yuborishda).
 */
export function PhoneInput({ value = '', onChange, className, readOnly, size = 'middle', ...props }: PhoneInputProps) {
  const ref = useRef<InputRef>(null);
  const caret = useRef<number | null>(null);
  const display = formatLocalPhone(value);

  useLayoutEffect(() => {
    const element = ref.current?.input;
    if (!element || caret.current === null || document.activeElement !== element) return;
    const position = caretAfterDigits(display, caret.current);
    element.setSelectionRange(position, position);
    caret.current = null;
  }, [display]);

  return (
    <Input
      {...props}
      ref={ref}
      value={display}
      readOnly={readOnly}
      className={[styles.input, size === 'large' ? styles.large : '', readOnly ? styles.readonly : '', className ?? ''].filter(Boolean).join(' ')}
      prefix={<span className={styles.prefix}>+998</span>}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      spellCheck={false}
      placeholder="90 123 45 67"
      onChange={(event) => {
        const raw = event.target.value;
        const local = getUzLocalPhone(raw);
        const digits = raw.replace(/\D/g, '');
        const digitsBefore = digitsBeforeCaret(raw, event.target.selectionStart);
        // Joylangan prefiks (998 yoki 8) old tomondan tashlangan — kursor raqamlari shuncha kamayadi.
        const stripped = digits.length > 9 && digits.startsWith('998') ? 3 : digits.length === 10 && digits.startsWith('8') ? 1 : 0;
        caret.current = Math.min(local.length, Math.max(0, digitsBefore - stripped));
        onChange?.(local);
      }}
    />
  );
}
