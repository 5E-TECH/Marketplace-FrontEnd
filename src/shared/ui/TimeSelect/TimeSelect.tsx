import { Input, Select } from 'antd';
import { Clock } from 'lucide-react';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { timeSlots } from '../DateInput/dateInput';
import styles from '../DateInput/DateInput.module.css';

interface TimeSelectProps {
  id?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  /** Qadam, daqiqa [taklif: 15]. */
  step?: number;
  /** Ruxsat etilgan oraliq, masalan qo'ng'iroq oynasi 09:00–21:00 (3-qoida). */
  from?: string;
  to?: string;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
}

/** Vaqt (komponentlar-E §21): select, chapda `Clock`; telefonda tizim tanlagichi (`type="time"`). */
export function TimeSelect({ id, value = null, onChange, step = 15, from = '00:00', to = '23:59', disabled, placeholder, ...aria }: TimeSelectProps) {
  const phone = useMediaQuery('(max-width: 767.98px)');
  const icon = <Clock className={styles.icon} aria-hidden />;
  if (phone) {
    return (
      <Input
        id={id}
        className={styles.input}
        type="time"
        prefix={icon}
        step={step * 60}
        min={from}
        max={to}
        value={value ?? ''}
        disabled={disabled}
        aria-label={aria['aria-label']}
        onChange={(event) => onChange?.(event.target.value || null)}
      />
    );
  }
  return (
    <Select
      id={id}
      prefix={icon}
      value={value}
      disabled={disabled}
      placeholder={placeholder ?? '--:--'}
      aria-label={aria['aria-label']}
      onChange={(next: string) => onChange?.(next)}
      options={timeSlots(step, from, to).map((slot) => ({ value: slot, label: slot }))}
      popupMatchSelectWidth
      listHeight={264}
    />
  );
}
