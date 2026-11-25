import { App } from 'antd';
import { Archive, CircleX, Clock, PauseCircle, PlayCircle, Pencil, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCreativesQuery, useEditProductMutation, useProductAuditQuery, useProductPricingQuery } from '../../../features/adminProducts/api/adminProductsQueries';
import { offerReadiness } from '../../../features/adminProducts/lib/offerReadiness';
import { workflowConditions } from '../../../features/adminProducts/lib/productConditions';
import { auditChange, formatStamp } from '../../../features/adminProducts/lib/productFormat';
import type { AdminProduct, ProductStockSummary } from '../../../features/adminProducts/model/adminProductTypes';
import { changedFields, formFromProduct } from '../../../features/adminProducts/model/productForm';
import { productBadgeCode } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import { ProductErrorSummary, ProductFormFooter } from '../../../features/adminProducts/ui/form/ProductFormParts';
import { ProductFormSections } from '../../../features/adminProducts/ui/form/ProductFormSections';
import { ProductSubmitDialog } from '../../../features/adminProducts/ui/form/ProductSubmitDialog';
import { useProductForm } from '../../../features/adminProducts/ui/form/useProductForm';
import formStyles from '../../../features/adminProducts/ui/form/ProductForm.module.css';
import { ConditionList, InfoRows, SideCard } from '../../../features/adminProducts/ui/SideCard';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentClock, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../AdminProductDetailPage.module.css';

