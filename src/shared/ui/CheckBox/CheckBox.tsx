import { Check, Minus } from 'lucide-react';
import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import styles from './CheckBox.module.css';

type CheckBoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  /** Qisman tanlangan («Sahifadagi hamma lidni tanlash» — bir qismi belgilangan): `aria-checked="mixed"`. */
  indeterminate?: boolean;
};

/** Belgilash katakchasi (komponentlar-E §8): 20 × 20, radius 6; belgilangan — ko'k fon va oq belgi. */
export function CheckBox({ indeterminate = false, checked, ...props }: CheckBoxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <span className={styles.box}>
      <input ref={ref} type="checkbox" className={styles.input} checked={checked} aria-checked={indeterminate ? 'mixed' : undefined} {...props} />
      {indeterminate ? <Minus className={styles.mark} aria-hidden /> : checked ? <Check className={styles.mark} aria-hidden /> : null}
    </span>
  );
}

type RadioDotProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/** Radio (komponentlar-E §8): 20 × 20 doira; tanlangan — ko'k chegara va ichida 10 px nuqta. */
export function RadioDot({ checked, ...props }: RadioDotProps) {
  return (
    <span className={styles.box}>
      <input type="radio" className={styles.radio} checked={checked} {...props} />
      {checked ? <span className={styles.dot} aria-hidden /> : null}
    </span>
  );
}
