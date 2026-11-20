import { useMediaQuery } from '../../lib/useMediaQuery';
import { formatMoney } from '../MoneyText/formatMoney';
import { ChartFrame, type ChartAxisPoint } from './ChartFrame';
import { chartTicks } from './chartScale';
import styles from './Chart.module.css';

export interface LinePoint extends ChartAxisPoint {
  value: number;
  /** Bugungi to'liq bo'lmagan kun — ochiq nuqta (izohi sarlavhada: «bugun, 14:00 gacha»). */
  partial?: boolean;
}

interface LineChartProps {
  points: readonly LinePoint[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
}

/** Eng yuqori nuqta ustidagi son uchun joy, px (dizayn: 160 maydonda shkala 137). */
const HEADROOM = 23;

/** Chiziqli grafik — bitta ko'rsatkich trendi (komponentlar-E §23): chiziq #1f2853 2 px, nuqta 10, ustida son. */
export function LineChart({ points, ariaLabel, formatValue = formatMoney }: LineChartProps) {
  const height = useMediaQuery('(max-width: 767.98px)') ? 150 : 160;
  const ticks = chartTicks(Math.max(0, ...points.map((point) => point.value)), false);
  const y = (value: number) => (value / ticks[ticks.length - 1]) * (height - HEADROOM);
  const x = (index: number) => ((index + 0.5) / points.length) * 100;
  return (
    <ChartFrame ariaLabel={ariaLabel} ticks={ticks} y={y} height={height} axisWidth={28} formatTick={formatMoney} points={points} dense={points.length > 14}>
      <svg className={styles.line} width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden focusable="false">
        <polyline points={points.map((point, index) => `${x(index)},${height - y(point.value)}`).join(' ')} vectorEffect="non-scaling-stroke" />
      </svg>
      {points.map((point, index) => (
        <span key={point.key} aria-hidden>
          <span className={styles.dot} data-partial={point.partial || undefined} style={{ left: `${x(index)}%`, bottom: y(point.value) - 5 }} />
          <span className={`${styles.value} ${styles.dotValue}`} style={{ left: `${x(index)}%`, bottom: y(point.value) + 8 }}>
            {formatValue(point.value)}
          </span>
        </span>
      ))}
    </ChartFrame>
  );
}
