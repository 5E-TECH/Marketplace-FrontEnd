import type { AffiliateStatsRow } from '../../../features/affiliate/api/affiliateApi';
import { statsAxisPoint, statsIncome } from '../../../features/affiliate/lib/statsSummary';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { BarChart } from '../../../shared/ui/Chart/BarChart';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateHomePage.module.css';

interface IncomeChartProps {
  /** Eskisidan yangisiga, har kun (bo'sh kun ham). */
  days: AffiliateStatsRow[];
  today: string;
}

/**
 * «Daromad kunlar bo‘yicha» grafigi (sotuvchi-bosh): har kun bitta ustun — pastda «mavjud» (navy),
 * ustida «ushlab turilgan» (kulrang), tepasida summa; maydon 190, shkala 160, o'q 60 px. Ustunga olib
 * borilsa (telefonda bosilsa) tafsilot; jadval — «Jadval» ko'rinishi.
 */
export function IncomeChart({ days, today }: IncomeChartProps) {
  const { t } = useTranslation();
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const axis = (value: number) =>
    value >= 1_000_000
      ? t('sellerHome.millions', { value: Number((value / 1_000_000).toFixed(1)) })
      : value >= 1000
        ? t('sellerHome.thousands', { value: Math.round(value / 1000) })
        : String(value);
  const points = days.map((day) => ({
    ...statsAxisPoint(day.key, today, t),
    values: { incomeAvailable: day.incomeAvailable, incomeHold: day.incomeHold },
  }));
  const byKey = new Map(days.map((day) => [day.key, day]));

  return (
    <BarChart
      stacked
      series={[
        { key: 'incomeAvailable', label: t('sellerHome.available'), tone: 'dark' },
        { key: 'incomeHold', label: t('sellerHome.hold'), tone: 'mid' },
      ]}
      points={points}
      ariaLabel={`${t('sellerHome.chartLabel')}: ${days.map((day, index) => `${points[index].label} — ${formatMoney(statsIncome(day))}`).join('; ')}`}
      height={190}
      headroom={30}
      axisWidth={60}
      axisGap={12}
      minWidth={520}
      formatTick={axis}
      slotTestId="income-bar"
      tooltip={(point) => {
        const day = byKey.get(point.key);
        return day ? (
          <span className={styles.tip}>
            <strong>{point.label} · {money(statsIncome(day))}</strong>
            <span>{t('sellerHome.available')}: {money(day.incomeAvailable)}</span>
            <span>{t('sellerHome.hold')}: {money(day.incomeHold)}</span>
            <span>{t('sellerHome.deliveredOrders', { count: day.delivered })}</span>
          </span>
        ) : null;
      }}
    />
  );
}
