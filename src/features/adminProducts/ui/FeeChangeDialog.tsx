import { App } from 'antd';
import { Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { MoneyInput } from '../../../shared/ui/MoneyInput/MoneyInput';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { useChangeAffiliateFeeMutation, useProductPricingQuery } from '../api/adminProductsQueries';
import type { AdminProduct, PriceStatus } from '../model/adminProductTypes';
import { REJECT_REASON_MAX } from './adminProductModerationConfig';
import styles from './FeeChangeDialog.module.css';

/**
 * «Sotuvchi haqini o'zgartirish» (admin-offer 3): hozirgi va yangi haq bilan platforma natijasi (sotilish 70%)
 * va narx holati — `GET …/pricing?affiliateFee=`; saqlash — narx qarori (`POST …/price-decision`, sabab bilan;
 * qizil saqlanmaydi, to'q sariqda superadminga xabar). Yangi haq faqat yangi buyurtmalarga.
 */
/** 0.96, 1.85 — ortiqcha nollarsiz. */
const formatRate = (value: number) => String(Number(value.toFixed(2)));

export function FeeChangeDialog({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const feeId = useId();
  const reasonId = useId();
  const change = useChangeAffiliateFeeMutation();
  const [fee, setFee] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const current = useProductPricingQuery(product.id).data;
  const proposed = useProductPricingQuery(product.id, { affiliateFee: fee ?? undefined }, fee !== null && fee > 0).data;
  const next = fee !== null && fee > 0 ? proposed : undefined;
  const price = product.approvedPrice ?? 0;
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const status = (value: PriceStatus | null | undefined) => (value ? <StatusBadge family="price" code={value} /> : '—');
  const red = next?.evaluation?.status === 'RED';
  /** «Saqlash» yangi haq kiritilgach yonadi; sabab — bosilganda tekshiriladi. */
  const feeReady = fee !== null && fee > 0 && fee !== product.affiliateFee && !red;
  const taxRate = Number(current?.params.taxRate);
  const paymentRate = Number(current?.params.paymentRate);

  const save = () => {
    setTouched(true);
    if (!feeReady || !reason.trim() || change.isPending || fee === null) return;
    change.mutate({ id: product.id, price, affiliateFee: fee, reason: reason.trim() }, {
      onSuccess: () => {
        notification.success({ title: t('fee.saved'), description: t('fee.savedText', { name: product.name, fee: formatMoney(fee) }), placement: 'bottomRight', duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('stop.error'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('fee.title')}
      description={t('fee.subtitle', { name: product.name })}
      icon={<Pencil />}
      width={560}
      locked={change.isPending}
      onClose={onClose}
      testId="fee-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={change.isPending}>{t('moderation.cancel')}</DialogCancel>
          <DialogPrimary onClick={save} disabled={!feeReady} saving={change.isPending} savingLabel={t('moderation.saving')} shortcut={false}>{t('fee.save')}</DialogPrimary>
        </>
      )}
    >
      <dl className={styles.rows}>
        <div>
          <dt>{t('fee.current')}</dt>
          <dd>
            {product.affiliateFee === null ? '—' : sum(product.affiliateFee)}
            {current ? <span className={styles.sub}>{t('fee.currentHint', { adCost: formatMoney(current.params.adCost), coef: current.params.affiliateCoef, recommended: formatMoney(current.recommendedAffiliateFee) })}</span> : null}
          </dd>
        </div>
        <div>
          <dt>{t('fee.price')}</dt>
          <dd>
            {t('fee.priceValue', { price: formatMoney(price), status: product.priceStatus ? t(`status.price.${product.priceStatus}` as TranslationKey) : '—' })}
            {current ? <span className={styles.sub}>{t('fee.priceHint', { mode: t(`moderation.mode.${current.params.deliveryMode}` as TranslationKey) })}</span> : null}
          </dd>
        </div>
      </dl>
      <div>
        <label htmlFor={feeId} className={styles.label}>{t('fee.new')}</label>
        <MoneyInput id={feeId} value={fee} onChange={setFee} aria-describedby={`${feeId}-hint`} status={touched && (fee === null || fee <= 0) ? 'error' : undefined} />
        <p id={`${feeId}-hint`} className={styles.hint}>{t('fee.newHint')}</p>
      </div>
      <div className={styles.recalc}>
        <p className={styles.caption}>{t('fee.recalc')}</p>
        <dl>
          <div>
            <dt>{t('fee.withCurrent')}</dt>
            <dd>{current?.evaluation ? sum(current.evaluation.platformResult70) : '—'}<span className={styles.sub}>{t('fee.result')}</span></dd>
          </div>
          <div>
            <dt>{t('fee.withNew')}</dt>
            <dd>{next?.evaluation ? sum(next.evaluation.platformResult70) : '—'}<span className={styles.sub}>{next ? t('fee.result') : t('fee.pending')}</span></dd>
          </div>
          <div>
            <dt>{t('fee.status')}</dt>
            <dd>{status(next?.evaluation?.status ?? current?.evaluation?.status)}<span className={styles.sub}>{t('fee.statusHint')}</span></dd>
          </div>
        </dl>
        {Number.isFinite(taxRate) && Number.isFinite(paymentRate) ? (
          <p className={styles.formula}>{t('fee.formula', { net: formatRate(1 - taxRate), payment: formatRate(paymentRate * 100) })}</p>
        ) : null}
        {red ? <p className={styles.error} role="alert">{t('fee.red')}</p> : null}
      </div>
      <div>
        <label htmlFor={reasonId} className={styles.label}>{t('fee.reason')} <span aria-hidden>*</span></label>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={REJECT_REASON_MAX}
          aria-invalid={(touched && !reason.trim()) || undefined}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className={styles.hint}>{t('fee.reasonHint')}</p>
      </div>
      <p className={styles.note}>{t('fee.note')}</p>
    </Dialog>
  );
}
