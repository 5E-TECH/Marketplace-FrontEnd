import { Tooltip } from 'antd';
import { memo } from 'react';
import { formatShortDate } from '../../lib/date';
import styles from './DailyBarChart.module.css';

export interface DailyBarPoint { date: string; value: number; hint?: string }

interface DailyBarChartProps {
  points: DailyBarPoint[];
  /** Grafik nomi — ekran o'quvchi uchun. */
  label: string;
  formatValue: (value: number) => string;
  /** O'q yozuvi uchun qisqa ko'rinish (masalan "54 mln"); berilmasa `formatValue`. */
  formatAxis?: (value: number) => string;
  locale?: string;
}

/** Kunlik ustunli grafik: har kun bitta ustun, ustiga olib borilsa (telefonda bosilsa) qiymati ko'rinadi. */
export const DailyBarChart = memo(function DailyBarChart({ points, label, formatValue, formatAxis = formatValue, locale }: DailyBarChartProps) {
  const max = Math.max(0, ...points.map(({ value }) => value));
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter((index) => index >= 0 && index < points.length);
  const describe = (point: DailyBarPoint) => `${formatShortDate(point.date, locale)}: ${formatValue(point.value)}${point.hint ? ` · ${point.hint}` : ''}`;
  return (
    <figure className={styles.chart} aria-label={label}>
      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden><span>{formatAxis(max)}</span><span>{formatAxis(Math.round(max / 2))}</span><span>0</span></div>
        <div className={styles.bars} role="list" aria-label={label}>
          {points.map((point) => (
            <Tooltip key={point.date} title={describe(point)}>
              <span role="listitem" aria-label={describe(point)} className={styles.slot}>
                <span className={`${styles.bar}${point.value > 0 ? ` ${styles.filled}` : ''}`} style={{ height: max ? `${(point.value / max) * 100}%` : 0 }} />
              </span>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className={styles.xAxis} aria-hidden>
        {ticks.map((index) => <span key={points[index].date}>{formatShortDate(points[index].date, locale)}</span>)}
      </div>
    </figure>
  );
});
