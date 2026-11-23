import { Ban, Pencil, Store } from 'lucide-react';
import { useId, useState } from 'react';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { useDebouncedValue } from '../../../../shared/lib/useDebouncedValue';
import { Dialog, DialogCancel, DialogPrimary } from '../../../../shared/ui/Dialog/Dialog';
import { MoneyInput } from '../../../../shared/ui/MoneyInput/MoneyInput';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../../shared/ui/StatusBadge/StatusBadge';
import { useMarketPreviewQuery, useProductPricingQuery } from '../../api/adminProductsQueries';
import { signedMoney } from '../../lib/pricingView';
import type { PriceEvaluation, ProductPricing } from '../../model/adminProductTypes';
import { REJECT_REASON_MAX } from '../adminProductModerationConfig';
import { MarketResult } from './PriceDecision';
import styles from './Price.module.css';

const SOURCE_MAX = 300;

interface MarketDialogProps {
  productId: string;
  name: string;
  pricing: ProductPricing;
  saving: boolean;
  onSave: (value: { competitorTotal: number; source: string }) => void;
  onClose: () => void;
}

/**
 * «Bozor narxini kiritish» (holatlar 2.3, oyna 480): raqobatchida mijoz jami va manba; natija (Mos / Qimmat, eng yuqori
 * bazaviy narx) — serverdan, saqlamasdan oldindan ko'rish (taklif `preview`).
 */
export function MarketDialog({ productId, name, pricing, saving, onSave, onClose }: MarketDialogProps) {
  const { t } = useTranslation();
  const totalId = useId();
  const sourceId = useId();
  const [total, setTotal] = useState<number | null>(pricing.market?.competitorTotal ?? null);
  const [source, setSource] = useState(pricing.market?.source ?? '');
  const debounced = useDebouncedValue(total, 400);
  const preview = useMarketPreviewQuery(productId, debounced !== null && debounced > 0 ? debounced : undefined);
  const result = total !== null && total === debounced ? preview.data : undefined;
  const valid = total !== null && total > 0;
  const save = () => {
    if (valid && !saving) onSave({ competitorTotal: total, source: source.trim() });
  };
  return (
    <Dialog
      open
      title={t('anarx.marketDialog.title')}
      description={t('anarx.marketDialog.sub', { name, mode: t(`anarx.mode.${pricing.params.deliveryMode}` as TranslationKey) })}
      icon={<Store />}
      width={480}
      locked={saving}
      onClose={onClose}
      testId="market-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('anarx.action.cancel')}</DialogCancel>
          <DialogPrimary onClick={save} disabled={!valid} saving={saving} savingLabel={t('moderation.saving')} shortcut={false}>{t('anarx.marketDialog.save')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.dialogField}>
        <label htmlFor={totalId}>{t('anarx.marketDialog.total')}</label>
        <MoneyInput id={totalId} value={total} onChange={setTotal} autoFocus aria-describedby={`${totalId}-hint`} />
        <p id={`${totalId}-hint`} className={styles.dialogHint}>{t('anarx.marketDialog.totalHint')}</p>
      </div>
      <div className={styles.dialogField}>
        <label htmlFor={sourceId}>{t('anarx.marketDialog.source')} <span>{t('anarx.marketDialog.optional')}</span></label>
        <input id={sourceId} className={styles.input} value={source} maxLength={SOURCE_MAX} placeholder={t('anarx.marketDialog.sourcePlaceholder')} onChange={(event) => setSource(event.target.value)} />
      </div>
      {result ? <MarketResult market={result} pricing={pricing} compact /> : (
        <div className={styles.resultBox}>
          <p>{t('anarx.marketDialog.result')}</p>
          <p className={styles.dialogHint}>{t('anarx.marketDialog.resultEmpty')}</p>
        </div>
      )}
    </Dialog>
  );
}

interface FeeDialogProps {
  productId: string;
  name: string;
  pricing: ProductPricing;
  /** Qaror narxi — shu narxda «Hozir / Yangi haq» solishtiriladi. */
  price: number;
  current: PriceEvaluation | null;
  initialFee: number | null;
  onSave: (fee: number) => void;
  onClose: () => void;
}

/**
 * «Sotuvchi haqini o'zgartirish» (holatlar 3.1; NRX-3, NRX-13): joriy va tavsiya haq, yangi haq, zararsiz taklif;
 * shu narxda holat, platforma natijasi va sotuvchi foydasi — hozir va yangi haq bilan (server hisobi). Yangi haq
 * narx qarori bilan saqlanadi («Narxni tasdiqlash»).
 */
