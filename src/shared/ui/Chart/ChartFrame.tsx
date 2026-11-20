import type { ReactNode } from 'react';
import styles from './Chart.module.css';

/** O'q ostidagi kun: «08.01» va hafta kuni yoki «bugun». */
export interface ChartAxisPoint {
  key: string;
  label: string;
  sub?: string;
}

interface ChartFrameProps {
  /** Ekran o'qigich uchun grafikdagi hamma qiymat (§23: `role="img"`). */
  ariaLabel: string;
  ticks: readonly number[];
  /** Qiymatning pastdan balandligi, px. */
  y: (value: number) => number;
  height: number;
  axisWidth: number;
  /** Y o'qi va maydon orasidagi masofa, px. */
  axisGap?: number;
  formatTick: (value: number) => string;
  points: readonly ChartAxisPoint[];
  /** Ko'p kunda (30) hafta kuni yozilmaydi. */
  dense: boolean;
  minWidth?: number;
  children: ReactNode;
}

/** Y o'qi (chapda), to'r chiziqlari, chizma maydoni va X o'qi — ustunli va chiziqli grafik uchun umumiy. */
export function ChartFrame({ ariaLabel, ticks, y, height, axisWidth, axisGap = 8, formatTick, points, dense, minWidth, children }: ChartFrameProps) {
  return (
    <div className={styles.frame} role="img" aria-label={ariaLabel} style={{ minWidth, gap: axisGap }}>
      <div className={styles.yAxis} style={{ flexBasis: axisWidth, height }} aria-hidden>
        {ticks.map((tick) => <span key={tick} style={{ bottom: y(tick) - 9 }}>{formatTick(tick)}</span>)}
      </div>
      <div className={styles.body}>
        <div className={styles.plot} style={{ height }}>
          {ticks.map((tick) => (
            <span key={tick} className={tick === 0 ? styles.baseline : styles.grid} style={{ bottom: y(tick) }} aria-hidden />
          ))}
          {children}
        </div>
        <div className={styles.xAxis} aria-hidden>
          {points.map((point) => (
            <span key={point.key}>
              <strong>{point.label}</strong>
              {dense ? null : point.sub}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
