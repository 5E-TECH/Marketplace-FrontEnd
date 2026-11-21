import { useQueryClient } from '@tanstack/react-query';
import { App, Button } from 'antd';
import { Inbox, ShieldAlert, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getAdminProduct } from '../../features/adminProducts/api/adminProductsApi';
import {
  adminProductKeys,
  useAdminProductQuery,
  useAdminProductsQuery,
  useApproveProductMutation,
  useCreativesQuery,
  useModerationSummaryQuery,
  useProductPricingQuery,
  useRejectProductMutation,
} from '../../features/adminProducts/api/adminProductsQueries';
import { offerReadiness } from '../../features/adminProducts/lib/offerReadiness';
import { formatStamp } from '../../features/adminProducts/lib/productFormat';
import type { AdminProduct, AdminProductListItem } from '../../features/adminProducts/model/adminProductTypes';
import { productBadgeCode } from '../../features/adminProducts/ui/adminProductModerationConfig';
import { ProductAudit } from '../../features/adminProducts/ui/ProductAudit';
import { ProductSubmission } from '../../features/adminProducts/ui/ProductSubmission';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import { useAdminCategoryNames } from '../../features/categories/api/categoryQueries';
import { getApiErrorCode, getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { tashkentDay } from '../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import { ApproveDialog, RejectDialog } from './components/DecisionDialogs';
import { DecisionPanel } from './components/DecisionPanel';
import { ModerationQueue, PhoneQueue, RefreshStatus } from './components/ModerationQueue';
import { decisionProgress, emptyDecision, submittedAt, type DecisionState } from './model/decision';
import styles from './AdminModerationPage.module.css';

const QUEUE = { tab: 'PENDING_REVIEW' as const, search: '', page: 1, limit: 100 };
const POLL_MS = 60_000;

/**
 * «Moderatsiya navbatlari» (FE-12, ADM-1; admin-moderatsiya): mahsulot navbati, optovik yuborgan ma'lumot,
 * tekshiruv va qaror (tasdiqlash yoki sabab bilan rad etish), shu mahsulot auditi. Navbat har 60 soniyada
 * yangilanadi. «Narx» tabi mazmuni — FE-13 (admin-narx). Kreativ va landing moderatsiyasi — karta bo'yicha yo'q.
 * Telefonda navbat ro'yxati va mahsulot alohida sahifa (`/admin/moderation/:productId`).
 */
export default function AdminModerationPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { productId: routeId } = useParams();
  const [params, setParams] = useSearchParams();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const tab = params.get('tab') === 'prices' ? 'prices' : 'products';
  const user = useCurrentUserQuery().data;

  const queue = useAdminProductsQuery(QUEUE, { refetchInterval: POLL_MS });
  const summary = useModerationSummaryQuery({ refetchInterval: POLL_MS });
  const items = useMemo(() => [...(queue.data?.items ?? [])].sort((a, b) => submittedAt(a).localeCompare(submittedAt(b))), [queue.data]);
  const requestedId = routeId ?? params.get('product') ?? undefined;
  const selectedId = tab === 'products' ? requestedId ?? (phone ? undefined : items[0]?.id) : undefined;
  const queued = items.find((item) => item.id === selectedId);
  const direct = useAdminProductQuery(selectedId && !queued && queue.isSuccess ? selectedId : undefined);
  const product: AdminProductListItem | AdminProduct | undefined = queued ?? direct.data;

  const categoryNames = useAdminCategoryNames();
  const creatives = useCreativesQuery(product?.id);
  const pricing = useProductPricingQuery(product?.id);
  const approve = useApproveProductMutation();
  const reject = useRejectProductMutation();

  const [decision, setDecision] = useState<DecisionState>(emptyDecision);
  const [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'reject'; key: number } | null>(null);
  const [decisionFor, setDecisionFor] = useState(selectedId);
  if (decisionFor !== selectedId) {
    setDecisionFor(selectedId);
    setDecision(emptyDecision());
    setConflict(false);
    setDialog(null);
  }

  const hrefOf = (id: string) => (phone ? `/admin/moderation/${encodeURIComponent(id)}` : `/admin/moderation?product=${encodeURIComponent(id)}`);
  const productsCount = summary.data?.productsPending ?? queue.data?.total ?? items.length;
  const pricesCount = summary.data?.pricesPending ?? 0;
  const refresh = () => void Promise.all([queue.refetch(), summary.refetch()]);
  const reloadQueue = () => {
    refresh();
    void navigate('/admin/moderation', { replace: true });
  };

  const setTab = (next: 'products' | 'prices') => {
    const updated = new URLSearchParams(window.location.search);
    updated.delete('product');
    if (next === 'prices') updated.set('tab', 'prices');
    else updated.delete('tab');
    setParams(updated);
  };

  /** Qarordan keyin: navbatdagi keyingi mahsulot (desktop) yoki ro'yxat (telefon). */
  const afterDecision = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    const next = items[index + 1] ?? items[index - 1];
    setDialog(null);
    void navigate(!phone && next && next.id !== id ? hrefOf(next.id) : '/admin/moderation', { replace: true });
  };

  /** 409: boshqa admin qaror qilgan bo'lsa — 8.1 holati; boshqa sabab (shartnoma, og'irlik) — xato xabari. */
  const onDecisionError = async (error: unknown, id: string) => {
    if (getApiErrorCode(error) === 'CONFLICT') {
      const fresh = await client.fetchQuery({ queryKey: adminProductKeys.product(id), queryFn: () => getAdminProduct(id) }).catch(() => null);
      if (fresh && fresh.status !== 'PENDING_REVIEW') {
        setDialog(null);
        setConflict(true);
        return;
      }
    }
    notification.error({ title: t('moderation.productError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
  };

  const confirmApprove = () => {
    if (!product || approve.isPending) return;
    const { id, name, approvedPrice } = product;
    approve.mutate(id, {
      onSuccess: () => {
        const key = `approved-${id}`;
        notification.success({
          key,
          title: t('moderation.approvedToast'),
          description: t(approvedPrice === null ? 'moderation.approvedToastPrice' : 'moderation.approvedToastReady', { name }),
          placement: phone ? 'top' : 'bottomRight',
          duration: 6,
          actions: approvedPrice === null ? (
            <Button size="small" onClick={() => { notification.destroy(key); void navigate('/admin/moderation?tab=prices'); }}>{t('moderation.toPrices')}</Button>
          ) : undefined,
        });
        afterDecision(id);
      },
      onError: (error) => void onDecisionError(error, id),
    });
  };

  const confirmReject = (reason: string) => {
    if (!product || reject.isPending) return;
    const { id, name } = product;
    const shop = product.shop?.name ?? '—';
    reject.mutate({ id, reason }, {
      onSuccess: () => {
        const key = `rejected-${id}`;
        notification.success({
          key,
          title: t('moderation.rejectedToast'),
          description: t('moderation.rejectedToastText', { name, shop }),
          placement: phone ? 'top' : 'bottomRight',
          duration: 6,
          actions: <Button size="small" onClick={() => { notification.destroy(key); void navigate(`/admin/products/${encodeURIComponent(id)}?tab=audit`); }}>{t('moderation.toAudit')}</Button>,
        });
        afterDecision(id);
      },
      onError: (error) => void onDecisionError(error, id),
    });
  };

  const tabs = (
    <div className={styles.tabs} role="tablist" aria-label={t('moderation.tabs')}>
      {([['products', 'moderation.tab.products', productsCount], ['prices', 'moderation.tab.prices', pricesCount]] as const).map(([key, label, count]) => (
        <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => setTab(key)}>
          {t(label)}
          <span className={styles.count}>{count}</span>
        </button>
      ))}
    </div>
  );
  const bannedLink = (
    <Link to="/admin/moderation/banned" className={styles.bannedLink}>
      <ShieldAlert aria-hidden />
      {t('moderation.banned')}
    </Link>
  );
  const status = <RefreshStatus updatedAt={queue.dataUpdatedAt} onRefresh={refresh} refreshing={queue.isFetching} />;

  const pricesPanel = (
    <section className={styles.pricesPanel} data-testid="moderation-prices">
      <span aria-hidden><Tag /></span>
      <h2>{t('moderation.pricesTitle')}</h2>
      <p>{t('moderation.pricesText', { count: pricesCount })}</p>
    </section>
  );

  const queueError = queue.isError ? (
    <LoadError error={queue.error} onRetry={() => void queue.refetch()} lastSuccessAt={queue.dataUpdatedAt} title={t('moderation.loadErrorTitle')} note={t('moderation.loadErrorNote')} />
  ) : null;

  const empty = (
    <section className={styles.empty} data-testid="moderation-empty">
      <span aria-hidden><Inbox /></span>
      <h2>{t('moderation.emptyTitle')}</h2>
      <p>{t('moderation.emptyText')}</p>
      <Link to="/admin/products" className={styles.secondaryButton}>{t('moderation.toProducts')}</Link>
    </section>
  );

  const progress = product ? decisionProgress(product, decision) : null;
  const decided = Boolean(product && product.status !== 'PENDING_REVIEW');
  const locked = conflict || decided;
  const readiness = product
    ? offerReadiness({ ...product, status: 'ACTIVE' }, {
      videos: (creatives.data ?? []).filter((creative) => creative.type === 'VIDEO').length,
      stock: 'stock' in product ? product.stock?.available ?? null : null,
    })
    : null;
  const openDialog = (kind: 'approve' | 'reject') => setDialog({ kind, key: Date.now() });
  const canApprove = Boolean(product && !locked && progress?.complete);

  // Ctrl+Enter — «Mahsulotni tasdiqlash» (desktop; tugmadagi belgi bilan).
  useEffect(() => {
    if (phone || !canApprove || dialog) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        setDialog({ kind: 'approve', key: Date.now() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, canApprove, dialog]);

  const review = product ? (
    <>
      <section className={styles.head} aria-labelledby="product-h">
        {phone ? <p className={styles.position}>{t('moderation.queue.position', { index: Math.max(1, items.findIndex((item) => item.id === product.id) + 1), total: Math.max(items.length, 1) })}</p> : null}
        <h2 id="product-h">
          {product.name} <span>{t(product.moderationNote ? 'moderation.resubmitted' : 'moderation.newProduct')}</span>
        </h2>
        {phone ? <div><StatusBadge family="product" code={productBadgeCode(product)} /></div> : null}
        <dl className={styles.facts}>
          <div>
            <dt>{t('moderation.field.shop')}</dt>
            <dd>{product.shop?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('moderation.field.category')}</dt>
            <dd>{(product.categoryId && categoryNames.get(product.categoryId)) || '—'}</dd>
          </div>
          <div>
            <dt>{t('moderation.field.submitted')}</dt>
            <dd>{formatStamp(product.submittedAt ?? product.updatedAt)}</dd>
          </div>
          {phone ? null : (
            <div>
              <dt>{t('moderation.field.status')}</dt>
              <dd><StatusBadge family="product" code={productBadgeCode(product)} /></dd>
            </div>
          )}
        </dl>
      </section>
      <div className={styles.columns}>
        <section className={styles.productCol} aria-label={t('moderation.section.product')}>
          <p className={styles.strip}><strong>{t('moderation.section.product')}</strong> <span>{t('moderation.section.productHint')}</span></p>
          <div className={styles.productBody}>
            <ProductSubmission
              product={product}
              categoryName={(product.categoryId && categoryNames.get(product.categoryId)) || null}
              creatives={creatives.data ?? []}
              pricing={pricing.data}
              phone={phone}
            />
          </div>
        </section>
        <section className={styles.decisionCol} aria-label={t('moderation.section.decision')} data-testid="moderation-decision">
          <p className={styles.strip}><strong>{t('moderation.section.decision')}</strong> <span>{t('moderation.section.decisionHint')}</span></p>
          <DecisionPanel
            key={product.id}
            product={product}
            state={decision}
            onChange={setDecision}
            onApprove={() => openDialog('approve')}
            onReject={() => openDialog('reject')}
            conflict={locked}
            onReloadQueue={reloadQueue}
            phone={phone}
          />
        </section>
      </div>
      <div className={styles.auditBox}>
        <ProductAudit productId={product.id} phone={phone} />
      </div>

      {dialog?.kind === 'approve' && progress && readiness ? (
        <ApproveDialog
          key={dialog.key}
          open
          product={product}
          total={progress.total}
          readiness={readiness}
          who={user?.name ? shortPersonName(user.name) : '—'}
          date={tashkentDay()}
          saving={approve.isPending}
          onConfirm={confirmApprove}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'reject' && progress ? (
        <RejectDialog
          key={dialog.key}
          open
          product={product}
          unchecked={progress.rules.filter((rule) => !decision.checks[rule.key])}
          initialReason={decision.reason}
          saving={reject.isPending}
          onConfirm={confirmReject}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  ) : selectedId && direct.isError ? (
    <div className={styles.detailState}>
      <LoadError error={direct.error} onRetry={() => void direct.refetch()} title={t('moderation.productError')} />
    </div>
  ) : (
    <div className={styles.detailState} aria-busy="true" data-testid="moderation-loading">
      <span className={styles.skeleton} style={{ width: '46%' }} />
      <span className={styles.skeleton} style={{ width: '100%', height: 64 }} />
      <span className={styles.skeleton} style={{ width: '100%', height: 240 }} />
    </div>
  );

  // ── Telefon: ro'yxat yoki mahsulot sahifasi ───────────────────────────────────
  if (phone) {
    if (!selectedId) {
      return (
        <div className={styles.page} data-layout="phone">
          {tabs}
          {tab === 'prices' ? pricesPanel : queueError ?? (
            <>
              <div className={styles.phoneStatus}>
                <RefreshStatus updatedAt={queue.dataUpdatedAt} onRefresh={refresh} refreshing={queue.isFetching} compact />
              </div>
              {queue.isSuccess && !items.length ? empty : <PhoneQueue items={items} hrefOf={hrefOf} />}
              <div>{bannedLink}</div>
            </>
          )}
        </div>
      );
    }
    return (
      <div className={styles.page} data-layout="phone">
        <div className={styles.phoneDetail}>{review}</div>
        {product && !locked ? (
          <PageActionBar>
            <button type="button" className={styles.barSecondary} onClick={() => openDialog('reject')}>{t('moderation.reject')}</button>
            <button type="button" className={styles.barPrimary} disabled={!progress?.complete} onClick={() => openDialog('approve')}>{t('moderation.approve')}</button>
          </PageActionBar>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        {tabs}
        <div className={styles.toolbarStatus}>
          <span className={styles.toolbarRefresh}>{status}</span>
          <span className={styles.divider} aria-hidden />
          {bannedLink}
        </div>
      </div>
      {tab === 'prices' ? pricesPanel : queueError ?? (queue.isSuccess && !items.length && !requestedId ? empty : (
        <div className={styles.board}>
          <ModerationQueue items={items} loading={queue.isPending} selectedId={selectedId} hrefOf={hrefOf} status={status} />
          <div className={styles.detail}>{review}</div>
        </div>
      ))}
    </div>
  );
}
