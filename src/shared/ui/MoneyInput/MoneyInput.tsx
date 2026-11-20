import { Input, type InputProps, type InputRef } from 'antd';
import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { caretAfterDigits, digitsBeforeCaret } from '../../lib/caret';
import { groupMoneyDigits, parseMoneyInput } from '../../lib/money';
import styles from './MoneyInput.module.css';

type MoneyInputProps = Omit<InputProps, 'value' | 'onChange' | 'suffix' | 'type' | 'size'> & {
  /** Butun so'm (BIGINT); bo'sh — `null`. */
  value?: number | null;
  onChange?: (value: number | null) => void;
  /** Asosiy summa (pul yechish, narx) — 52 px, 28/36. */
  size?: 'middle' | 'large';
};

/**
 * Pul maydoni (komponentlar-E §21): `type="text"` + `inputmode="numeric"` (`number` emas — oraliq va
 * kursor buziladi). Yozish paytida 3 xonadan guruhlanadi, kursor joyida qoladi: 250000 → «250 000».
 */
export function MoneyInput({ value = null, onChange, className, size = 'middle', ...props }: MoneyInputProps) {
  const { t } = useTranslation();
  const ref = useRef<InputRef>(null);
  const caret = useRef<number | null>(null);
  const display = value === null ? '' : groupMoneyDigits(String(Math.trunc(Math.abs(value))));

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
      className={[styles.input, size === 'large' ? styles.large : '', className ?? ''].filter(Boolean).join(' ')}
      inputMode="numeric"
      autoComplete="off"
      placeholder={props.placeholder ?? '0'}
      suffix={<span className={styles.currency} aria-hidden>{t('money.currency')}</span>}
      onChange={(event) => {
        const raw = event.target.value;
        const next = parseMoneyInput(raw);
        const leadingZeros = (raw.replace(/\D/g, '').match(/^0+(?=\d)/)?.[0].length) ?? 0;
        caret.current = Math.max(0, digitsBeforeCaret(raw, event.target.selectionStart) - leadingZeros);
        onChange?.(next);
      }}
    />
  );
}
