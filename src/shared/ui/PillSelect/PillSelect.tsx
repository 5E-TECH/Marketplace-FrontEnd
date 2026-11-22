import { ChevronDown, type LucideIcon } from 'lucide-react';
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
  /** Yorliq oldidagi belgi: «📅 Kelish: Barchasi» (admin-postavka). */
  icon?: LucideIcon;
}

/** «Davr: …», «Kategoriya: …» kabi pill-tanlov (komponentlar-E §4): yorliq ichida, o'ngda chevron; ichida tabiiy `select`. */
export function PillSelect({ label, value, onChange, options, disabled, icon: Icon }: PillSelectProps) {
  const id = useId();
  return (
    <span className={styles.pill} data-icon={Icon ? true : undefined}>
      {Icon ? <Icon className={styles.icon} aria-hidden /> : null}
      <label htmlFor={id} className={styles.label}>{label}:</label>
      <select id={id} className={styles.select} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className={styles.chevron} aria-hidden />
    </span>
  );
}
