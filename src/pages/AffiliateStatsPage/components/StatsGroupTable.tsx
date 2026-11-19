import type { AffiliateStatsRow, AffiliateStream } from '../../../features/affiliate/api/affiliateApi';
import { earningsPerClick, salesRate } from '../../../features/affiliate/lib/statsBreakdown';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { IncomeCell } from './StatsByDay';
import styles from '../AffiliateStatsPage.module.css';

interface StatsGroupTableProps {
  cut: 'STREAM' | 'SUB1';
  rows: readonly AffiliateStatsRow[];
  totals: AffiliateStatsRow;
  streams: readonly AffiliateStream[];
  range: string;
}

const percent = (value: number | null) => (value === null ? '—' : `${value}%`);
const epc = (value: number | null) => (value === null ? '—' : formatMoney(value));

/**
 * «Kesim: Sahifa» va «Kesim: Sub» (sotuvchi-statistika, holatlar §2): har sahifa yoki sub1 qiymati —
 * alohida qator; sahifa kesimida «Sotilish» va «EPC» ham (TZ 9). Qatorlar daromad bo'yicha, ko'pi tepada.
 * Bo'sh sub1 — «sub yo'q» qatori. Raqamlar BE-28 dan, jami — server `totals`.
 */
export function StatsGroupTable({ cut, rows, totals, streams, range }: StatsGroupTableProps) {
  const { t } = useTranslation();
  const byStream = cut === 'STREAM';
  const sorted = [...rows].sort((a, b) => b.incomeHold + b.incomeAvailable - (a.incomeHold + a.incomeAvailable) || b.clicks - a.clicks);
  const title = byStream ? t('sellerStats.byStream.title') : t('sellerStats.bySub.title');
  const caption = byStream ? t('sellerStats.byStream.caption', { range }) : t('sellerStats.bySub.caption', { range });
  const headingId = `stats-by-${cut.toLowerCase()}`;

  return (
    <section className={styles.card} aria-labelledby={headingId} data-testid={headingId}>
      <div className={styles.head}>
        <div>
          <h2 id={headingId}>{title}</h2>
          <p className={styles.muted}>{caption}</p>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{`${title}, ${range}`}</caption>
          <thead>
            <tr>
              <th scope="col">{byStream ? t('sellerStats.byStream.page') : 'sub1'}</th>
              <th scope="col">{t('statsCsv.clicks')}</th>
              <th scope="col">{t('statsCsv.leads')}</th>
              <th scope="col">{t('statsCsv.valid')}</th>
              <th scope="col">{t('statsCsv.confirmed')}</th>
              <th scope="col">{t('statsCsv.delivered')}</th>
              <th scope="col">{t('statsCsv.refused')}</th>
              {byStream ? <th scope="col">{t('sellerStats.byStream.sales')}</th> : null}
              {byStream ? <th scope="col">{t('sellerStats.byStream.epc')}</th> : null}
              <th scope="col">{t('statsCsv.income')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const stream = byStream ? streams.find((item) => item.code === row.key) : undefined;
              return (
                <tr key={row.key || 'no-sub'} data-group={row.key || 'no-sub'}>
                  <th scope="row">
                    {byStream ? <span className={styles.code}>{row.key}</span> : row.key || t('sellerStats.bySub.empty')}
                    {stream ? <span className={styles.cellSub}>{stream.productName}</span> : null}
                  </th>
                  <td>{formatMoney(row.clicks)}</td>
                  <td>{formatMoney(row.leads)}</td>
                  <td>{formatMoney(row.validLeads)}</td>
                  <td>{formatMoney(row.confirmed)}</td>
                  <td>{formatMoney(row.delivered)}</td>
                  <td>{formatMoney(row.refused)}</td>
                  {byStream ? <td>{percent(salesRate(row))}</td> : null}
                  {byStream ? <td>{epc(earningsPerClick(row))}</td> : null}
                  <td><IncomeCell row={row} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr data-group="total">
              <td>{t('sellerStats.byStream.total')}</td>
              <td>{formatMoney(totals.clicks)}</td>
              <td>{formatMoney(totals.leads)}</td>
              <td>{formatMoney(totals.validLeads)}</td>
              <td>{formatMoney(totals.confirmed)}</td>
              <td>{formatMoney(totals.delivered)}</td>
              <td>{formatMoney(totals.refused)}</td>
              {byStream ? <td>{percent(salesRate(totals))}</td> : null}
              {byStream ? <td>{epc(earningsPerClick(totals))}</td> : null}
              <td><IncomeCell row={totals} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={styles.note}>{byStream ? t('sellerStats.byStream.note') : t('sellerStats.bySub.note')}</p>
    </section>
  );
}
