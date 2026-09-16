import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import styles from './DateRangeFilter.module.css';

interface DateRangeFilterProps {
  value: readonly [string, string];
  startLabel: string;
  endLabel: string;
  onChange: (value: [string, string]) => void;
  className?: string;
}

const DATE_FORMAT = 'YYYY-MM-DD';

export function DateRangeFilter({
  value,
  startLabel,
  endLabel,
  onChange,
  className = '',
}: DateRangeFilterProps) {
  const startValue = value[0] ? dayjs(value[0], DATE_FORMAT) : null;
  const endValue = value[1] ? dayjs(value[1], DATE_FORMAT) : null;

  return (
    <div className={`${styles.fields} ${className}`.trim()}>
      <label className={styles.field}>
        <span>{startLabel}</span>
        <DatePicker
          className={styles.picker}
          value={startValue}
          format={DATE_FORMAT}
          placeholder={startLabel}
          maxDate={endValue ?? undefined}
          aria-label={startLabel}
          onChange={(_, dateString) => onChange([String(dateString), value[1]])}
        />
      </label>
      <label className={styles.field}>
        <span>{endLabel}</span>
        <DatePicker
          className={styles.picker}
          value={endValue}
          format={DATE_FORMAT}
          placeholder={endLabel}
          minDate={startValue ?? undefined}
          aria-label={endLabel}
          onChange={(_, dateString) => onChange([value[0], String(dateString)])}
        />
      </label>
    </div>
  );
}
