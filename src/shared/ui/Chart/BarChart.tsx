import { Tooltip } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { formatMoney } from '../MoneyText/formatMoney';
import { ChartFrame, type ChartAxisPoint } from './ChartFrame';
import { ChartSegment } from './ChartSegment';
import { chartTicks } from './chartScale';
import styles from './Chart.module.css';

/** Navy shkalasi: 1- ko'rsatkich #c9d1e0, 2- #7c859f, 3- #1f2853 (komponentlar-E §23). */
export type ChartTone = 'light' | 'mid' | 'dark';

export interface ChartSeries {
  key: string;
  label: string;
  tone: ChartTone;
  /** Legendadagi izoh: «lid kelgan kun». */
  hint?: string;
  /** Legendadagi jami; berilmasa legenda chizilmaydi. */
  total?: number;
}

export interface ChartPoint extends ChartAxisPoint {
  values: Readonly<Record<string, number>>;
}

interface BarChartProps {
  series: readonly ChartSeries[];
  points: readonly ChartPoint[];
  ariaLabel: string;
  /** Ustma-ust (bitta ustun, tepasida jami) — aks holda kun ichida guruh (3 ko'rsatkichgacha). */
  stacked?: boolean;
  height?: number;
  /** Eng yuqori bo'lak ustida son uchun joy, px. */
  headroom?: number;
  axisWidth?: number;
  axisGap?: number;
  barWidth?: number;
  minWidth?: number;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  /** Legenda ostidagi izoh. */
  note?: ReactNode;
  /** Kunga olib borilsa (telefonda bosilsa) — tafsilot. */
  tooltip?: (point: ChartPoint) => ReactNode;
  slotTestId?: string;
}

/** 14 kundan ko'pida ustun ustidagi son va hafta kuni sig'maydi — qiymat jadvalda. */
const DENSE_DAYS = 14;
const PHONE = '(max-width: 767.98px)';

/**
 * Ustunli grafik (komponentlar-E §23). Desktop — legenda o'ngda 220 px, planshet — pastda 3 ustun;
 * telefonda guruh sig'maydi — «Ko‘rsatkich» segmenti bilan bitta ko'rsatkich (ustun 22, doim #1f2853),
 * pastda «Jami, N kun» rang kvadratisiz.
 */
export function BarChart({
  series,
  points,
  ariaLabel,
  stacked = false,
  height = 180,
  headroom = 0,
  axisWidth = 28,
  axisGap,
  barWidth = stacked ? 24 : 14,
  minWidth,
  formatValue = formatMoney,
  formatTick = formatMoney,
  note,
  tooltip,
  slotTestId,
}: BarChartProps) {
  const { t } = useTranslation();
  const phone = useMediaQuery(PHONE);
  const [metric, setMetric] = useState(series[0]?.key);
  const single = phone && !stacked && series.length > 1;
  const chosen = series.find((item) => item.key === metric) ?? series[0];
  const shown = single && chosen ? [{ ...chosen, tone: 'dark' as const }] : series;
  const plotHeight = single ? 150 : height;
  const width = single ? 22 : barWidth;
  const dense = points.length > DENSE_DAYS;
  const total = (point: ChartPoint) => shown.reduce((sum, item) => sum + (point.values[item.key] ?? 0), 0);
  const max = Math.max(0, ...points.flatMap((point) => (stacked ? [total(point)] : shown.map((item) => point.values[item.key] ?? 0))));
  const ticks = chartTicks(max);
  const y = (value: number) => (value / ticks[ticks.length - 1]) * (plotHeight - headroom);
  const legend = series.every((item) => item.total !== undefined);

  const slot = (point: ChartPoint) => {
    const slotProps = { className: styles.slot, 'data-testid': slotTestId, tabIndex: tooltip ? -1 : undefined };
    const content = stacked ? (
      <div key={point.key} {...slotProps} data-stacked>
        <span className={styles.value}>{formatValue(total(point))}</span>
        <span className={styles.stack} style={{ width }}>
          {[...shown].reverse().map((item) => {
            const value = point.values[item.key] ?? 0;
            return value > 0 ? <span key={item.key} className={styles.fill} data-tone={item.tone} style={{ height: Math.max(2, y(value)) }} /> : null;
          })}
        </span>
      </div>
    ) : (
      <div key={point.key} {...slotProps}>
        {shown.map((item) => {
          const value = point.values[item.key] ?? 0;
          return (
            <span key={item.key} className={styles.bar} style={{ width: `min(${width}px, 30%)` }}>
              {dense ? null : <span className={styles.value}>{formatValue(value)}</span>}
              <span className={styles.fill} data-tone={item.tone} style={{ height: value > 0 ? Math.max(2, y(value)) : 0 }} />
            </span>
          );
        })}
      </div>
    );
    return tooltip ? <Tooltip key={point.key} title={tooltip(point)}>{content}</Tooltip> : content;
  };

  const legendRows = (swatch: boolean) => (
    <ul className={styles.legend}>
      {series.map((item) => (
        <li key={item.key}>
          {swatch ? <span className={styles.swatch} data-tone={item.tone} aria-hidden /> : null}
          <span className={styles.legendText}>
            <span>{item.label}</span>
            {item.hint ? <span>{item.hint}</span> : null}
          </span>
          <span className={styles.legendTotal}>{formatMoney(item.total ?? 0)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <figure className={styles.chart}>
      {single && chosen ? (
        <ChartSegment label={t('chart.metric')} value={chosen.key} onChange={setMetric} options={series.map((item) => ({ value: item.key, label: item.label }))} />
      ) : null}
      <div className={styles.layout}>
        <div className={styles.main} data-scroll={minWidth ? true : undefined}>
          <ChartFrame
            ariaLabel={ariaLabel}
            ticks={ticks}
            y={y}
            height={plotHeight}
            axisWidth={axisWidth}
            axisGap={axisGap}
            formatTick={formatTick}
            points={points}
            dense={dense}
            minWidth={minWidth}
          >
            <div className={styles.bars}>{points.map(slot)}</div>
          </ChartFrame>
        </div>
        {legend && !single ? (
          <div className={styles.side}>
            {legendRows(true)}
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
        ) : null}
      </div>
      {legend && single ? (
        <div className={styles.totals}>
          <p className={styles.totalsTitle}>{t('chart.totalDays', { count: points.length })}</p>
          {legendRows(false)}
          {note ? <p className={styles.note}>{note}</p> : null}
        </div>
      ) : null}
    </figure>
  );
}
