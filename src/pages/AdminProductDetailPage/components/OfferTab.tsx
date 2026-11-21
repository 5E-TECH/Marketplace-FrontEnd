import { App } from 'antd';
import { ChevronRight, CircleDot, Globe, Image as ImageIcon, PauseCircle, Pencil, PlayCircle, Smartphone, Store, Upload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  useCreativesQuery,
  useOfferContentQuery,
  usePriceDecisionsQuery,
  useProductPricingQuery,
  useUpdateProductMutation,
} from '../../../features/adminProducts/api/adminProductsQueries';
import { offerReadiness } from '../../../features/adminProducts/lib/offerReadiness';
import type { AdminProduct, Creative, ProductStockSummary } from '../../../features/adminProducts/model/adminProductTypes';
import { CreativeDeleteDialogs } from './CreativeDialogsHost';
import { CreativeLibrary, UploadButton } from '../../../features/adminProducts/ui/CreativeLibrary';
import { FeeChangeDialog } from '../../../features/adminProducts/ui/FeeChangeDialog';
import { LandingPreviewDialog, type LandingVariant } from '../../../features/adminProducts/ui/LandingPreviewDialog';
import { ConditionList, InfoRows, SideCard } from '../../../features/adminProducts/ui/SideCard';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { usePhoneActionBar } from '../../../shared/ui/PageActionBar/usePhoneActionBar';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../AdminProductDetailPage.module.css';

/** Sotuvchi ustamaning 85% ini oladi (backend `order-commission.ts`, FE-05 `offerMath`). */
const MARKUP_SHARE = 0.85;

interface OfferTabProps {
  product: AdminProduct;
  stock: ProductStockSummary | null;
  onStop: () => void;
  onResume: () => void;
}

/**
 * «Offer» yorlig'i (admin-offer): offer holati va ochilish shartlari (narx, video, qoldiq — SOT-9),
 * «Qayerda sotiladi», kreativlar kutubxonasi (admin yuklaydi, moderatsiyasiz), landing ko'rinishi va
 * S1/S3 oldindan ko'rish (TC4); o'ngda — sotuvchi haqi, sotuvchi ko'radigan narx, offer natijalari.
 * Upsell juftligi — FE-29 (M2).
 */
