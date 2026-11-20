import { useState } from 'react';
import type { AffiliateStatsRow } from '../../../features/affiliate/api/affiliateApi';
import { statsAxisPoint, statsIncome } from '../../../features/affiliate/lib/statsSummary';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { BarChart, type ChartTone } from '../../../shared/ui/Chart/BarChart';
import { ChartViewToggle, type ChartView } from '../../../shared/ui/Chart/ChartViewToggle';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { ddmmyyyy, signedMoney } from '../model/statsView';
import styles from '../AffiliateStatsPage.module.css';

interface StatsByDayProps {
  /** Davrdagi har kun (bo'sh kun ham), eskisidan yangisiga. */
  days: readonly AffiliateStatsRow[];
  totals: AffiliateStatsRow;
  today: string;
  asOf: string | null;
  range: string;
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Daromad katagi: summa, ostida «ushlab turilgan» (hammasi ushlangan) yoki «N ushlab turilgan» (qismi). */
export function IncomeCell({ row }: { row: AffiliateStatsRow }) {
  const { t } = useTranslation();
  const income = statsIncome(row);
  const sum = t('affiliateHome.sum', { amount: signedMoney(income) });
  return (
    <>
      <span className={income < 0 ? styles.negative : income === 0 ? styles.zero : undefined}>{sum}</span>
      {row.incomeHold > 0 ? (
        <span className={styles.cellSub}>
          {row.incomeAvailable === 0 ? t('sellerStats.byDay.hold') : t('sellerStats.byDay.holdAmount', { amount: formatMoney(row.incomeHold) })}
        </span>
      ) : null}
    </>
  );
}

const SERIES = [
  { field: 'leads', tone: 'light', label: 'statsCsv.leads', hint: 'sellerStats.byDay.leadsLegend' },
  { field: 'confirmed', tone: 'mid', label: 'statsCsv.confirmed', hint: 'sellerStats.byDay.confirmedLegend' },
  { field: 'delivered', tone: 'dark', label: 'statsCsv.delivered', hint: 'sellerStats.byDay.deliveredLegend' },
] as const satisfies readonly { field: 'leads' | 'confirmed' | 'delivered'; tone: ChartTone; label: TranslationKey; hint: TranslationKey }[];

/**
 * «Kunlar bo'yicha» (sotuvchi-statistika): har kun uch ustun — lidlar, tasdiqlangan, yetkazilgan
 * (har son o'z kunida), legenda jami bilan; jadval — yangisi tepada, «Jami, N kun» qatori bilan.
 * Manfiy kun (faqat qaytarish) — qizil, «−» bilan.
 */
export function StatsByDay({ days, totals, today, asOf, range }: StatsByDayProps) {
  const { t } = useTranslation();
  // «Grafik» — grafik va jadval; «Jadval» — faqat jadval (sotuvchi-statistika, komponentlar-E §23).
  const [view, setView] = useState<ChartView>('chart');
  const newestFirst = [...days].reverse();
  const series = SERIES.map((item) => ({ key: item.field, tone: item.tone, label: t(item.label), hint: t(item.hint), total: totals[item.field] }));
  const points = days.map((day) => ({
    ...statsAxisPoint(day.key, today, t),
    values: { leads: day.leads, confirmed: day.confirmed, delivered: day.delivered },
  }));
  const values = points.map((point) => `${point.label}: ${SERIES.map((item) => point.values[item.field]).join(', ')}`).join('; ');

  return (
    <section className={styles.card} aria-labelledby="stats-by-day" data-testid="stats-by-day">
      <div className={styles.head}>
        <div>
          <h2 id="stats-by-day">{t('sellerStats.byDay.title')}</h2>
          <p className={styles.muted}>{t('sellerStats.byDay.caption')}</p>
        </div>
        <ChartViewToggle value={view} onChange={setView} />
      </div>
      {view === 'table' ? null : (
        <div className={styles.byDayChart}>
          <BarChart
            series={series}
            points={points}
            barWidth={18}
            note={t('sellerStats.byDay.legendNote')}
            ariaLabel={`${t('sellerStats.byDay.chartLabel', { leads: totals.leads, confirmed: totals.confirmed, delivered: totals.delivered })}. ${values}`}
          />
        </div>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{t('sellerStats.byDay.tableLabel', { range })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('statsCsv.date')}</th>
              <th scope="col">{t('statsCsv.clicks')}</th>
              <th scope="col">{t('statsCsv.leads')}</th>
              <th scope="col">{t('statsCsv.valid')}</th>
              <th scope="col">{t('statsCsv.confirmed')}</th>
              <th scope="col">{t('statsCsv.delivered')}</th>
              <th scope="col">{t('statsCsv.refused')}</th>
              <th scope="col">{t('statsCsv.income')}</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.map((day) => (
              <tr key={day.key} data-day={day.key}>
                <th scope="row">
                  {ddmmyyyy(day.key)}
                  <span className={styles.cellSub}>
                    {day.key === today && asOf ? t('sellerStats.byDay.todayUntil', { time: asOf }) : t(`sellerHome.weekday${weekday(day.key)}` as TranslationKey)}
                  </span>
                </th>
                <td>{formatMoney(day.clicks)}</td>
                <td>{formatMoney(day.leads)}</td>
                <td>{formatMoney(day.validLeads)}</td>
                <td>{formatMoney(day.confirmed)}</td>
                <td>{formatMoney(day.delivered)}</td>
                <td>{formatMoney(day.refused)}</td>
                <td><IncomeCell row={day} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-day="total">
              <td>{t('sellerStats.byDay.total', { count: days.length })}</td>
              <td>{formatMoney(totals.clicks)}</td>
              <td>{formatMoney(totals.leads)}</td>
              <td>{formatMoney(totals.validLeads)}</td>
              <td>{formatMoney(totals.confirmed)}</td>
              <td>{formatMoney(totals.delivered)}</td>
              <td>{formatMoney(totals.refused)}</td>
              <td><IncomeCell row={totals} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