interface MainTabProps {
  product: AdminProduct;
  stock: ProductStockSummary | null;
  stockUpdatedAt: number;
  phone: boolean;
  onStop: () => void;
  onResume: () => void;
  onArchive: () => void;
  /** Bitta SKU (BE-07 avtomatik) bo'lsa — shtrix-kod va yacheyka «Qoldiq» blokida. */
  sku: { barcode: string | null; cell: string | null } | null;
  /** Saqlanmagan o'zgarish bor — yorliq almashtirish va havolalar so'raydi. */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * «Asosiy» (admin-mahsulot-karta): chapda mahsulot formasi (FE-25, OPT-2 — optovik nomidan admin tahrirlaydi), o'ngda
 * holat va sotuvga chiqish shartlari, narx, qoldiq va oxirgi o'zgarishlar. Qoralama va tuzatilgan rad etilgan mahsulot —
 * shu yerdan moderatsiyaga yuboriladi (…holatlar).
 */
export function MainTab({ product, stock, stockUpdatedAt, phone, onStop, onResume, onArchive, sku, onDirtyChange }: MainTabProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const pricing = useProductPricingQuery(product.id).data;
  const creatives = useCreativesQuery(product.id).data ?? [];
  const audit = useProductAuditQuery(product.id);
  const edit = useEditProductMutation();
  const form = useProductForm(formFromProduct(product));
  const [dialog, setDialog] = useState<'submit' | null>(null);
  const videos = creatives.filter((creative) => creative.type === 'VIDEO').length;
  const readiness = offerReadiness(product, { videos, stock: stock?.available ?? null });
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const since = product.statusChangedAt ?? product.updatedAt;
  const approved = product.status === 'ACTIVE';
  const who = product.statusChangedBy ? ` · ${shortPersonName(product.statusChangedBy)}` : '';
  const toast = phone ? 'top' : 'bottomRight';

  useEffect(() => onDirtyChange(form.dirty), [form.dirty, onDirtyChange]);

  const save = () => {
    if (edit.isPending || !form.validate({ isNew: false, requireCodes: approved && product.cpaEnabled })) return;
    const changes = changedFields(form.values, form.baseline);
    if (!Object.keys(changes).length) {
      form.commit(form.values);
      return;
    }
    edit.mutate({ id: product.id, changes }, {
      onSuccess: (saved) => {
        form.commit(formFromProduct(saved));
        notification.success({ title: t('apf.saved', { name: saved.name }), placement: toast, duration: 4 });
      },
      onError: (error) => {
        if (!form.applyServerError(error)) notification.error({ title: t('apf.saveError'), description: getApiErrorMessage(error), placement: toast });
      },
    });
  };

  const conditions = approved ? [
    { ok: product.shop?.hasContract !== false, title: t(product.shop?.hasContract === false ? 'card.cond.contractMissing' : 'card.cond.contract'), hint: product.shop?.name ?? null },
    { ok: true, title: t('card.cond.approved'), hint: `${tashkentDay(since)}${who}` },
    {
      ok: readiness.conditions.price,
      title: t(readiness.conditions.price ? 'card.cond.price' : 'card.cond.priceMissing'),
      hint: product.approvedPrice === null ? null : `${t(`status.price.${product.priceStatus ?? 'GREEN'}` as TranslationKey)} · ${sum(product.approvedPrice)}`,
    },
    { ok: readiness.conditions.video, title: t(readiness.conditions.video ? 'card.cond.video' : 'card.cond.videoMissing'), hint: t('sellerView.media', { videos, images: creatives.length - videos }) },
    { ok: readiness.conditions.stock, title: t(readiness.conditions.stock ? 'card.cond.stock' : 'card.cond.stockMissing'), hint: stock ? t('card.cond.pieces', { count: formatMoney(stock.available) }) : null },
  ] : workflowConditions(product, pricing, { videos, images: creatives.length - videos, stock: stock?.available ?? null }, form.baseline, t);

  const delivery = pricing?.calculation.delivery.visibleCenter ?? 0;
  const customer = pricing ? pricing.approvedPrice ?? pricing.calculation.recommended : null;
  const priceRows = pricing ? [
    { label: t('card.customerSees'), value: `${sum(customer ?? 0)} + ${sum(delivery)}`, sub: t('card.customerTotal', { amount: formatMoney((customer ?? 0) + delivery) }) },
    { label: t('card.recommendedBase'), value: sum(pricing.calculation.recommendedBase), sub: t('card.recommendedBaseHint') },
    {
      label: t('card.fee'),
      value: product.affiliateFee === null ? '—' : sum(product.affiliateFee),
      sub: t('card.feeHint', { adCost: formatMoney(pricing.params.adCost), coef: pricing.params.affiliateCoef }),
    },
    {
      label: t('card.sellerRange'),
      value: pricing.approvedPrice !== null && pricing.maxSalePrice !== null ? `${formatMoney(pricing.approvedPrice)} – ${sum(pricing.maxSalePrice)}` : '—',
      sub: pricing.approvedPrice === null ? t('card.notApprovedPrice') : t('card.sellerRangeHint', { percent: pricing.params.markupCapPercent }),
    },
  ] : [];

  const rejectedTitle = product.statusChangedBy
    ? t('apf.banner.rejectedTitle', { who: shortPersonName(product.statusChangedBy), when: tashkentDateTime(since) })
    : t('apf.banner.rejectedTitleShort', { when: tashkentDateTime(since) });
  const banner = product.isBlocked
    ? { tone: 'neutral', icon: <PauseCircle aria-hidden />, title: t('card.blockedTitle'), text: product.blockReason }
    : product.status === 'REJECTED'
      ? { tone: 'danger', icon: <CircleX aria-hidden />, title: rejectedTitle, text: product.moderationNote ? t('apf.banner.rejectedText', { reason: product.moderationNote }) : null }
      : product.status === 'PENDING_REVIEW'
        ? { tone: 'warning', icon: <Clock aria-hidden />, title: t('card.inReviewTitle'), text: t('apf.banner.reviewText'), link: true }
        : product.status === 'DRAFT'
          ? { tone: 'neutral', icon: <Pencil aria-hidden />, title: t('apf.banner.draftTitle'), text: t('apf.banner.draftText') }
          : product.status === 'ARCHIVED'
            ? { tone: 'neutral', icon: <Archive aria-hidden />, title: t('apf.banner.archivedTitle', { when: tashkentDateTime(since) }), text: t('apf.banner.archivedText') }
            : null;

  // Rad etilgan: tuzatish saqlangach (`updatedAt` rad etilgandan keyin) qayta yuboriladi; vaqt kelmasa — backend hal qiladi.
  const fixed = !product.statusChangedAt || Date.parse(product.updatedAt) > Date.parse(product.statusChangedAt);
  const submittable = product.status === 'DRAFT' || product.status === 'REJECTED';
  const canSubmit = submittable && !form.dirty && (product.status === 'DRAFT' || fixed);
  const submitHint = form.dirty ? t('apf.side.saveFirst') : product.status === 'DRAFT' ? t('apf.side.draftHint') : fixed ? t('apf.side.resubmitReady') : t('apf.side.resubmitHint');
  const submitLabel = t(product.status === 'REJECTED' ? 'apf.side.resubmit' : 'apf.side.submit');
  const submitButton = (
    <button type="button" className={formStyles.primary} disabled={!canSubmit} onClick={() => setDialog('submit')}>
      <Send aria-hidden />{submitLabel}
    </button>
  );

  return (
    <div className={styles.mainTab}>
      {banner ? (
        <div className={styles.banner} data-tone={banner.tone} role="note">
          {banner.icon}
          <div>
            <p className={styles.bannerTitle}>{banner.title}</p>
            {banner.text ? <p>{banner.text}</p> : null}
            {'link' in banner ? <Link to={`/admin/moderation?product=${encodeURIComponent(product.id)}`} className={styles.inlineLink}>{t('card.openModeration')}</Link> : null}
          </div>
        </div>
      ) : null}
      <div className={`${styles.columns} ${styles.mainLayout}`}>
        <div className={styles.mainColumn}>
          {form.failed ? <ProductErrorSummary errors={form.errors} /> : null}
          <ProductFormSections
            values={form.values}
            errors={form.errors}
            onChange={form.change}
            product={product}
            slugTouched={form.slugTouched}
            onSlugTouched={form.touchSlug}
            phone={phone}
            conflictName={form.conflictName}
          />
          {phone ? null : <ProductFormFooter dirty={form.dirty} saving={edit.isPending} phone={false} onCancel={form.reset} onSave={save} />}
        </div>

        <div className={styles.sideColumn}>
          <SideCard title={t('card.status')} gap={14} testId="card-status">
            <div className={styles.statusLine}>
              <StatusBadge family="product" code={productBadgeCode(product)} />
              <span>{t(approved && !product.isBlocked ? 'card.onSaleSince' : 'card.statusSince', { date: approved ? tashkentDay(since) : tashkentDateTime(since) })}</span>
            </div>
            <div className={styles.statusConditions}><ConditionList caption={t('card.conditions')} items={conditions} /></div>
            {approved ? (
              <div className={styles.statusActions}>
                {product.isBlocked ? (
                  <button type="button" className={styles.smallButton} onClick={onResume}><PlayCircle aria-hidden />{t('card.resume')}</button>
                ) : (
                  <button type="button" className={styles.dangerSoft} onClick={onStop}><PauseCircle aria-hidden />{t('card.stop')}</button>
                )}
                <button type="button" className={styles.plainButton} onClick={onArchive}><Archive aria-hidden />{t('apf.menu.archive')}</button>
              </div>
            ) : product.status === 'PENDING_REVIEW' ? (
              <div className={formStyles.sideActions}>
                <Link to={`/admin/moderation?product=${encodeURIComponent(product.id)}`} className={formStyles.secondary}>{t('card.openModeration')}</Link>
              </div>
            ) : submittable && !phone ? (
              <div className={formStyles.sideActions}>
                {submitButton}
                <p>{submitHint}</p>
              </div>
            ) : submittable ? <p className={formStyles.note}>{submitHint}</p> : null}
          </SideCard>

          <SideCard
            title={t('card.price')}
            hint={pricing ? t('card.priceHint', { mode: t(`moderation.mode.${pricing.params.deliveryMode}` as TranslationKey) }) : undefined}
            link={{ to: `?tab=price`, label: t('card.priceTab') }}
          >
            <InfoRows rows={priceRows} />
          </SideCard>

          <SideCard title={t('card.stock')} hint={stockUpdatedAt ? t('card.stockHint', { time: tashkentClock(stockUpdatedAt) }) : undefined} link={{ to: `?tab=stock`, label: t('card.stockTab') }} testId="card-stock">
            {stock ? (
              <>
                <div className={styles.bigNumber}>
                  <span>{formatMoney(stock.available)}</span>
                  <span>{t('card.available')}</span>
                </div>
                <InfoRows
                  rows={[
                    { label: t('card.onHand'), value: formatMoney(stock.onHand) },
                    { label: t('card.reserved'), value: formatMoney(stock.reserved) },
                    ...(sku?.barcode ? [{ label: t('apf.stock.barcode'), value: sku.barcode }] : []),
                    ...(sku?.cell ? [{ label: t('apf.stock.cell'), value: sku.cell }] : []),
                  ]}
                />
              </>
            ) : <p className={styles.muted}>{t('card.noStock')}</p>}
          </SideCard>

          <SideCard title={t('card.recent')} hint={t('card.recentHint')} link={{ to: `?tab=audit`, label: t('card.auditTab') }}>
            <ul className={styles.recent}>
              {(audit.data ?? []).slice(0, 3).map((entry) => (
                <li key={entry.id}>
                  <span className={styles.avatar} aria-hidden>{(entry.actorName ?? '·').slice(0, 2).toLocaleUpperCase()}</span>
                  <span>
                    <span><strong>{entry.actorName ? shortPersonName(entry.actorName) : t('moderation.audit.system')}</strong> <span>{formatStamp(entry.at)}</span></span>
                    <span>{auditChange(entry, t)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {audit.data && !audit.data.length ? <p className={styles.muted}>{t('moderation.audit.empty')}</p> : null}
          </SideCard>
        </div>
      </div>

      {/* Telefon: pastki panel — sahifa oxirida (qoralama va rad etilgan: o'zgarish bo'lmasa — yuborish). */}
      {phone && !(submittable && !form.dirty) ? <ProductFormFooter dirty={form.dirty} saving={edit.isPending} phone onCancel={form.reset} onSave={save} /> : null}
      {phone && submittable && !form.dirty ? (
        <PageActionBar>
          <div className={formStyles.phoneBar}>
            <div>{submitButton}</div>
            {canSubmit ? null : <p>{product.status === 'REJECTED' ? t('apf.side.resubmitShort') : submitHint}</p>}
          </div>
        </PageActionBar>
      ) : null}

      {dialog === 'submit' ? <ProductSubmitDialog product={product} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
