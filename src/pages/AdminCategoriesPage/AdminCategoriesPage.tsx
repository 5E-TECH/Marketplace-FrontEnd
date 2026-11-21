import { App, Dropdown } from 'antd';
import { ArrowUpDown, FolderTree, MoreHorizontal, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAllAdminProductsQuery } from '../../features/adminProducts/api/adminProductsQueries';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import { useCategoryPoliciesQuery, useElchiTariffQuery, useGlobalPolicyQuery } from '../../features/categories/api/categoryPolicyApi';
import { useAdminCategoriesQuery, useReorderCategoriesMutation } from '../../features/categories/api/categoryQueries';
import type { Category } from '../../features/categories/model/categoryTypes';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { CategoryFormDialog } from './components/CategoryFormDialog';
import { CategoryPanel } from './components/CategoryPanel';
import { CategoryPhoneList, CategoryPhoneReorder } from './components/CategoryPhoneList';
import { CategoryTable } from './components/CategoryTable';
import { DeleteCategoryDialog } from './components/DeleteCategoryDialog';
import { applyOrder, categoryRows, flatten, moveInDraft, siblingsOf, type OrderDraft } from './model/categoryRows';
import styles from './AdminCategoriesPage.module.css';

const EXPLAIN = [
  ['acat.param.markup', 'acat.explain.markup'],
  ['acat.col.delivery', 'acat.explain.delivery'],
  ['acat.param.bad', 'acat.explain.bad'],
  ['acat.param.expiry', 'acat.explain.expiry'],
] as const;

const NONE: ReadonlySet<string> = new Set();

/**
 * «Kategoriyalar» (FE-12; admin-kategoriyalar): daraxt-jadval — ustama, yetkazish ko'rinishi, BAD, muddat va ular
 * qayerdan kelgani, tanlangan kategoriya paneli (parametrlar, mahsulotlar, tarix), tartib rejimi (sudrash, ↑ ↓,
 * saqlash yoki bekor qilish), qo'shish, tahrirlash, o'chirish. Planshetda panel jadval ostida; telefonda — kartalar,
 * tafsilot alohida sahifa (`/admin/categories/:categoryId`), asosiy amal pastki panelda.
 */
