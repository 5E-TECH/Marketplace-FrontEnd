import { App, Dropdown } from 'antd';
import { Eye, ImageIcon, MoreHorizontal, PauseCircle, PlayCircle, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAdminProductQuery, useProductPricingQuery, useProductStockQuery, useReactivateProductMutation } from '../../features/adminProducts/api/adminProductsQueries';
import type { AdminProductListItem, ProductStockSummary } from '../../features/adminProducts/model/adminProductTypes';
import { productBadgeCode } from '../../features/adminProducts/ui/adminProductModerationConfig';
import { ProductAudit } from '../../features/adminProducts/ui/ProductAudit';
import { PriceWorkbench } from '../../features/adminProducts/ui/price/PriceWorkbench';
import { SellerPreviewDialog } from '../../features/adminProducts/ui/SellerPreviewDialog';
import { StopProductDialog } from '../../features/adminProducts/ui/StopProductDialog';
import { useAdminCategoryNames } from '../../features/categories/api/categoryQueries';
import { getApiErrorMessage } from '../../shared/api/apiError';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDay } from '../../shared/lib/tashkentTime';
import { useLeaveGuard } from '../../shared/lib/useLeaveGuard';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { SafeImage } from '../../shared/ui/SafeImage/SafeImage';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import { LandingTab, ScriptTab } from './components/ContentTabs';
import { CreativesTab } from './components/CreativesTab';
import { MainTab } from './components/MainTab';
import { OfferTab } from './components/OfferTab';
import { StockTab } from './components/StockTab';
import styles from './AdminProductDetailPage.module.css';

const CARD_TABS = ['main', 'price', 'offer', 'creatives', 'landing', 'script', 'stock', 'audit'] as const;
type CardTab = (typeof CARD_TABS)[number];
const parseTab = (value: string | null): CardTab => ((CARD_TABS as readonly string[]).includes(value ?? '') ? (value as CardTab) : 'main');

/**
 * Mahsulot kartasi (FE-12, `AdminProductDetailPage`; admin-mahsulot-karta): sarlavha (holat, optovik, kategoriya,
 * slug, sotuvda qachondan), «Sotuvchi sifatida ko'rish», to'xtatish yoki sotuvga qaytarish; yorliqlar — Asosiy,
 * Narx (narx kalkulyatori — alohida karta), Offer, Kreativlar, Landing, Skript, Qoldiq, Audit.
 */
