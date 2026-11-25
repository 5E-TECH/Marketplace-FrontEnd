import { Link } from 'react-router-dom';
import { useAdminProductsQuery } from '../../../features/adminProducts/api/adminProductsQueries';
import type { AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { productBadgeCode } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import { useAdminCategoryNames } from '../../../features/categories/api/categoryQueries';
import type { WarehouseStockRow } from '../../../features/inbound/model/inboundTypes';
import { useWholesalerStockQuery } from '../../../features/wholesalers/api/wholesalersQueries';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import type { StatusCode } from '../../../shared/ui/StatusBadge/statusConfig';
import styles from '../AdminWholesalerPage.module.css';

type T = ReturnType<typeof useTranslation>['t'];

interface Row {
  product: AdminProductListItem;
  stock: WarehouseStockRow | null;
  onSale: boolean;
}

/** Sotuvdagi (tasdiqlangan, to'xtatilmagan) mahsulot — qoldiq qatorlari; qolganlari «postavka yo'q · sotuvda emas». */
const isOnSale = (product: AdminProductListItem) => product.status === 'ACTIVE' && !product.isBlocked;

function badgeCode(row: Row): StatusCode<'product'> {
  if (row.onSale && (row.stock?.available ?? 0) === 0) return 'OUT_OF_STOCK';
  return productBadgeCode(row.product);
}

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, OUT_OF_STOCK: 1, PENDING_REVIEW: 2, REJECTED: 3, DRAFT: 4, BLOCKED: 5, ARCHIVED: 6 };

function priceLine(product: AdminProductListItem, category: string | null, t: T): string {
  const price = product.listPrice ? t(product.listPrice.recommended ? 'whk.prod.recommended' : 'whk.prod.customer', { amount: formatMoney(product.listPrice.customer) }) : null;
  return [category, price].filter(Boolean).join(' · ');
}

/**
 * «Mahsulotlar» (admin-optovik-karta): mahsulot, holat, bazaviy narx, omborda, bandda, mavjud, yo'lda, sotilgan,
 * qaytgan, brak va «Jami» qatori. Qoldiq — BE-16 `/admin/inventory/stock?shopId`; yo'lda/sotilgan/qaytgan — taklif §6.
 * Planshetda — mahsulot, holat, bazaviy narx, omborda, mavjud, sotilgan; telefonda — ro'yxat.
 */