export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const { categoryId } = useParams();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NONE);
  /** Tartib qoralamasi; `null` — tartib rejimi yopiq. */
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [moved, setMoved] = useState<{ id: string; from: number } | null>(null);
  const [form, setForm] = useState<{ category: Category | null; parentId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const query = useAdminCategoriesQuery();
  const saveOrder = useReorderCategoriesMutation();
  const role = useCurrentUserQuery().data?.role;
  const products = useAllAdminProductsQuery().data;
  const flat = useMemo(() => flatten(query.data ?? []), [query.data]);
  const ids = useMemo(() => flat.map((item) => item.id), [flat]);
  const policies = useCategoryPoliciesQuery(ids);
  const global = useGlobalPolicyQuery().data;
  const tariff = useElchiTariffQuery().data;
  const reorder = draft !== null;
  const tree = useMemo(() => applyOrder(query.data ?? [], draft), [query.data, draft]);
  const context = { policies, global, products: products ?? [] };
  const rows = categoryRows(tree, { ...context, collapsed, search: reorder ? '' : search });
  const allRows = categoryRows(tree, { ...context, collapsed: NONE, search: '' });
  const requestedId = categoryId ?? params.get('category');
  const selected = allRows.find((row) => row.category.id === requestedId) ?? (phone ? undefined : rows[0]);
  const productsOf = (category: Category) => (products ?? []).filter((product) => product.categoryId === category.id);
  const placement = phone ? 'top' : 'bottomRight';

  usePageTitle(phone && categoryId ? selected?.category.name ?? null : null);

  const hrefOf = (category: Category) => `/admin/categories/${encodeURIComponent(category.id)}`;
  /** Desktop va planshet: tanlov `?category=` da (telefon tafsiloti manzilidan kelinsa ham shu ko'rinishga o'tadi). */
  const select = (category: Category) => void navigate(`/admin/categories?category=${encodeURIComponent(category.id)}`, { replace: true });

  // ── Tartib ─────────────────────────────────────────────────────────────────
  const original = (category: Category) => siblingsOf(query.data ?? [], category.parentId).findIndex((item) => item.id === category.id);
  const changes = draft ? Object.entries(draft).flatMap(([id, sortOrder]) => {
    const category = flat.find((item) => item.id === id);
    return category && category.sortOrder !== sortOrder ? [{ id, sortOrder }] : [];
  }) : [];
  const movedRow = moved ? allRows.find((row) => row.category.id === moved.id) : undefined;
  const summary = movedRow && moved && movedRow.position !== moved.from
    ? t('acat.reorderSummary', { name: movedRow.category.name, from: moved.from + 1, to: movedRow.position + 1 })
    : changes.length ? t('acat.reorderChanged') : '';
  const move = (category: Category, to: number) => {
    if (!draft) return;
    setMoved((previous) => (previous?.id === category.id ? previous : { id: category.id, from: original(category) }));
    setDraft(moveInDraft(tree, draft, category, to));
  };
  const closeReorder = () => { setDraft(null); setMoved(null); };
  const submitOrder = () => saveOrder.mutate(changes, {
    onSuccess: () => { closeReorder(); notification.success({ title: t('acat.reorderSaved'), placement, duration: 3 }); },
    onError: (error) => notification.error({ title: t('acat.reorderError'), description: getApiErrorMessage(error), placement }),
  });
  const reorderBanner = (
    <div className={styles.reorderNote} role="note">
      <ArrowUpDown aria-hidden />
      <div>
        <p>{t('acat.reorder')}</p>
        <p>{t(phone ? 'acat.reorderHintPhone' : 'acat.reorderHint')}</p>
      </div>
    </div>
  );

  // ── Amallar ────────────────────────────────────────────────────────────────
  const openForm = (category: Category | null, parentId: string | null = null) => setForm({ category, parentId });
  const openDelete = (category: Category) => setDeleting(category);
  const toggle = (category: Category, expanded: boolean) => setCollapsed((previous) => {
    const next = new Set(previous);
    if (expanded) next.add(category.id);
    else next.delete(category.id);
    return next;
  });

  const dialogs = (
    <>
      {form ? (
        <CategoryFormDialog
          key={form.category && policies.get(form.category.id) ? 'ready' : 'loading'}
          category={form.category}
          parentId={form.parentId}
          tree={query.data ?? []}
          layer={form.category ? policies.get(form.category.id) : undefined}
          global={global}
          tariff={tariff}
          canEditPolicy={role === 'SUPERADMIN'}
          phone={phone}
          onClose={() => setForm(null)}
          onSaved={(category, created) => {
            setForm(null);
            setSearch('');
            notification.success({ title: t(created ? 'acat.added' : 'acat.saved', { name: category.name }), placement, duration: 3 });
            if (!phone) select(category);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteCategoryDialog
          category={deleting}
          parent={flat.find((item) => item.id === deleting.parentId) ?? null}
          products={products ? productsOf(deleting) : undefined}
          onClose={() => setDeleting(null)}
          onDeleted={(category) => {
            setDeleting(null);
            notification.success({ title: t('acat.deleted', { name: category.name }), placement, duration: 3 });
            if (phone && categoryId) void navigate('/admin/categories', { replace: true });
          }}
        />
      ) : null}
    </>
  );

  const searchBox = (
    <span className={styles.search}>
      <Search aria-hidden />
      <input type="search" value={search} placeholder={t('acat.search')} aria-label={t('acat.search')} onChange={(event) => setSearch(event.target.value)} />
    </span>
  );
  const counts = t('acat.counts', { categories: flat.length, products: products?.length ?? 0 });
  const legend = (
    <p className={styles.legend}>
      <span className={styles.wideOnly}>{t('acat.legend')}</span>
      <span className={styles.compactOnly}>{t('acat.legendCompact')}</span>
    </p>
  );
  const explain = (
    <section className={styles.explain}>
      <h2>{t('acat.explainTitle')}</h2>
      <p className={styles.explainHint}>{t('acat.explainHint')}</p>
      <dl>
        {EXPLAIN.map(([term, text]) => (
          <div key={term}>
            <dt>{t(term)}</dt>
            <dd>{t(text)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const state = () => {
    if (query.isPending) return <div className={styles.skeleton} aria-busy="true" data-testid="categories-loading" />;
    if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('acat.loadError')} />;
    if (!flat.length) {
      return (
        <section className={styles.empty}>
          <span className={styles.emptyIcon}><FolderTree aria-hidden /></span>
          <p className={styles.emptyTitle}>{t('acat.empty')}</p>
          <p>{t('acat.emptyText')}</p>
          {phone ? null : <button type="button" className={styles.primary} onClick={() => openForm(null)}><Plus aria-hidden />{t('acat.add')}</button>}
        </section>
      );
    }
    if (!rows.length) {
      return (
        <section className={styles.empty}>
          <p className={styles.emptyTitle}>{t('acat.noResults')}</p>
          <p>{t('acat.noResultsText')}</p>
          <button type="button" className={styles.secondary} onClick={() => setSearch('')}>{t('acat.clearSearch')}</button>
        </section>
      );
    }
    return null;
  };

  // ── Telefon ────────────────────────────────────────────────────────────────
  if (phone) {
    if (categoryId) {
      if (!selected) {
        return (
          <div className={styles.page}>
            {state() ?? (
              <section className={styles.empty}>
                <p className={styles.emptyTitle}>{t('acat.notFound')}</p>
                <Link to="/admin/categories" className={styles.link}>{t('acat.back')}</Link>
              </section>
            )}
          </div>
        );
      }
      return (
        <div className={styles.page}>
          <CategoryPanel
            row={selected}
            products={productsOf(selected.category)}
            phone
            onEdit={() => openForm(selected.category)}
            onAddChild={() => openForm(null, selected.category.id)}
            onDelete={() => openDelete(selected.category)}
          />
          <PageActionBar>
            <button type="button" className={styles.barPrimary} onClick={() => openForm(selected.category)}><Pencil aria-hidden />{t('acat.edit')}</button>
          </PageActionBar>
          {dialogs}
        </div>
      );
    }
    if (reorder) {
      return (
        <div className={styles.page}>
          {reorderBanner}
          <CategoryPhoneReorder rows={rows} moved={moved} onMove={move} />
          {summary ? <p className={styles.legend} role="status">{summary}</p> : null}
          <PageActionBar>
            <button type="button" className={styles.barSecondary} disabled={saveOrder.isPending} onClick={closeReorder}>{t('acat.cancel')}</button>
            <button type="button" className={styles.barPrimary} disabled={!changes.length || saveOrder.isPending} onClick={submitOrder}>{t(saveOrder.isPending ? 'moderation.saving' : 'acat.reorderSave')}</button>
          </PageActionBar>
        </div>
      );
    }
    return (
      <div className={styles.page}>
        {searchBox}
        {flat.length ? (
          <div className={styles.phoneCounts}>
            <p>{counts}</p>
            <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: [{ key: 'reorder', icon: <ArrowUpDown aria-hidden />, label: t('acat.reorder') }], onClick: () => setDraft({}) }}>
              <button type="button" className={styles.moreBordered} aria-label={t('acat.moreActions')} title={t('acat.moreActions')}><MoreHorizontal aria-hidden /></button>
            </Dropdown>
          </div>
        ) : null}
        {state() ?? (
          <>
            <CategoryPhoneList rows={rows} global={global} hrefOf={hrefOf} />
            {legend}
            {explain}
          </>
        )}
        <PageActionBar>
          <button type="button" className={styles.barPrimary} disabled={!query.data} onClick={() => openForm(null)}><Plus aria-hidden />{t('acat.add')}</button>
        </PageActionBar>
        {dialogs}
      </div>
    );
  }

  // ── Desktop va planshet ────────────────────────────────────────────────────
  const empty = state();
  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        {searchBox}
        <span className={`${styles.counts} ${styles.wideOnly}`}>{counts}</span>
        {flat.length ? (
          <span className={styles.toolbarActions}>
            <button type="button" className={styles.secondary} aria-pressed={reorder} onClick={() => (reorder ? closeReorder() : setDraft({}))}>
              <ArrowUpDown aria-hidden />{t('acat.reorder')}
            </button>
            <button type="button" className={styles.primary} disabled={reorder} onClick={() => openForm(null)}><Plus aria-hidden />{t('acat.add')}</button>
          </span>
        ) : null}
      </div>
      {empty ?? (
        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            <section className={styles.tableCard} aria-label={t(reorder ? 'acat.reorder' : 'acat.tree')}>
              {reorder ? reorderBanner : null}
              <CategoryTable
                rows={rows}
                global={global}
                selectedId={reorder ? null : selected?.category.id ?? null}
                reorder={reorder}
                onSelect={select}
                onToggle={toggle}
                onEdit={(category) => openForm(category)}
                onAddChild={(category) => openForm(null, category.id)}
                onDelete={openDelete}
                onMove={move}
              />
              {reorder ? (
                <div className={styles.reorderFooter}>
                  <p role="status">{summary}</p>
                  <button type="button" className={styles.secondary} disabled={saveOrder.isPending} onClick={closeReorder}>{t('acat.cancel')}</button>
                  <button type="button" className={styles.primary} disabled={!changes.length || saveOrder.isPending} onClick={submitOrder}>{t(saveOrder.isPending ? 'moderation.saving' : 'acat.reorderSave')}</button>
                </div>
              ) : (
                <p className={`${styles.tableFooter} ${styles.compactOnly}`}>
                  {selected ? t('acat.countsSelected', { counts, name: selected.category.name }) : counts}
                </p>
              )}
            </section>
            {legend}
            {explain}
          </div>
          {reorder ? null : <div className={styles.sideColumn}>
            {selected ? (
              <CategoryPanel
                row={selected}
                products={productsOf(selected.category)}
                onEdit={() => openForm(selected.category)}
                onAddChild={() => openForm(null, selected.category.id)}
                onDelete={() => openDelete(selected.category)}
              />
            ) : <p className={styles.note}>{t('acat.emptySelect')}</p>}
          </div>}
        </div>
      )}
      {dialogs}
    </div>
  );
}
