import { Input, Popover, type InputProps } from 'antd';
import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { dotsToIso, isoToDots, maskDateInput } from './dateInput';
import { MonthCalendar } from './MonthCalendar';
import styles from './DateInput.module.css';

type DateInputProps = Omit<InputProps, 'value' | 'onChange' | 'prefix' | 'type' | 'min' | 'max'> & {
  /** «YYYY-MM-DD»; bo'sh yoki chala — `null`. */
  value?: string | null;
  onChange?: (value: string | null) => void;
  min?: string;
  max?: string;
};

/**
 * Sana maydoni (komponentlar-E §21): matn, niqob «kk.oo.yyyy», chapda `Calendar`; bosilganda oy jadvali.
 * Telefonda — tizim tanlagichi (`type="date"`), o'lcham va belgi shu.
 */
export function DateInput({ value = null, onChange, min, max, className, disabled, ...props }: DateInputProps) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const icon = <Calendar className={styles.icon} aria-hidden />;
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);

  if (phone) {
    return (
      <Input
        {...props}
        className={[styles.input, className ?? ''].filter(Boolean).join(' ')}
        type="date"
        prefix={icon}
        value={value ?? ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value || null)}
      />
    );
  }

  const select = (iso: string) => {
    setDraft(null);
    setOpen(false);
    onChange?.(iso);
  };

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      rootClassName={styles.popover}
      content={<MonthCalendar value={value} min={min} max={max} onSelect={select} />}
    >
      <Input
        {...props}
        className={[styles.input, className ?? ''].filter(Boolean).join(' ')}
        prefix={icon}
        inputMode="numeric"
        autoComplete="off"
        placeholder={props.placeholder ?? t('date.placeholder')}
        disabled={disabled}
        aria-haspopup="dialog"
        value={draft ?? isoToDots(value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          props.onKeyDown?.(event);
        }}
        onChange={(event) => {
          const masked = maskDateInput(event.target.value);
          const iso = dotsToIso(masked);
          if (iso && inRange(iso)) {
            setDraft(null);
            onChange?.(iso);
          } else {
            setDraft(masked);
            if (value !== null) onChange?.(null);
          }
        }}
      />
    </Popover>
  );
}
