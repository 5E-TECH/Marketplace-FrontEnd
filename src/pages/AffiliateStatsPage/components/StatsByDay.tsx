import type { AffiliateStatsRow } from '../../../features/affiliate/api/affiliateApi';
import { statsIncome } from '../../../features/affiliate/lib/statsSummary';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
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

/**
 * «Kunlar bo'yicha» (sotuvchi-statistika): har kun uch ustun — lidlar, tasdiqlangan, yetkazilgan
 * (har son o'z kunida), legenda jami bilan; jadval — yangisi tepada, «Jami, N kun» qatori bilan.
 * Manfiy kun (faqat qaytarish) — qizil, «−» bilan.
 */
export function StatsByDay({ days, totals, today, asOf, range }: StatsByDayProps) {
  const { t } = useTranslation();
  const max = Math.max(1, ...days.flatMap((day) => [day.leads, day.confirmed, day.delivered]));
  const dense = days.length > 14;
  // Tepada ustun ustidagi son uchun joy qoladi (eng balandi — 85 %).
  const height = (value: number) => `${(value / max) * 85}%`;
  const newestFirst = [...days].reverse();
  const series = [
    { field: 'leads', bar: styles.barLeads, dot: styles.dotLeads, label: 'statsCsv.leads', hint: 'sellerStats.byDay.leadsLegend' },
    { field: 'confirmed', bar: styles.barConfirmed, dot: styles.dotConfirmed, label: 'statsCsv.confirmed', hint: 'sellerStats.byDay.confirmedLegend' },
    { field: 'delivered', bar: styles.barDelivered, dot: styles.dotDelivered, label: 'statsCsv.delivered', hint: 'sellerStats.byDay.deliveredLegend' },
  ] as const satisfies readonly { field: keyof AffiliateStatsRow; label: TranslationKey; hint: TranslationKey; bar: string; dot: string }[];

  return (
    <section className={styles.card} aria-labelledby="stats-by-day" data-testid="stats-by-day">
      <div className={styles.head}>
        <div>
          <h2 id="stats-by-day">{t('sellerStats.byDay.title')}</h2>
          <p className={styles.muted}>{t('sellerStats.byDay.caption')}</p>
        </div>
      </div>
      <div className={styles.chartRow}>
        <div
          className={styles.chart}
          role="img"
          aria-label={t('sellerStats.byDay.chartLabel', { leads: totals.leads, confirmed: totals.confirmed, delivered: totals.delivered })}
        >
          {days.map((day) => (
            <div key={day.key} className={styles.chartDay}>
              {series.map((item) => (
                <span key={item.field} className={`${styles.bar} ${item.bar}`} style={{ height: height(day[item.field]) }}>
                  {dense ? null : <span>{day[item.field]}</span>}
                </span>
              ))}
              <span className={styles.chartAxis} aria-hidden>
                <b>{day.key.slice(8, 10)}.{day.key.slice(5, 7)}</b>
                {dense ? null : day.key === today ? t('sellerHome.today') : t(`sellerHome.dayShort${weekday(day.key)}` as TranslationKey)}
              </span>
            </div>
          ))}
        </div>
        <ul className={styles.chartLegend}>
          {series.map((item) => (
            <li key={item.field}>
              <i className={`${styles.dot} ${item.dot}`} aria-hidden />
              <strong>{t(item.label)}</strong>
              <b>{formatMoney(totals[item.field])}</b>
              <small>{t(item.hint)}</small>
            </li>
          ))}
          <li>
            <span />
            <small>{t('sellerStats.byDay.legendNote')}</small>
          </li>
        </ul>
      </div>
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
