import { Dropdown } from 'antd';
import { ArrowRight, ChevronRight, History, ImageIcon, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { productBadgeCode } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import { useCategoryPolicyHistoryQuery, type PolicyChange } from '../../../features/categories/api/categoryPolicyApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { initials } from '../../../shared/lib/initials';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { modeLabel, panelSourceLabel } from '../model/categoryLabels';
import { byStatus, type CategoryRow, type Resolved } from '../model/categoryRows';
import styles from '../AdminCategoriesPage.module.css';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface CategoryPanelProps {
  row: CategoryRow;
  /** Shu kategoriyaning o'zidagi mahsulotlar. */
  products: readonly AdminProductListItem[];
  /** Telefonda: nom yuqori qatorda, «Tahrirlash» pastki panelda — panel ikki kartaga bo'linadi. */
  phone?: boolean;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}

/**
 * Tanlangan kategoriya (admin-kategoriyalar paneli): daraja va menyudagi o'rni, slug, parametrlar qayerdan kelgani
 * (qalin — o'zida, kulrang — meros), shu kategoriyadagi mahsulotlar va parametrlar tarixi (audit).
 */
export function CategoryPanel({ row, products, phone = false, onEdit, onAddChild, onDelete }: CategoryPanelProps) {
  const { t } = useTranslation();
  const { category } = row;
  const subtitle = row.parent ? t('acat.childOf', { parent: row.parent.name }) : t('acat.topLevel', { index: row.position + 1 });
  const overrides = products.filter((product) => product.listPrice?.deliveryMode && product.listPrice.deliveryMode !== row.mode.value);
  const notes = [
    row.bad.value ? t('acat.note.bad') : null,
    row.expiry.value ? t('acat.note.expiry') : null,
    overrides.length ? t('acat.note.override', { list: overrides.map((product) => t('acat.note.overrideItem', { name: product.name, mode: modeLabel(t, product.listPrice?.deliveryMode).toLowerCase() })).join(', ') }) : null,
  ].filter(Boolean).join(' ');

  const menu = (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'child', icon: <Plus aria-hidden />, label: t('acat.addChild') },
          { key: 'delete', icon: <Trash2 aria-hidden />, label: t('acat.delete'), danger: true },
        ],
        onClick: ({ key }) => (key === 'child' ? onAddChild() : onDelete()),
      }}
    >
      <button type="button" className={phone ? styles.moreBordered : styles.iconButton} aria-label={t('acat.more', { name: category.name })} title={t('acat.more', { name: category.name })}>
        <MoreHorizontal aria-hidden />
      </button>
    </Dropdown>
  );

  const params = (
    <div className={styles.panelColumn}>
      <div>
        <p className={styles.caption}>{t('acat.params')}</p>
        <dl className={styles.params}>
          <Param label={t('acat.param.markup')} value={`+${row.markup.value ?? '—'}%`} resolved={row.markup} t={t} />
          <Param label={t('acat.param.mode')} value={modeLabel(t, row.mode.value)} resolved={row.mode} t={t} />
          <Param label={t('acat.param.center')} value={money(t, row.center.value)} resolved={row.center} t={t} />
          <Param label={t('acat.param.door')} value={money(t, row.door.value)} resolved={row.door} t={t} />
          <Param label={t('acat.param.bad')} value={t(row.bad.value ? 'acat.yes' : 'acat.no')} resolved={row.bad} t={t} />
          <Param label={t('acat.param.expiry')} value={t(row.expiry.value ? 'acat.expiryOn' : 'acat.expiryOff')} resolved={row.expiry} t={t} />
        </dl>
      </div>
      {notes ? <p className={styles.note}>{notes}</p> : null}
    </div>
  );

  const productsAndHistory = (
    <div className={styles.panelColumn}>
      <div>
        <p className={styles.caption}>{t('acat.productsTitle', { count: products.length })}</p>
        {products.length ? (
          <ul className={styles.productList}>
            {byStatus(products).slice(0, 6).map((product) => (
              <li key={product.id}>
                <span className={styles.productMain}>
                  <span className={styles.thumb}>
                    <ImageIcon aria-hidden />
                    {product.images[0] ?? product.imageUrl ? <SafeImage src={product.images[0] ?? product.imageUrl ?? ''} alt="" /> : null}
                  </span>
                  <span className={styles.productText}>
                    <Link to={`/admin/products/${encodeURIComponent(product.id)}`}>{product.name}</Link>
                    {productNote(t, product, row) ? <span>{productNote(t, product, row)}</span> : null}
                  </span>
                </span>
                <StatusBadge family="product" code={productBadgeCode(product)} />
              </li>
            ))}
          </ul>
        ) : <p className={styles.note}>{t('acat.noProducts')}</p>}
        <Link to={`/admin/products?category=${encodeURIComponent(category.id)}`} className={styles.link}>{t('acat.openProducts')}<ChevronRight aria-hidden /></Link>
      </div>
      <PolicyHistory categoryId={category.id} />
    </div>
  );

  if (phone) {
    return (
      <>
        <section className={styles.panel} data-testid="category-panel" aria-label={category.name}>
          <div className={styles.phonePanelHead}>
            <div>
              <p className={styles.panelSubtitle}>{subtitle}</p>
              <span className={styles.slug}>{category.slug || '—'}</span>
            </div>
            {menu}
          </div>
          {params}
        </section>
        <section className={styles.panel} aria-label={t('acat.productsAndHistory', { name: category.name })}>{productsAndHistory}</section>
      </>
    );
  }

  return (
    <section className={styles.panel} data-testid="category-panel" aria-label={category.name}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitle}>
          <h2>{category.name}</h2>
          <p className={styles.panelSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.panelActions}>
          <button type="button" className={styles.smallSecondary} onClick={onEdit}><Pencil aria-hidden />{t('acat.edit')}</button>
          {menu}
        </div>
      </div>
      <span className={styles.slug}>{category.slug || '—'}</span>
      <div className={styles.panelGrid}>
        {params}
        {productsAndHistory}
      </div>
    </section>
  );
}

