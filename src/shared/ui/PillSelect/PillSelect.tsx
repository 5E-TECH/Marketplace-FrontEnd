import { ChevronDown, X, type LucideIcon } from 'lucide-react';
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
  /**
   * Berilsa va qiymat tanlangan bo'lsa — pill faol (ko'k) va chevron o'rnida «✕» (admin-lidlar «Mahsulot filtrini
   * tozalash»). `clearLabel` — tugma nomi.
   */
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
}

/** «Davr: …», «Kategoriya: …» kabi pill-tanlov (komponentlar-E §4): yorliq ichida, o'ngda chevron; ichida tabiiy `select`. */
export function PillSelect({ label, value, onChange, options, disabled, icon: Icon, onClear, clearLabel, className }: PillSelectProps) {
  const id = useId();
  const active = Boolean(onClear && value);
  return (
    <span className={`${styles.pill} ${className ?? ''}`.trim()} data-icon={Icon ? true : undefined} data-active={active || undefined}>
      {Icon ? <Icon className={styles.icon} aria-hidden /> : null}
      <label htmlFor={id} className={styles.label}>{label}:</label>
      <select id={id} className={styles.select} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {active ? (
        <button type="button" className={styles.clear} aria-label={clearLabel} title={clearLabel} onClick={onClear} disabled={disabled}>
          <X aria-hidden />
        </button>
      ) : <ChevronDown className={styles.chevron} aria-hidden />}
    </span>
  );
}