export function FeeDialog({ productId, name, pricing, price, current, initialFee, onSave, onClose }: FeeDialogProps) {
  const { t } = useTranslation();
  const feeId = useId();
  const [fee, setFee] = useState<number | null>(initialFee);
  const [touched, setTouched] = useState(false);
  const debounced = useDebouncedValue(fee, 300);
  const proposed = useProductPricingQuery(productId, { price, affiliateFee: debounced ?? undefined }, debounced !== null && debounced > 0);
  const next = fee !== null && fee === debounced ? proposed.data?.evaluation ?? null : null;
  const valid = fee !== null && fee > 0 && Number.isInteger(fee);
  const m = (value: number) => formatMoney(value);
  const sum = (value: number) => t('anarx.sum', { amount: signedMoney(value) });
  const safeFee = current?.safeAffiliateFee ?? null;
  const save = () => {
    setTouched(true);
    if (valid) onSave(fee);
  };
  const cell = (evaluation: PriceEvaluation | null, pick: (value: PriceEvaluation) => number) => {
    if (!evaluation) return <td>—</td>;
    const value = pick(evaluation);
    return <td data-tone={value < 0 ? 'danger' : undefined}>{sum(value)}</td>;
  };
  return (
    <Dialog
      open
      title={t('anarx.feeDialog.title')}
      description={t('anarx.feeDialog.sub', { name })}
      icon={<Pencil />}
      width={440}
      onClose={onClose}
      testId="price-fee-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose}>{t('anarx.action.cancel')}</DialogCancel>
          <DialogPrimary onClick={save} disabled={!valid || next?.status === 'RED'} shortcut={false}>{t('anarx.feeDialog.save')}</DialogPrimary>
        </>
      )}
    >
      <dl className={styles.facts}>
        <div><dt>{t('anarx.feeDialog.current')}</dt><dd>{sum(pricing.calculation.affiliateFee)}</dd></div>
        <div>
          <dt>{t('anarx.feeDialog.recommended', { adCost: m(pricing.params.adCost), coef: String(pricing.params.affiliateCoef) })}</dt>
          <dd>{sum(pricing.recommendedAffiliateFee)}</dd>
        </div>
      </dl>
      <div className={styles.dialogField}>
        <label htmlFor={feeId}>{t('anarx.feeDialog.newFee')}</label>
        <MoneyInput id={feeId} value={fee} onChange={setFee} autoFocus status={touched && !valid ? 'error' : undefined} data-testid="price-fee-input" />
        {touched && !valid ? <p className={styles.fieldError} role="alert">{t('anarx.feeDialog.invalid')}</p> : null}
        {safeFee !== null ? <p className={styles.dialogHint}>{t('anarx.feeDialog.safe', { price: m(price), fee: m(safeFee) })}</p> : null}
      </div>
      <table className={styles.compare} data-testid="price-fee-compare">
        <caption>{t('anarx.feeDialog.atPrice', { price: m(price) })}</caption>
        <thead>
          <tr>
            <th>{t('anarx.feeDialog.colMetric')}</th>
            <th>{t('anarx.feeDialog.colNow')}</th>
            <th>{t('anarx.feeDialog.colNew')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t('anarx.feeDialog.state')}</td>
            <td>{current ? <StatusBadge family="price" code={current.status} /> : '—'}</td>
            <td>{next ? <StatusBadge family="price" code={next.status} /> : '—'}</td>
          </tr>
          <tr>
            <td>{t('anarx.feeDialog.p70')}</td>
            {cell(current, (value) => value.platformResult70)}
            {cell(next, (value) => value.platformResult70)}
          </tr>
          <tr>
            <td>{t('anarx.feeDialog.p100')}</td>
            {cell(current, (value) => value.platformResult100)}
            {cell(next, (value) => value.platformResult100)}
          </tr>
          <tr>
            <td>{t('anarx.feeDialog.profit')}</td>
            {cell(current, (value) => value.affiliateResult)}
            {cell(next, (value) => value.affiliateResult)}
          </tr>
        </tbody>
      </table>
      <p className={styles.dialogNote}>{t('anarx.feeDialog.note')}</p>
    </Dialog>
  );
}

interface RejectDialogProps {
  name: string;
  basePrice: number;
  initialReason: string;
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** «Narxni rad etish» (holatlar 3.2): sabab majburiy; mahsulot sotuvga chiqmaydi (BE-07 reject). */
export function PriceRejectDialog({ name, basePrice, initialReason, saving, onConfirm, onClose }: RejectDialogProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const [reason, setReason] = useState(initialReason);
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();
  const confirm = () => {
    setTouched(true);
    if (!missing && !saving) onConfirm(reason.trim());
  };
  return (
    <Dialog
      open
      title={t('anarx.rejectDialog.title')}
      description={t('anarx.rejectDialog.sub', { name, base: formatMoney(basePrice) })}
      icon={<Ban />}
      tone="danger"
      width={440}
      locked={saving}
      onClose={onClose}
      testId="price-reject-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('anarx.action.cancel')}</DialogCancel>
          <DialogPrimary danger onClick={confirm} saving={saving} savingLabel={t('moderation.saving')} shortcut={false}>{t('anarx.rejectDialog.confirm')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.dialogField}>
        <label htmlFor={reasonId}>{t('anarx.rejectDialog.reason')} <span>{t('anarx.rejectDialog.required')}</span></label>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={REJECT_REASON_MAX}
          placeholder={t('anarx.rejectDialog.placeholder')}
          aria-invalid={(touched && missing) || undefined}
          autoFocus
          onChange={(event) => setReason(event.target.value)}
        />
        {touched && missing ? <p className={styles.fieldError} role="alert">{t('anarx.rejectDialog.error')}</p> : null}
      </div>
      <p className={styles.dialogNote}>{t('anarx.rejectDialog.note')} <span className={styles.muted}>{t('anarx.rejectDialog.noteTbd')}</span></p>
    </Dialog>
  );
}