export function OfferTab({ product, stock, onStop, onResume }: OfferTabProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = usePhoneActionBar();
  const pricing = useProductPricingQuery(product.id).data;
  const creatives = useCreativesQuery(product.id).data ?? [];
  const content = useOfferContentQuery(product.id).data;
  const decisions = usePriceDecisionsQuery(product.id).data;
  const update = useUpdateProductMutation();
  const [dialog, setDialog] = useState<
    | { kind: 'fee' | 'upload' }
    | { kind: 'where'; cpaEnabled: boolean }
    | { kind: 'preview'; variant: LandingVariant }
    | { kind: 'delete'; creative: Creative }
    | null
  >(null);
  const videos = creatives.filter((item) => item.type === 'VIDEO').length;
  const readiness = offerReadiness(product, { videos, stock: stock?.available ?? null });
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const missing = (['price', 'video', 'stock'] as const).filter((key) => !readiness.conditions[key]).map((key) => t(`aoffer.missing.${key}`)).join(', ');
  const decision = decisions?.[0];
  const approved = pricing?.approvedPrice ?? product.approvedPrice;
  const maxSale = pricing?.maxSalePrice ?? null;
  const markup = approved !== null && maxSale !== null ? maxSale - approved : 0;
  const results = product.results;

  const headline: Record<typeof readiness.state, { badge: ReactNode; title: string; text: string }> = {
    OPEN: { badge: <StatusBadge family="product" code="ACTIVE" />, title: t('aoffer.state.OPEN'), text: t('aoffer.state.OPENText') },
    OUT_OF_STOCK: {
      badge: <><StatusBadge family="product" code="ACTIVE" /><StatusBadge family="product" code="OUT_OF_STOCK" /></>,
      title: t('aoffer.state.OUT_OF_STOCK'),
      text: t('aoffer.state.OUT_OF_STOCKText', { onHand: stock?.onHand ?? 0, reserved: stock?.reserved ?? 0 }),
    },
    CLOSED: { badge: <span className={styles.closedBadge}>{t('aoffer.badge.CLOSED')}</span>, title: t('aoffer.state.CLOSED'), text: t('aoffer.state.CLOSEDText', { missing }) },
    SITE_ONLY: { badge: <span className={styles.closedBadge}>{t('aoffer.badge.SITE_ONLY')}</span>, title: t('aoffer.state.SITE_ONLY'), text: t('aoffer.state.SITE_ONLYText') },
    BLOCKED: { badge: <StatusBadge family="product" code="BLOCKED" />, title: t('aoffer.state.BLOCKED'), text: product.blockReason ?? '' },
    NOT_ACTIVE: { badge: <StatusBadge family="product" code={product.status === 'ACTIVE' ? 'ACTIVE' : product.status} />, title: t('aoffer.state.NOT_ACTIVE'), text: t('aoffer.state.NOT_ACTIVEText') },
  };
  /** Moderatsiyadagi mahsulot (admin-offer holatlar: «Ochilmaydi — Bug'li dazmol») — yopiq offer kabi, pastda moderatsiya sanasi. */
  const pending = product.status === 'PENDING_REVIEW';
  const head = pending && missing ? headline.CLOSED : headline[readiness.state];

  const tiles = [
    {
      ok: readiness.conditions.price,
      title: t(readiness.conditions.price ? 'aoffer.cond.price' : 'aoffer.cond.priceMissing'),
      hint: approved !== null
        ? [product.priceStatus ? t(`status.price.${product.priceStatus}` as TranslationKey) : null, sum(approved), decision ? tashkentDay(decision.createdAt) : null].filter(Boolean).join(' · ')
        : t('aoffer.cond.priceMissingHint', { price: formatMoney(pricing?.calculation.recommended ?? 0) }),
    },
    {
      ok: readiness.conditions.video,
      title: t(readiness.conditions.video ? 'aoffer.cond.video' : 'aoffer.cond.videoMissing'),
      hint: readiness.conditions.video ? t('aoffer.cond.videoHint', { count: videos }) : t('aoffer.cond.videoMissingHint'),
    },
    {
      ok: readiness.conditions.stock,
      title: t(readiness.conditions.stock ? 'aoffer.cond.stock' : 'aoffer.cond.stockMissing'),
      hint: stock ? (readiness.conditions.stock ? t('card.cond.pieces', { count: formatMoney(stock.available) }) : t('aoffer.cond.stockMissingHint')) : t('aoffer.cond.noSupply'),
    },
  ];

  const saveWhere = (cpaEnabled: boolean) => update.mutate({ id: product.id, patch: { cpaEnabled } }, {
    onSuccess: () => {
      notification.success({ title: t('aoffer.whereSaved'), placement: 'bottomRight', duration: 3 });
      setDialog(null);
    },
    onError: (error) => notification.error({ title: t('stop.error'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
  });

  return (
    <>
      <div className={`${styles.columns} ${styles.offerLayout}`}>
        <div className={styles.mainColumn}>
          <SideCard title={t('aoffer.statusTitle')} hint={t('aoffer.statusHint')} gap={16} testId="offer-status">
            <div className={styles.offerHead}>
              <span className={styles.badges}>{head.badge}</span>
              <span>{head.title}</span>
            </div>
            {head.text ? <p className={styles.offerText}>{head.text}</p> : null}
            <div className={styles.tiles}>
              {tiles.map((tile) => <div key={tile.title}><ConditionList items={[tile]} /></div>)}
            </div>
            <div>
              <p className={styles.fieldLabel}>{t('aoffer.where')}</p>
              <div className={styles.segment} role="radiogroup" aria-label={t('aoffer.where')}>
                {([[true, 'aoffer.where.cpa', Store], [false, 'aoffer.where.site', Globe]] as const).map(([value, label, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={product.cpaEnabled === value}
                    disabled={update.isPending}
                    onClick={() => { if (product.cpaEnabled !== value) setDialog({ kind: 'where', cpaEnabled: value }); }}
                  >
                    <Icon aria-hidden />
                    {t(label)}
                  </button>
                ))}
              </div>
              <p className={styles.fieldHint}>{t('aoffer.whereHint')}</p>
            </div>
            {pending ? (
              <div className={styles.offerFoot}>
                <span>{t('aoffer.pendingSince', { date: tashkentDateTime(product.submittedAt ?? product.statusChangedAt ?? product.updatedAt) })}</span>
                <span className={styles.footActions}>
                  <button type="button" className={styles.smallPrimary} onClick={() => setDialog({ kind: 'upload' })}><Upload aria-hidden />{t('aoffer.upload')}</button>
                  <Link to={`/admin/moderation?product=${encodeURIComponent(product.id)}`} className={styles.smallButton}>{t('card.openModeration')}</Link>
                </span>
              </div>
            ) : null}
            {product.status === 'ACTIVE' ? (
              <div className={styles.offerFoot}>
                <span>{t('aoffer.consequences')}</span>
                {product.isBlocked ? (
                  <button type="button" className={styles.smallButton} onClick={onResume}><PlayCircle aria-hidden />{t('aoffer.resume')}</button>
                ) : (
                  <button type="button" className={styles.dangerSoft} onClick={onStop}><PauseCircle aria-hidden />{t('aoffer.stop')}</button>
                )}
              </div>
            ) : null}
          </SideCard>

          <section className={styles.panel} data-testid="creative-library">
            <div className={styles.panelHead}>
              <div>
                <h2>{t('aoffer.library')}</h2>
                <p>{t('aoffer.libraryHint')}</p>
              </div>
              {phone ? null : <UploadButton onClick={() => setDialog({ kind: 'upload' })} />}
            </div>
            <p className={styles.caption}>{t('aoffer.libraryCount', { videos, images: creatives.length - videos })}</p>
            {creatives.length ? (
              <CreativeLibrary
                creatives={creatives}
                view="grid"
                onOpen={(creative) => window.open(creative.url, '_blank', 'noopener,noreferrer')}
                onDelete={(creative) => setDialog({ kind: 'delete', creative })}
              />
            ) : <p className={styles.muted}>{t('aoffer.libraryEmpty')}</p>}
            <p className={styles.fieldHint}>{t('aoffer.libraryNote')}</p>
          </section>

          <section className={styles.panel} data-testid="landing-view">
            <div className={styles.panelHead}>
              <div>
                <h2>{t('aoffer.landing')}</h2>
                <p>{t('aoffer.landingHint')}</p>
              </div>
              <div className={styles.panelActions}>
                <button type="button" className={styles.smallButton} onClick={() => setDialog({ kind: 'preview', variant: 's1' })}><Smartphone aria-hidden />{t('aoffer.preview')}</button>
                <Link to="?tab=landing" className={styles.textLink}>{t('aoffer.landingContent')}<ChevronRight aria-hidden /></Link>
              </div>
            </div>
            {/* Sukut shablon — «Standart» (tanlov 12-savol qaroridan keyin); karta bosilsa — oldindan ko'rish. */}
            <div className={styles.templates}>
              {(['STANDART', 'VIDEO'] as const).map((template) => {
                const current = template === 'STANDART';
                return (
                  <button key={template} type="button" className={styles.template} data-current={current || undefined} onClick={() => setDialog({ kind: 'preview', variant: 's1' })}>
                    <span className={styles.miniLanding} aria-hidden>
                      <span className={styles.miniMedia}>
                        {template === 'VIDEO' ? <PlayCircle /> : <ImageIcon />}
                        {template === 'STANDART' && (product.images[0] ?? product.imageUrl) ? <SafeImage src={product.images[0] ?? product.imageUrl ?? ''} alt="" /> : null}
                      </span>
                      <strong>{product.name}</strong>
                      <strong>{approved !== null ? sum(approved) : '—'}</strong>
                      <span>{pricing ? `+ ${sum(pricing.calculation.delivery.visibleCenter)}` : ''}</span>
                      <span className={styles.miniForm}>{t('aoffer.form')}</span>
                    </span>
                    <span className={styles.templateText}>
                      <span className={styles.templateTitle}>
                        <span className={styles.radioMark} data-checked={current || undefined} aria-hidden />
                        <strong>{t(`aoffer.template.${template}`)}</strong>
                        {current ? <span className={styles.defaultChip}><CircleDot aria-hidden />{t('aoffer.templateDefault')}</span> : null}
                      </span>
                      <span>{t(`aoffer.template.${template}Text`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={styles.fieldHint}>{t('aoffer.landingNote')}</p>
          </section>
        </div>

        <div className={styles.sideColumn}>
          <SideCard title={t('aoffer.fee')} hint={t('aoffer.feeHint')} testId="offer-fee">
            <p className={styles.feeValue}>{product.affiliateFee === null ? '—' : sum(product.affiliateFee)}</p>
            <p className={styles.mutedSmall}>{t('aoffer.feePer')}</p>
            <InfoRows rows={[
              { label: t('aoffer.feeCalc'), value: pricing ? `${formatMoney(pricing.params.adCost)} × ${pricing.params.affiliateCoef}` : '—', sub: t('aoffer.feeCalcHint') },
              {
                label: t('aoffer.feeMax'),
                value: product.affiliateFee !== null && maxSale !== null ? sum(product.affiliateFee + Math.floor(markup * MARKUP_SHARE)) : '—',
                sub: maxSale !== null && product.affiliateFee !== null ? t('aoffer.feeMaxHint', { price: formatMoney(maxSale), fee: formatMoney(product.affiliateFee), markup: formatMoney(markup) }) : null,
              },
              { label: t('aoffer.feeSince'), value: decision ? tashkentDay(decision.createdAt) : '—', sub: decision?.decidedByName ? shortPersonName(decision.decidedByName) : null },
            ]} />
            <button type="button" className={styles.blockButton} disabled={approved === null} onClick={() => setDialog({ kind: 'fee' })}>
              <Pencil aria-hidden />
              {t('aoffer.feeChange')}
            </button>
            <p className={styles.mutedSmall}>{t(approved === null ? 'aoffer.feeLocked' : 'aoffer.feeChangeNote')}</p>
          </SideCard>

          <SideCard
            title={t('aoffer.sellerPrice')}
            hint={pricing ? t('aoffer.sellerPriceHint', { mode: t(`moderation.mode.${pricing.params.deliveryMode}` as TranslationKey) }) : undefined}
            link={{ to: '?tab=price', label: t('card.priceTab') }}
          >
            <InfoRows rows={approved !== null && pricing ? [
              {
                label: t('aoffer.customer'),
                value: `${sum(approved)} + ${sum(pricing.calculation.delivery.visibleCenter)}`,
                sub: t('aoffer.customerTotal', { amount: formatMoney(approved + pricing.calculation.delivery.visibleCenter) }),
              },
              {
                label: t('aoffer.sellerRange'),
                value: maxSale !== null ? `${formatMoney(approved)} – ${sum(maxSale)}` : '—',
                sub: t('aoffer.sellerRangeHint', { percent: pricing.params.markupCapPercent, markup: formatMoney(markup) }),
              },
            ] : [{ label: t('aoffer.customer'), value: '—', sub: t('card.notApprovedPrice') }]} />
          </SideCard>

          <SideCard title={t('aoffer.results')} hint={t('aoffer.resultsHint')} testId="offer-results">
            {results ? (
              <InfoRows rows={[
                { label: t('aoffer.epc'), value: results.epc === null ? '—' : sum(results.epc), sub: results.revenue !== undefined && results.clicks !== undefined ? t('aoffer.epcHint', { revenue: formatMoney(results.revenue), clicks: formatMoney(results.clicks) }) : null },
                { label: t('aoffer.approve'), value: results.approveRate === null ? '—' : `${results.approveRate}%`, sub: results.confirmed !== undefined && results.validLeads !== undefined ? t('aoffer.approveHint', { confirmed: results.confirmed, valid: results.validLeads }) : null },
                { label: t('aoffer.sale'), value: results.saleRate === null ? '—' : `${results.saleRate}%`, sub: results.delivered !== undefined && results.refused !== undefined ? t('aoffer.saleHint', { delivered: results.delivered, refused: results.refused }) : null },
                { label: t('aoffer.clicksLeads'), value: `${formatMoney(results.clicks ?? 0)} · ${formatMoney(results.leads)}`, sub: results.validLeads !== undefined ? t('aoffer.clicksLeadsHint', { valid: results.validLeads }) : null },
                { label: t('aoffer.delivered'), value: formatMoney(results.delivered ?? 0), sub: results.inTransit !== undefined ? t('aoffer.deliveredHint', { count: results.inTransit }) : null },
              ]} />
            ) : <p className={styles.muted}>{t('aoffer.resultsEmpty')}</p>}
          </SideCard>
        </div>

        {dialog?.kind === 'fee' ? <FeeChangeDialog product={product} onClose={() => setDialog(null)} /> : null}
        {dialog?.kind === 'preview' ? (
          <LandingPreviewDialog product={product} creatives={creatives} content={content} pricing={pricing} initialVariant={dialog.variant} onClose={() => setDialog(null)} />
        ) : null}
        {dialog?.kind === 'where' ? (
          <Dialog
            open
            title={t(dialog.cpaEnabled ? 'aoffer.whereBackTitle' : 'aoffer.whereTitle')}
            description={product.name}
            icon={dialog.cpaEnabled ? <Store /> : <Globe />}
            tone={dialog.cpaEnabled ? 'action' : 'warning'}
            locked={update.isPending}
            onClose={() => setDialog(null)}
            testId="where-dialog"
            footer={(
              <>
                <DialogCancel onClick={() => setDialog(null)} disabled={update.isPending}>{t('moderation.cancel')}</DialogCancel>
                <DialogPrimary onClick={() => saveWhere(dialog.cpaEnabled)} saving={update.isPending} savingLabel={t('moderation.saving')} shortcut={false}>{t('aoffer.whereConfirm')}</DialogPrimary>
              </>
            )}
          >
            <p className={styles.dialogText}>{t(dialog.cpaEnabled ? 'aoffer.whereBackText' : 'aoffer.whereText')}</p>
          </Dialog>
        ) : null}
        <CreativeDeleteDialogs
          product={product}
          creatives={creatives}
          upload={dialog?.kind === 'upload'}
          deleting={dialog?.kind === 'delete' ? dialog.creative : null}
          onClose={() => setDialog(null)}
        />
      </div>
      <PageActionBar>
        <button type="button" className={styles.barPrimary} onClick={() => setDialog({ kind: 'upload' })}><Upload aria-hidden />{t('aoffer.upload')}</button>
      </PageActionBar>
    </>
  );
}
