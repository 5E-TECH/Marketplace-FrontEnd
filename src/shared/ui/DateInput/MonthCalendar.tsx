import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { TranslationKey } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';
import { tashkentDate } from '../../lib/tashkentTime';
import { monthGrid } from './dateInput';
import styles from './DateInput.module.css';

interface MonthCalendarProps {
  value: string | null;
  min?: string;
  max?: string;
  onSelect: (iso: string) => void;
}

/** Oy jadvali (komponentlar-E §9): hafta dushanbadan, bugungi kun `aria-current`, chegaradan tashqari o'chiq. */
export function MonthCalendar({ value, min, max, onSelect }: MonthCalendarProps) {
  const { t } = useTranslation();
  const today = tashkentDate();
  const start = value ?? today;
  const [view, setView] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) - 1 });
  const shift = (delta: number) =>
    setView(({ year, month }) => ({ year: year + Math.floor((month + delta) / 12), month: (month + delta + 12) % 12 }));
  const monthName = (index: number) => t(`calendar.month.${index}` as TranslationKey);

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHead}>
        <button type="button" className={styles.nav} aria-label={t('calendar.prev')} title={t('calendar.prev')} onClick={() => shift(-1)}>
          <ChevronLeft aria-hidden />
        </button>
        <span className={styles.calendarTitle} aria-live="polite">{monthName(view.month)} {view.year}</span>
        <button type="button" className={styles.nav} aria-label={t('calendar.next')} title={t('calendar.next')} onClick={() => shift(1)}>
          <ChevronRight aria-hidden />
        </button>
      </div>
      <div className={styles.grid} role="grid">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} className={styles.weekday} aria-hidden>{t(`calendar.weekday.${index}` as TranslationKey)}</span>
        ))}
        {monthGrid(view.year, view.month).map((iso, index) =>
          iso ? (
            <button
              key={iso}
              type="button"
              className={styles.day}
              aria-label={t('calendar.dayAria', { day: Number(iso.slice(8)), month: monthName(view.month).toLocaleLowerCase(), year: view.year })}
              aria-pressed={iso === value}
              aria-current={iso === today ? 'date' : undefined}
              disabled={Boolean((min && iso < min) || (max && iso > max))}
              onClick={() => onSelect(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          ) : (
            <span key={`blank-${index}`} aria-hidden />
          ),
        )}
      </div>
    </div>
  );
}
