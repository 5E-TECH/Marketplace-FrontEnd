import { CircleX, Clock, PauseCircle, PlayCircle, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCreativesQuery, useProductAuditQuery, useProductPricingQuery } from '../../../features/adminProducts/api/adminProductsQueries';
import { offerReadiness } from '../../../features/adminProducts/lib/offerReadiness';
import { auditChange, formatStamp } from '../../../features/adminProducts/lib/productFormat';
import type { AdminProduct, ProductStockSummary } from '../../../features/adminProducts/model/adminProductTypes';
import { productBadgeCode } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import { ProductSubmission } from '../../../features/adminProducts/ui/ProductSubmission';
import { ConditionList, InfoRows, SideCard } from '../../../features/adminProducts/ui/SideCard';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentClock, tashkentDay } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../AdminProductDetailPage.module.css';

interface MainTabProps {
  product: AdminProduct;
  categoryName: string | null;
  stock: ProductStockSummary | null;
  stockUpdatedAt: number;
  phone: boolean;
  onStop: () => void;
  onResume: () => void;
}

/**
 * «Asosiy» (admin-mahsulot-karta): chapda optovik yuborgan ma'lumot (tahrirlash formasi — mahsulot qo'shish
 * kartasida), o'ngda holat va sotuvga chiqish shartlari, narx, qoldiq va oxirgi o'zgarishlar.
 */
export function MainTab({ product, categoryName, stock, stockUpdatedAt, phone, onStop, onResume }: MainTabProps) {
  const { t } = useTranslation();
  const pricing = useProductPricingQuery(product.id).data;
  const creatives = useCreativesQuery(product.id).data ?? [];
  const audit = useProductAuditQuery(product.id);
  const videos = creatives.filter((creative) => creative.type === 'VIDEO').length;
  const readiness = offerReadiness(product, { videos, stock: stock?.available ?? null });
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const since = product.statusChangedAt ?? product.updatedAt;
  const approved = product.status === 'ACTIVE';
  const who = product.statusChangedBy ? ` · ${shortPersonName(product.statusChangedBy)}` : '';

  const conditions = [
    { ok: product.shop?.hasContract !== false, title: t(product.shop?.hasContract === false ? 'card.cond.contractMissing' : 'card.cond.contract'), hint: product.shop?.name ?? null },
    { ok: approved, title: t(approved ? 'card.cond.approved' : 'card.cond.notApproved'), hint: approved ? `${tashkentDay(since)}${who}` : t(`status.product.${productBadgeCode(product)}` as TranslationKey) },
    {
      ok: readiness.conditions.price,
      title: t(readiness.conditions.price ? 'card.cond.price' : 'card.cond.priceMissing'),
      hint: product.approvedPrice === null ? null : `${t(`status.price.${product.priceStatus ?? 'GREEN'}` as TranslationKey)} · ${sum(product.approvedPrice)}`,
    },
    { ok: readiness.conditions.video, title: t(readiness.conditions.video ? 'card.cond.video' : 'card.cond.videoMissing'), hint: t('sellerView.media', { videos, images: creatives.length - videos }) },
    { ok: readiness.conditions.stock, title: t(readiness.conditions.stock ? 'card.cond.stock' : 'card.cond.stockMissing'), hint: stock ? t('card.cond.pieces', { count: formatMoney(stock.available) }) : null },
  ];

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

  const banner = product.isBlocked
    ? { tone: 'neutral', icon: <PauseCircle aria-hidden />, title: t('card.blockedTitle'), text: product.blockReason }
    : product.status === 'REJECTED'
      ? { tone: 'danger', icon: <CircleX aria-hidden />, title: t('card.rejectedTitle'), text: product.moderationNote }
      : product.status === 'PENDING_REVIEW'
        ? { tone: 'warning', icon: <Clock aria-hidden />, title: t('card.inReviewTitle'), text: t('card.inReviewText'), link: true }
        : product.status === 'DRAFT'
          ? { tone: 'neutral', icon: <Pencil aria-hidden />, title: t('card.draftTitle'), text: t('card.draftText') }
          : null;

  return (
    <div className={`${styles.columns} ${styles.mainLayout}`}>
      <div className={styles.mainColumn}>
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
        <section className={styles.dataCard} aria-label={t('card.data')}>
          <p className={styles.strip}><strong>{t('card.data')}</strong> <span>{t('card.dataHint')}</span></p>
          <div className={styles.dataBody}>
            <ProductSubmission product={product} categoryName={categoryName} creatives={creatives} pricing={pricing} phone={phone} />
          </div>
        </section>
      </div>

      <div className={styles.sideColumn}>
        <SideCard title={t('card.status')} gap={14} testId="card-status">
          <div className={styles.statusLine}>
            <StatusBadge family="product" code={productBadgeCode(product)} />
            <span>{t(approved && !product.isBlocked ? 'card.onSaleSince' : 'card.statusSince', { date: tashkentDay(since) })}</span>
          </div>
          <div className={styles.statusConditions}><ConditionList caption={t('card.conditions')} items={conditions} /></div>
          {approved ? (
            <div className={styles.statusActions}>
              {product.isBlocked ? (
                <button type="button" className={styles.smallButton} onClick={onResume}><PlayCircle aria-hidden />{t('card.resume')}</button>
              ) : (
                <button type="button" className={styles.dangerSoft} onClick={onStop}><PauseCircle aria-hidden />{t('card.stop')}</button>
              )}
            </div>
          ) : null}
        </SideCard>

        <SideCard
          title={t('card.price')}
          hint={pricing ? t('card.priceHint', { mode: t(`moderation.mode.${pricing.params.deliveryMode}` as TranslationKey) }) : undefined}
          link={{ to: `?tab=price`, label: t('card.priceTab') }}
        >
          <InfoRows rows={priceRows} />
        </SideCard>

        <SideCard title={t('card.stock')} hint={stockUpdatedAt ? t('card.stockHint', { time: tashkentClock(stockUpdatedAt) }) : undefined} link={{ to: `?tab=stock`, label: t('card.stockTab') }}>
          {stock ? (
            <>
              <div className={styles.bigNumber}>
                <span>{formatMoney(stock.available)}</span>
                <span>{t('card.available')}</span>
              </div>
              <InfoRows rows={[{ label: t('card.onHand'), value: formatMoney(stock.onHand) }, { label: t('card.reserved'), value: formatMoney(stock.reserved) }]} />
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
  );
}
