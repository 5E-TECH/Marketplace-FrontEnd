import type { UseQueryResult } from '@tanstack/react-query';
import type { AdminInventoryPage, AdminStockItem } from '../../../features/adminInventory/model/adminInventoryTypes';
import type { ProductStockSummary } from '../../../features/adminProducts/model/adminProductTypes';
import { SideCard } from '../../../features/adminProducts/ui/SideCard';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AdminProductDetailPage.module.css';

/**
 * «Qoldiq» yorlig'i (admin-mahsulot-karta 3): sotuvga mavjud, omborda, band va omborlar bo'yicha qatorlar.
 * Admin faqat ko'radi; partiyalar va harakatlar — ombor sahifasida.
 */
export function StockTab({ query, stock }: { query: UseQueryResult<AdminInventoryPage<AdminStockItem>>; stock: ProductStockSummary | null }) {
  const { t } = useTranslation();
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('card.loadError')} />;
  return (
    <SideCard title={t('card.stockTitle')} hint={t('card.stockText')} gap={16} testId="stock-tab">
      {stock ? (
        <>
          <dl className={styles.kpis}>
            <div><dt>{t('card.available')}</dt><dd>{formatMoney(stock.available)}</dd></div>
            <div><dt>{t('card.onHand')}</dt><dd>{formatMoney(stock.onHand)}</dd></div>
            <div><dt>{t('card.reserved')}</dt><dd>{formatMoney(stock.reserved)}</dd></div>
          </dl>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>{t('card.stockTable')}</caption>
              <thead>
                <tr><th>{t('card.warehouse')}</th><th>{t('card.sku')}</th><th>{t('card.onHand')}</th><th>{t('card.reserved')}</th><th>{t('card.available')}</th></tr>
              </thead>
              <tbody>
                {(query.data?.items ?? []).map((row) => (
                  <tr key={`${row.warehouseId}-${row.variantId}`}>
                    <td>{row.warehouseName}</td>
                    <td>{row.sku ?? '—'}</td>
                    <td>{formatMoney(row.onHand)}</td>
                    <td>{formatMoney(row.reserved)}</td>
                    <td>{formatMoney(row.available)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className={styles.muted}>{t('card.noStock')}</p>}
    </SideCard>
  );
}
