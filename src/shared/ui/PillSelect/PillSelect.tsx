import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import styles from './PillSelect.module.css';

export interface PillOption {
  value: string;
  label: string;
}

interface PillSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly PillOption[];
  disabled?: boolean;
}

/** «Davr: …», «Kategoriya: …» kabi pill-tanlov (komponentlar-E §4): yorliq ichida, o'ngda chevron; ichida tabiiy `select`. */
export function PillSelect({ label, value, onChange, options, disabled }: PillSelectProps) {
  const id = useId();
  return (
    <span className={styles.pill}>
      <label htmlFor={id} className={styles.label}>{label}:</label>
      <select id={id} className={styles.select} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className={styles.chevron} aria-hidden />
    </span>
  );
}
