import { App } from 'antd';
import { ChevronDown, ChevronRight, Hourglass, ListChecks, PackageX, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useAdminProductsQuery,
  useModerationSummaryQuery,
  useReactivateProductMutation,
  useWholesalerOptionsQuery,
} from '../../features/adminProducts/api/adminProductsQueries';
import type { AdminProductListItem, ProductListTab } from '../../features/adminProducts/model/adminProductTypes';
import { SellerPreviewDialog } from '../../features/adminProducts/ui/SellerPreviewDialog';
import { StopProductDialog } from '../../features/adminProducts/ui/StopProductDialog';
import { useAdminCategoryNames } from '../../features/categories/api/categoryQueries';
import { getApiErrorMessage } from '../../shared/api/apiError';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { PillSelect, type PillOption } from '../../shared/ui/PillSelect/PillSelect';
import { ProductCards, ProductsTable, type RowAction } from './components/ProductsTable';
import { isOutOfStock, PRODUCT_TABS, sortProducts, type Attention, type Channel } from './model/productRows';
import styles from './AdminProductsPage.module.css';

const parseTab = (value: string | null): ProductListTab => (PRODUCT_TABS as readonly string[]).includes(value ?? '') ? (value as ProductListTab) : 'ALL';
const parseChannel = (value: string | null): Channel | undefined => (value === 'cpa' || value === 'site' ? value : undefined);
const parseAttention = (value: string | null): Attention | undefined => (value === 'OUT_OF_STOCK' || value === 'EXPIRY_SOON' ? value : undefined);
const ATTENTION_ICONS = { OUT_OF_STOCK: PackageX, EXPIRY_SOON: Hourglass } as const;

/**
 * «Mahsulotlar va offerlar» (FE-12, ADM-1; admin-mahsulotlar): holat yorliqlari, qidiruv, optovik / kategoriya /
 * kanal filtrlari, «Qoldiq 0» va «Muddat yaqin», bannerlar, jadval (planshetda 3 ustun, telefonda kartalar).
 * Qator menyusi: karta, sotuvchi sifatida ko'rish, offer, to'xtatish (sabab bilan) yoki sotuvga qaytarish.
 */