const money = (t: Translate, value: number | null) => (value === null ? '—' : t('affiliateHome.sum', { amount: formatMoney(value) }));

function Param({ label, value, resolved, t }: { label: string; value: string; resolved: Resolved<unknown>; t: Translate }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className={resolved.source === 'own' ? styles.own : styles.inherited}>{value}</span>
        <span className={styles.src}>{panelSourceLabel(t, resolved)}</span>
      </dd>
    </div>
  );
}

/** Mahsulot ostidagi izoh: yuborilgan sana, rad sababi yoki o'z yetkazish sozlamasi. */
function productNote(t: Translate, product: AdminProductListItem, row: CategoryRow): string | null {
  if (product.status === 'PENDING_REVIEW') {
    const at = product.submittedAt ?? product.statusChangedAt ?? product.updatedAt;
    return t('acat.product.submitted', { date: tashkentDay(at) });
  }
  if (product.status === 'REJECTED' && product.moderationNote) return t('acat.product.reason', { reason: product.moderationNote });
  const mode = product.listPrice?.deliveryMode;
  return mode && mode !== row.mode.value ? t('acat.product.ownMode', { mode: modeLabel(t, mode).toLowerCase() }) : null;
}

const CHANGE_LABEL: Record<PolicyChange['key'], TranslationKey> = {
  markupCapPercent: 'acat.param.markup',
  deliveryMode: 'acat.param.mode',
  visibleCenter: 'acat.history.center',
  visibleAddress: 'acat.history.door',
};

function changeValue(t: Translate, change: PolicyChange, value: PolicyChange['before']): string {
  if (value === null) return t('acat.src.global');
  if (change.key === 'deliveryMode') return modeLabel(t, String(value));
  return change.key === 'markupCapPercent' ? `+${value}%` : money(t, Number(value));
}

/** «O'zgarishlar tarixi»: oxirgi o'zgarish — kim, qachon, nima edi → nima bo'ldi (backend audit yozuvi). */
function PolicyHistory({ categoryId }: { categoryId: string }) {
  const { t } = useTranslation();
  const history = useCategoryPolicyHistoryQuery(categoryId);
  const last = history.data?.[0];
  return (
    <div>
      <p className={styles.caption}>{t('acat.history')}</p>
      {history.isPending ? <span className={styles.lineSkeleton} aria-busy="true" /> : null}
      {history.isError ? <p className={styles.note}>{t('acat.historyError')}</p> : null}
      {history.isSuccess && !last ? <p className={styles.note}>{t('acat.historyEmpty')}</p> : null}
      {last ? (
        <div className={styles.historyEntry}>
          <span className={styles.avatar} aria-hidden>{initials(last.actorName)}</span>
          <div>
            <div className={styles.historyHead}><strong>{shortPersonName(last.actorName)}</strong><span>{tashkentDateTime(last.at)}</span></div>
            {last.changes.map((change) => (
              <div key={change.key}>
                <p className={styles.historyWhat}>{t(CHANGE_LABEL[change.key])}</p>
                <p className={styles.historyValues}>
                  <span className={styles.visuallyHidden}>{t('acat.history.before')}</span>
                  <span className={styles.inherited}>{changeValue(t, change, change.before)}</span>
                  <ArrowRight aria-hidden />
                  <span className={styles.visuallyHidden}>{t('acat.history.after')}</span>
                  <strong>{changeValue(t, change, change.after)}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <Link to="/admin/audit-logs?action=pricing.policy.update" className={styles.link}>{t('acat.historyAll')}<History aria-hidden /></Link>
    </div>
  );
}
