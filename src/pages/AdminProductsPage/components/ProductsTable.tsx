import { Dropdown } from 'antd';
import { ChevronRight, Eye, ExternalLink, MoreHorizontal, PauseCircle, PlayCircle, SlidersHorizontal, Store } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { productHref, statusMeta } from '../model/productRows';
import { PriceCell, ProductIdentity, ProductThumb, ReasonLine, ResultCell, StatusBadges, StatusCell, StockCell } from './ProductCells';
import styles from '../AdminProductsPage.module.css';

export type RowAction = 'asSeller' | 'stop' | 'resume';

/** Qator menyusi (admin-mahsulotlar 3): karta, sotuvchi sifatida ko'rish, offer, sotuvchi sahifalari, to'xtatish. */
export function RowMenu({ product, onAction }: { product: AdminProductListItem; onAction: (action: RowAction, product: AdminProductListItem) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const label = t('products.menu', { name: product.name });
  const canStop = product.status === 'ACTIVE' && !product.isBlocked;
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'open', icon: <ExternalLink aria-hidden />, label: t('products.menu.open') },
          { key: 'asSeller', icon: <Eye aria-hidden />, label: t('products.menu.asSeller') },
          { key: 'offer', icon: <SlidersHorizontal aria-hidden />, label: t('products.menu.offer') },
          { key: 'pages', icon: <Store aria-hidden />, label: t('products.menu.pages') },
          { type: 'divider' },
          product.isBlocked
            ? { key: 'resume', icon: <PlayCircle aria-hidden />, label: t('products.menu.resume') }
            : { key: 'stop', icon: <PauseCircle aria-hidden />, label: t('products.menu.stop'), danger: true, disabled: !canStop },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'open') void navigate(productHref(product));
          if (key === 'offer') void navigate(`${productHref(product)}?tab=offer`);
          if (key === 'pages') void navigate(`/admin/sellers?product=${encodeURIComponent(product.id)}`);
          if (key === 'asSeller' || key === 'stop' || key === 'resume') onAction(key, product);
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label}>
        <MoreHorizontal aria-hidden />
      </button>
    </Dropdown>
  );
}

interface ProductsTableProps {
  rows: readonly AdminProductListItem[];
  categoryName: (id: string | null) => string | null;
  onAction: (action: RowAction, product: AdminProductListItem) => void;
  footer: string;
}

/**
 * Jadval (admin-mahsulotlar): «Mahsulot · optovik», holat, narx, qoldiq, natija, ⋯. Planshetda (container)
 * holat mahsulot ustuniga tushadi, natija ustuni yashiriladi — u mahsulot kartasida.
 */
export function ProductsTable({ rows, categoryName, onAction, footer }: ProductsTableProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.tableCard} aria-label={t('products.caption')}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>{t('products.caption')}</caption>
          <thead>
            <tr>
              <th>
                <span className={styles.wideOnly}>{t('products.col.product')}</span>
                <span className={styles.narrowOnly}>{t('products.col.productStatus')}</span>
              </th>
              <th className={styles.colStatus}>{t('products.col.status')}</th>
              <th className={styles.colPrice}>{t('products.col.price')}</th>
              <th className={styles.colStock}>{t('products.col.stock')}</th>
              <th className={styles.colResult}>{t('products.col.result')}</th>
              <th className={styles.colActions}><span className={styles.visuallyHidden}>{t('products.col.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => {
              const hasReason = Boolean(product.isBlocked ? product.blockReason : product.status === 'REJECTED' && product.moderationNote);
              return (
                <Fragment key={product.id}>
                  <tr data-testid="product-row" data-has-reason={hasReason || undefined}>
                    <td>
                      <span className={styles.productCell}>
                        <ProductThumb product={product} />
                        <span className={styles.productText}>
                          <ProductIdentity product={product} categoryName={categoryName(product.categoryId)} />
                          <span className={styles.narrowOnly}><StatusCell product={product} /></span>
                        </span>
                      </span>
                    </td>
                    <td className={styles.colStatus}><StatusCell product={product} /></td>
                    <td className={styles.colPrice}><PriceCell product={product} /></td>
                    <td className={styles.colStock}><StockCell product={product} /></td>
                    <td className={styles.colResult}><ResultCell product={product} /></td>
                    <td className={styles.colActions}><RowMenu product={product} onAction={onAction} /></td>
                  </tr>
                  {hasReason ? (
                    <tr className={styles.reasonRow}>
                      <td colSpan={6}><ReasonLine product={product} /></td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.tableFooter}>{footer}<span className={styles.narrowOnly}> {t('products.footerTablet')}</span></p>
    </section>
  );
}

/** Telefon (admin-mahsulotlar.mobil): kartalar — bosilsa mahsulot kartasi; menyu kartaning o'zida (R5). */
export function ProductCards({ rows, categoryName, footer }: Omit<ProductsTableProps, 'onAction'>) {
  const { t } = useTranslation();
  return (
    <section className={styles.cards} aria-label={t('products.caption')}>
      <ul>
        {rows.map((product) => (
          <li key={product.id} data-testid="product-row">
            <ProductCard product={product} categoryName={categoryName(product.categoryId)} />
          </li>
        ))}
      </ul>
      <p className={styles.cardsFooter}>{footer}</p>
    </section>
  );
}

function ProductCard({ product, categoryName }: { product: AdminProductListItem; categoryName: string | null }) {
  const { t } = useTranslation();
  const stock = product.stock;
  // Sotuvdagi mahsulot — qoldiq va lidlar; qolganlari — holat vaqti va postavka.
  const meta = product.status === 'ACTIVE'
    ? [stock ? `${t('products.col.stock')} ${formatMoney(stock.available)}` : t('products.noSupply'), product.results ? `${formatMoney(product.results.leads)} lid` : t('products.noStats').toLocaleLowerCase()].join(' · ')
    : [statusMeta(product, (date) => t('products.since', { date })), stock ? null : t('products.noSupply')].filter(Boolean).join(' · ');
  return (
    <Link to={productHref(product)} className={styles.card} aria-label={product.name}>
      <ProductThumb product={product} />
      <span className={styles.cardBody}>
        <ProductIdentity product={product} categoryName={categoryName} link={false} />
        <StatusBadges product={product} />
        <span className={styles.cardBottom}>
          <span className={styles.meta}>{meta}</span>
          {product.listPrice ? (
            <span className={styles.cardPrice}>
              {product.listPrice.recommended ? <span>{t('products.recommended')} </span> : null}
              {t('products.sum', { amount: formatMoney(product.listPrice.customer) })}
            </span>
          ) : null}
        </span>
        <ReasonLine product={product} />
      </span>
      <ChevronRight className={styles.chevron} aria-hidden />
    </Link>
  );
}
