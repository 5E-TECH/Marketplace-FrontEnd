import { Tooltip } from 'antd';
import type { AffiliateStatsRow } from '../../../features/affiliate/api/affiliateApi';
import { statsIncome } from '../../../features/affiliate/lib/statsSummary';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from './IncomeChart.module.css';

interface IncomeChartProps {
  /** Eskisidan yangisiga, har kun (bo'sh kun ham). */
  days: AffiliateStatsRow[];
  today: string;
}

/** Maydon 190 px; shkala tepasi 160 px da — ustun ustidagi summa sig'ishi uchun (dizayndagidek). */
const SCALE_HEIGHT = 160;

/** O'q uchun «chiroyli» qadam: 1, 2, 2.5, 5 × 10ⁿ, 3–4 bo'lak. */
function niceStep(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max / 3));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (max / (factor * magnitude) <= 4) return factor * magnitude;
  }
  return 10 * magnitude;
}

const dayMonth = (isoDate: string) => `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;

/**
 * «Daromad kunlar bo‘yicha» grafigi (sotuvchi-bosh): har kun bitta ustun — pastda «mavjud»
 * (navy), ustida «ushlab turilgan» (kulrang), tepasida summa. Ustunga olib borilsa (telefonda
 * bosilsa) tafsilot. Ekran o'quvchi uchun butun grafik bitta tavsif; jadval — «Jadval» ko'rinishi.
 */
export function IncomeChart({ days, today }: IncomeChartProps) {
  const { t } = useTranslation();
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const max = Math.max(0, ...days.map(statsIncome));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const axis = (value: number) =>
    value >= 1_000_000
      ? t('sellerHome.millions', { value: Number((value / 1_000_000).toFixed(1)) })
      : value >= 1000
        ? t('sellerHome.thousands', { value: Math.round(value / 1000) })
        : String(value);
  const height = (value: number) => (value / top) * SCALE_HEIGHT;
  const description = `${t('sellerHome.chartLabel')}: ${days.map((day) => `${dayMonth(day.key)} — ${formatMoney(statsIncome(day))}`).join('; ')}`;

  return (
    <figure className={styles.chart}>
      <div className={styles.plotRow} role="img" aria-label={description}>
        <div className={styles.yAxis} aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: height(tick) - 8 }}>{axis(tick)}</span>
          ))}
        </div>
        <div className={styles.plot}>
          {ticks.map((tick) => (
            <span key={tick} className={tick === 0 ? styles.baseline : styles.grid} style={{ bottom: height(tick) }} aria-hidden />
          ))}
          <div className={styles.bars}>
            {days.map((day) => {
              const total = statsIncome(day);
              return (
                <Tooltip
                  key={day.key}
                  title={
                    <span className={styles.tip}>
                      <strong>{dayMonth(day.key)} · {money(total)}</strong>
                      <span>{t('sellerHome.available')}: {money(day.incomeAvailable)}</span>
                      <span>{t('sellerHome.hold')}: {money(day.incomeHold)}</span>
                      <span>{t('sellerHome.deliveredOrders', { count: day.delivered })}</span>
                    </span>
                  }
                >
                  <div className={styles.slot} data-testid="income-bar" tabIndex={-1}>
                    <span className={styles.value}>{formatMoney(total)}</span>
                    {day.incomeHold > 0 ? <span className={styles.hold} style={{ height: height(day.incomeHold) }} /> : null}
                    {day.incomeAvailable > 0 ? (
                      <span className={styles.available} style={{ height: height(day.incomeAvailable) }} data-top={day.incomeHold > 0 ? undefined : 'true'} />
                    ) : null}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
      <div className={styles.xAxis} aria-hidden>
        {days.map((day) => (
          <span key={day.key}>
            <strong>{dayMonth(day.key)}</strong>
            {day.key === today
              ? t('sellerHome.today')
              : t(`sellerHome.dayShort${new Date(`${day.key}T00:00:00Z`).getUTCDay()}` as TranslationKey)}
          </span>
        ))}
      </div>
    </figure>
  );
}