export default function AdminProductsPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('tab'));
  const shopId = params.get('shop') ?? '';
  const categoryId = params.get('category') ?? '';
  const channel = parseChannel(params.get('channel'));
  const attention = parseAttention(params.get('attention'));
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialog, setDialog] = useState<{ action: RowAction; product: AdminProductListItem } | null>(null);
  const searchId = useId();

  // Joriy manzildan (hook qiymati render paytidagi — ketma-ket ikki o'zgarishda birinchisi yo'qolardi).
  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const query = useAdminProductsQuery({
    tab, search, page: 1, limit: 100,
    ...(shopId ? { shopId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(channel ? { cpaEnabled: channel === 'cpa' } : {}),
    ...(attention ? { attention } : {}),
  });
  const summary = useModerationSummaryQuery();
  const wholesalers = useWholesalerOptionsQuery();
  const categoryNames = useAdminCategoryNames();
  const reactivate = useReactivateProductMutation();
  const rows = useMemo(() => sortProducts(query.data?.items ?? []), [query.data]);
  const categoryName = (id: string | null) => (id ? categoryNames.get(id) ?? null : null);
  const filtered = Boolean(search.trim() || shopId || categoryId || channel || attention);

  const all = t('products.filter.all');
  const shopOptions: PillOption[] = [{ value: '', label: all }, ...(wholesalers.data ?? []).map((item) => ({ value: item.id, label: item.name }))];
  const categoryOptions: PillOption[] = [{ value: '', label: all }, ...[...categoryNames].map(([value, label]) => ({ value, label }))];
  const channelOptions: PillOption[] = [{ value: '', label: all }, { value: 'cpa', label: t('products.channel.cpa') }, { value: 'site', label: t('products.channel.site') }];

  const counts = summary.data?.byStatus;
  const outOfStock = rows.find(isOutOfStock);
  // Navbatdagi eng eskisi (moderatsiya navbati tartibi bilan bir xil).
  const inReview = rows
    .filter((row) => row.status === 'PENDING_REVIEW')
    .sort((a, b) => (a.submittedAt ?? a.updatedAt).localeCompare(b.submittedAt ?? b.updatedAt))[0];
  const showBanners = tab === 'ALL' && !filtered;
  const footer = phone ? t('products.footerPhone', { count: rows.length }) : t('products.footer', { count: rows.length });

  const onAction = (action: RowAction, product: AdminProductListItem) => {
    if (action !== 'resume') {
      setDialog({ action, product });
      return;
    }
    reactivate.mutate(product.id, {
      onSuccess: () => notification.success({ title: t('stop.resumedToast', { name: product.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 }),
      onError: (error) => notification.error({ title: t('stop.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  const filters = (
    <>
      <PillSelect label={t('products.filter.shop')} value={shopId} onChange={(value) => update({ shop: value })} options={shopOptions} />
      <PillSelect label={t('products.filter.category')} value={categoryId} onChange={(value) => update({ category: value })} options={categoryOptions} />
      <PillSelect label={t('products.filter.channel')} value={channel ?? ''} onChange={(value) => update({ channel: value })} options={channelOptions} />
    </>
  );

  const attentionChips = (
    <div className={styles.attention} role="group" aria-label={t('products.attention')}>
      {(['OUT_OF_STOCK', 'EXPIRY_SOON'] as const).map((key) => {
        const Icon = ATTENTION_ICONS[key];
        const count = key === 'OUT_OF_STOCK' ? summary.data?.outOfStock : summary.data?.expirySoon;
        return (
          <button key={key} type="button" className={styles.chip} aria-pressed={attention === key} onClick={() => update({ attention: attention === key ? undefined : key })}>
            <Icon aria-hidden />
            {t(`products.attention.${key}`)}
            <span className={styles.count}>{count ?? 0}</span>
          </button>
        );
      })}
    </div>
  );

  const emptyState = () => {
    if (tab === 'BLOCKED' && !filtered) {
      return <Empty title={t('products.noBlockedTitle')} text={t('products.noBlockedText')} actions={<button type="button" className={styles.secondary} onClick={() => update({ tab: undefined })}>{t('products.showAll')}</button>} />;
    }
    if (filtered || tab !== 'ALL') {
      const title = search.trim() ? t('products.noResultsTitle', { query: search.trim() }) : t('products.noResultsFilters');
      return (
        <Empty
          title={title}
          text={t('products.noResultsText')}
          actions={<button type="button" className={styles.secondary} onClick={() => { setSearch(''); update({ q: undefined, shop: undefined, category: undefined, channel: undefined, attention: undefined, tab: undefined }); }}>{t('products.filtersReset')}</button>}
        />
      );
    }
    return (
      <Empty
        title={t('products.emptyTitle')}
        text={t('products.emptyText')}
        actions={(
          <>
            <Link to="/admin/products/new" className={styles.primary}><Plus aria-hidden />{t('products.add')}</Link>
            <Link to="/admin/wholesalers" className={styles.secondary}>{t('products.toWholesalers')}</Link>
          </>
        )}
      />
    );
  };

  return (
    <div className={styles.page} data-layout={phone ? 'phone' : undefined}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={t('products.tabs')}>
          {PRODUCT_TABS.map((key) => (
            <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => update({ tab: key === 'ALL' ? undefined : key })}>
              {t(`products.tab.${key}` as TranslationKey)}
              <span className={styles.count}>{counts?.[key] ?? 0}</span>
            </button>
          ))}
        </div>
        {phone ? null : <Link to="/admin/products/new" className={styles.primary}><Plus aria-hidden />{t('products.add')}</Link>}
      </div>

      <div className={styles.filters}>
        <span className={styles.search}>
          <Search aria-hidden />
          <label htmlFor={searchId} className={styles.visuallyHidden}>{t('products.search')}</label>
          <input
            id={searchId}
            type="search"
            value={search}
            placeholder={t('products.search')}
            onChange={(event) => { setSearch(event.target.value); update({ q: event.target.value.trim() || undefined }); }}
          />
        </span>
        {phone ? (
          <button type="button" className={styles.filtersButton} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal aria-hidden />
            {t('products.filters')}
          </button>
        ) : (
          <>
            {filters}
            <span className={styles.divider} aria-hidden />
            {attentionChips}
          </>
        )}
      </div>
      {phone ? attentionChips : null}

      {showBanners && (outOfStock || inReview) ? (
        <div className={styles.banners}>
          {outOfStock?.stock ? (
            <div className={styles.banner} data-tone="warning" role="note">
              <PackageX aria-hidden />
              <div>
                <p className={styles.bannerTitle}>{t('products.stockBannerTitle', { name: outOfStock.name })}</p>
                <p>
                  {t('products.stockBannerText', { onHand: outOfStock.stock.onHand })}
                  {outOfStock.stock.incoming ? ` ${t('products.stockBannerIncoming', { count: outOfStock.stock.incoming })}` : ''}
                </p>
                <Link to="/admin/inventory" className={styles.bannerLink}>{t('products.stockBannerLink')}<ChevronRight aria-hidden /></Link>
              </div>
            </div>
          ) : null}
          {inReview ? (
            <div className={styles.banner} data-tone="info" role="note">
              <ListChecks aria-hidden />
              <div>
                <p className={styles.bannerTitle}>{t('products.reviewBannerTitle', { name: inReview.name })}</p>
                <p>{t('products.reviewBannerText', { shop: inReview.shop?.name ?? '—', date: tashkentDateTime(inReview.submittedAt ?? inReview.updatedAt) })}</p>
                <Link to={`/admin/moderation?product=${encodeURIComponent(inReview.id)}`} className={styles.bannerLink}>{t('products.reviewBannerLink')}<ChevronRight aria-hidden /></Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} title={t('products.loadError')} />
      ) : query.isPending ? (
        <div className={styles.tableCard} aria-busy="true" data-testid="products-loading">
          {[0, 1, 2, 3].map((index) => <span key={index} className={styles.skeletonRow} />)}
        </div>
      ) : !rows.length ? emptyState() : phone ? (
        <ProductCards rows={rows} categoryName={categoryName} footer={footer} />
      ) : (
        <ProductsTable rows={rows} categoryName={categoryName} onAction={onAction} footer={footer} />
      )}

      <p className={styles.note}>{t('products.note', { time: query.dataUpdatedAt ? tashkentClock(query.dataUpdatedAt) : '—' })}</p>

      <PageActionBar>
        <Link to="/admin/products/new" className={styles.barPrimary}><Plus aria-hidden />{t('products.add')}</Link>
      </PageActionBar>

      {phone ? (
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={t('products.filters')}
          icon={<SlidersHorizontal />}
          footer={(
            <>
              <DialogCancel onClick={() => update({ shop: undefined, category: undefined, channel: undefined })}>{t('products.filtersReset')}</DialogCancel>
              <button type="button" className={styles.barPrimary} onClick={() => setFiltersOpen(false)}>{t('products.filtersApply', { count: rows.length })}</button>
            </>
          )}
        >
          <SheetSelect label={t('products.filter.shop')} value={shopId} options={shopOptions} onChange={(value) => update({ shop: value })} />
          <SheetSelect label={t('products.filter.category')} value={categoryId} options={categoryOptions} onChange={(value) => update({ category: value })} />
          <SheetSelect label={t('products.filter.channel')} value={channel ?? ''} options={channelOptions} onChange={(value) => update({ channel: value })} />
        </Dialog>
      ) : null}

      {dialog?.action === 'stop' ? <StopProductDialog product={dialog.product} onClose={() => setDialog(null)} /> : null}
      {dialog?.action === 'asSeller' ? <SellerPreviewDialog product={dialog.product} categoryName={categoryName(dialog.product.categoryId)} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function Empty({ title, text, actions }: { title: string; text: string; actions: ReactNode }) {
  return (
    <section className={styles.empty} data-testid="products-empty">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className={styles.emptyActions}>{actions}</div>
    </section>
  );
}

function SheetSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly PillOption[]; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className={styles.sheetField}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.sheetSelect}>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </div>
  );
}