export default function AdminProductDetailPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const { productId } = useParams();
  const [params, setParams] = useSearchParams();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const tab = parseTab(params.get('tab'));
  const query = useAdminProductQuery(productId);
  const stockQuery = useProductStockQuery(productId);
  const pricing = useProductPricingQuery(productId).data;
  const categoryNames = useAdminCategoryNames();
  const reactivate = useReactivateProductMutation();
  const [dialog, setDialog] = useState<'stop' | 'asSeller' | null>(null);
  // Skript va Landing matnlari saqlanmagan bo'lsa — yorliq almashtirish va havolalar so'raydi.
  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<CardTab | null>(null);
  const guard = useLeaveGuard(dirty);
  const product = query.data;
  usePageTitle(product?.name ?? null);

  const stock: ProductStockSummary | null = useMemo(() => {
    const rows = stockQuery.data?.items ?? [];
    if (!rows.length) return null;
    const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
    return { available: sum((row) => row.available), onHand: sum((row) => row.onHand), reserved: sum((row) => row.reserved), incoming: 0 };
  }, [stockQuery.data]);

  if (query.isError) {
    return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('card.loadError')} variant="page" />;
  }
  if (!product) return <div className={styles.loading} aria-busy="true" data-testid="product-loading" />;

  const categoryName = product.categoryId ? categoryNames.get(product.categoryId) ?? null : null;
  const since = product.statusChangedAt ?? product.updatedAt;
  const onSale = product.status === 'ACTIVE' && !product.isBlocked;
  const meta = [product.shop?.name, categoryName, product.slug, t(onSale ? 'card.onSaleSince' : 'card.statusSince', { date: tashkentDay(since) })].filter(Boolean).join(' · ');
  // «Sotuvchi sifatida ko'rish» ro'yxat elementi shaklini kutadi: qoldiq va narx kartaning o'z so'rovlaridan.
  const asListItem: AdminProductListItem = {
    ...product,
    stock,
    listPrice: pricing ? {
      customer: pricing.approvedPrice ?? pricing.calculation.recommended,
      recommended: pricing.approvedPrice === null,
      delivery: pricing.calculation.delivery.visibleCenter,
      deliveryMode: pricing.params.deliveryMode,
    } : null,
  };

  const resume = () => reactivate.mutate(product.id, {
    onSuccess: () => notification.success({ title: t('stop.resumedToast', { name: product.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 }),
    onError: (error) => notification.error({ title: t('stop.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
  });
  const applyTab = (next: CardTab) => {
    const updated = new URLSearchParams(window.location.search);
    if (next === 'main') updated.delete('tab');
    else updated.set('tab', next);
    setDirty(false);
    setParams(updated, { replace: true });
  };
  const setTab = (next: CardTab) => {
    if (next === tab) return;
    if (dirty) setPendingTab(next);
    else applyTab(next);
  };

  /** «⋯»: to'xtatish yoki qayta yoqish; telefonda «Sotuvchi sifatida ko'rish» ham shu yerda (admin-mahsulot-karta.mobil). */
  const menuItems = [
    ...(phone ? [{ key: 'asSeller', icon: <Eye aria-hidden />, label: t('card.asSeller') }] : []),
    ...(product.status === 'ACTIVE'
      ? [product.isBlocked
        ? { key: 'resume', icon: <PlayCircle aria-hidden />, label: t('card.resume') }
        : { key: 'stop', icon: <PauseCircle aria-hidden />, label: t('card.stop'), danger: true }]
      : []),
  ];

  const content: Record<CardTab, () => ReactNode> = {
    main: () => (
      <MainTab
        product={product}
        categoryName={categoryName}
        stock={stock}
        stockUpdatedAt={stockQuery.dataUpdatedAt}
        phone={phone}
        onStop={() => setDialog('stop')}
        onResume={resume}
      />
    ),
    price: () => <section className={styles.priceCard} data-testid="price-tab"><PriceWorkbench product={product} phone={phone} allowChange /></section>,
    offer: () => <OfferTab product={product} stock={stock} onStop={() => setDialog('stop')} onResume={resume} />,
    creatives: () => <CreativesTab product={product} />,
    landing: () => <LandingTab product={product} onDirtyChange={setDirty} />,
    script: () => <ScriptTab product={product} onDirtyChange={setDirty} />,
    stock: () => <StockTab query={stockQuery} stock={stock} />,
    audit: () => <section className={styles.auditCard}><ProductAudit productId={product.id} phone={phone} /></section>,
  };

  return (
    <div className={styles.page}>
      <section className={styles.header} data-testid="product-header">
        <span className={styles.thumb}>
          <ImageIcon aria-hidden />
          {product.images[0] ? <SafeImage src={product.images[0]} alt="" /> : null}
        </span>
        <div className={styles.headerText}>
          <div className={styles.badges}><StatusBadge family="product" code={productBadgeCode(product)} /></div>
          <p>{meta}</p>
        </div>
        <div className={styles.headerActions}>
          {phone ? null : <button type="button" className={styles.secondary} onClick={() => setDialog('asSeller')}><Eye aria-hidden />{t('card.asSeller')}</button>}
          {menuItems.length ? (
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                items: menuItems,
                onClick: ({ key }) => {
                  if (key === 'asSeller') setDialog('asSeller');
                  if (key === 'stop') setDialog('stop');
                  if (key === 'resume') resume();
                },
              }}
            >
              <button type="button" className={styles.moreButton} aria-label={t(phone ? 'card.morePhone' : 'card.more')} title={t(phone ? 'card.morePhone' : 'card.more')}><MoreHorizontal aria-hidden /></button>
            </Dropdown>
          ) : null}
        </div>
      </section>

      <div className={styles.tabs} role="tablist" aria-label={t('card.tabs')}>
        {CARD_TABS.map((key) => (
          <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => setTab(key)}>
            {t(`card.tab.${key}` as TranslationKey)}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={t(`card.tab.${tab}` as TranslationKey)}>{content[tab]()}</div>

      {pendingTab || guard.pending ? (
        <Dialog
          open
          title={t('content.leaveTitle')}
          description={t('content.leaveText')}
          icon={<TriangleAlert />}
          tone="warning"
          onClose={() => { setPendingTab(null); guard.stay(); }}
          testId="leave-dialog"
          footer={(
            <>
              <DialogCancel onClick={() => { setPendingTab(null); guard.stay(); }}>{t('content.stay')}</DialogCancel>
              <DialogPrimary
                danger
                shortcut={false}
                onClick={() => {
                  if (pendingTab) {
                    applyTab(pendingTab);
                    setPendingTab(null);
                  } else {
                    setDirty(false);
                    guard.leave();
                  }
                }}
              >
                {t('content.leave')}
              </DialogPrimary>
            </>
          )}
        >
          {null}
        </Dialog>
      ) : null}
      {dialog === 'stop' ? <StopProductDialog product={asListItem} onClose={() => setDialog(null)} /> : null}
      {dialog === 'asSeller' ? <SellerPreviewDialog product={asListItem} categoryName={categoryName} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