export function WholesalerProducts({ wholesalerId, phone, limit }: { wholesalerId: string; phone: boolean; limit?: number }) {
  const { t } = useTranslation();
  const products = useAdminProductsQuery({ tab: 'ALL', search: '', page: 1, limit: 100, shopId: wholesalerId });
  const stock = useWholesalerStockQuery(wholesalerId);
  const categories = useAdminCategoryNames();
  if (products.isError) return <LoadError error={products.error} onRetry={() => void products.refetch()} variant="row" />;
  if (products.isPending) return <div className={styles.skeleton} aria-busy="true" style={{ height: 160 }} />;

  const rows: Row[] = products.data.items
    .map((product) => ({ product, stock: stock.data?.find((item) => item.productId === product.id) ?? null, onSale: isOnSale(product) }))
    .sort((a, b) => (STATUS_ORDER[badgeCode(a)] ?? 9) - (STATUS_ORDER[badgeCode(b)] ?? 9));
  const shown = limit ? rows.slice(0, limit) : rows;
  const sum = (pick: (row: Row) => number) => rows.reduce((total, row) => total + (row.onSale ? pick(row) : 0), 0);
  const category = (product: AdminProductListItem) => (product.categoryId ? categories.get(product.categoryId) ?? null : null);
  const statusSub = (row: Row) => (row.onSale ? null : tashkentDateTime(row.product.statusChangedAt ?? row.product.updatedAt) + (row.product.status === 'REJECTED' ? '' : t('whk.prod.since')));

  if (!rows.length) return <p className={styles.muted}>{t('whk.prod.empty')}</p>;

  if (phone) {
    return (
      <ul className={styles.rowList}>
        {shown.map((row) => (
          <li key={row.product.id}>
            <Link to={`/admin/products/${encodeURIComponent(row.product.id)}`} className={styles.rowLink}>
              <span className={styles.rowTop}><span className={styles.rowName}>{row.product.name}</span><StatusBadge family="product" code={badgeCode(row)} /></span>
              <span className={styles.rowSub}>{priceLine(row.product, category(row.product), t)}</span>
              <span className={styles.rowSub}>
                {row.onSale
                  ? t('whk.prod.phoneStock', { available: row.stock?.available ?? 0, onHand: row.stock?.onHand ?? 0, sold: row.product.sales?.sold ?? 0 })
                  : `${t('whk.prod.base', { amount: formatMoney(row.product.basePrice ?? 0) })} · ${t('whk.prod.notOnSale')}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const num = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatMoney(value));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-testid="wholesaler-products">
        <caption className={styles.visuallyHidden}>{t('whk.prod.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('whk.prod.col.product')}</th>
            <th scope="col">{t('whk.prod.col.status')}</th>
            <th scope="col" data-end>{t('whk.prod.col.base')}</th>
            <th scope="col" data-end>{t('whk.prod.col.onHand')}</th>
            <th scope="col" data-end data-wide>{t('whk.prod.col.reserved')}</th>
            <th scope="col" data-end>{t('whk.prod.col.available')}</th>
            <th scope="col" data-end data-wide>{t('whk.prod.col.transit')}</th>
            <th scope="col" data-end>{t('whk.prod.col.sold')}</th>
            <th scope="col" data-end data-wide>{t('whk.prod.col.returned')}</th>
            <th scope="col" data-end data-wide>{t('whk.prod.col.defect')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.product.id}>
              <td>
                <span className={styles.stack}>
                  <Link to={`/admin/products/${encodeURIComponent(row.product.id)}`} className={styles.name}>{row.product.name}</Link>
                  <span className={styles.sub}>{priceLine(row.product, category(row.product), t)}</span>
                </span>
              </td>
              <td>
                <span className={styles.badgeStack}>
                  <StatusBadge family="product" code={badgeCode(row)} />
                  {statusSub(row) ? <span className={styles.sub}>{statusSub(row)}</span> : null}
                </span>
              </td>
              <td data-end>{t('whs.money', { amount: formatMoney(row.product.basePrice ?? 0) })}</td>
              {row.onSale ? (
                <>
                  <td data-end>{num(row.stock?.onHand ?? 0)}</td>
                  <td data-end data-wide>{num(row.stock?.reserved ?? 0)}</td>
                  <td data-end className={styles.strong}>{num(row.stock?.available ?? 0)}</td>
                  <td data-end data-wide>{num(row.product.sales?.inTransit)}</td>
                  <td data-end>{num(row.product.sales?.sold)}</td>
                  <td data-end data-wide>{num(row.product.sales?.returned)}</td>
                  <td data-end data-wide>{num(row.stock?.defect ?? 0)}</td>
                </>
              ) : (
                <td colSpan={7} className={styles.sub}>{t('whk.prod.notOnSaleLong')}</td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>{t('whk.prod.total', { count: rows.length })}</td>
            <td data-end>{num(sum((row) => row.stock?.onHand ?? 0))}</td>
            <td data-end data-wide>{num(sum((row) => row.stock?.reserved ?? 0))}</td>
            <td data-end>{num(sum((row) => row.stock?.available ?? 0))}</td>
            <td data-end data-wide>{num(sum((row) => row.product.sales?.inTransit ?? 0))}</td>
            <td data-end>{num(sum((row) => row.product.sales?.sold ?? 0))}</td>
            <td data-end data-wide>{num(sum((row) => row.product.sales?.returned ?? 0))}</td>
            <td data-end data-wide>{num(sum((row) => row.stock?.defect ?? 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
