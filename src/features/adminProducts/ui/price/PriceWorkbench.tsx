import { App, Button } from 'antd';
import { Ban, CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../../app/store/hooks';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../../shared/lib/personName';
import { useDebouncedValue } from '../../../../shared/lib/useDebouncedValue';
import { LoadError } from '../../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../../../shared/ui/PageActionBar/PageActionBar';
import { StatusBadge } from '../../../../shared/ui/StatusBadge/StatusBadge';
import { selectAuthUser } from '../../../auth/model/authSlice';
import {
  useDecidePriceMutation,
  useDeliveryModeMutation,
  useMarketCheckMutation,
  useProductPricingQuery,
  useRejectProductMutation,
} from '../../api/adminProductsQueries';
import { formatStamp } from '../../lib/productFormat';
import type { DeliveryMode, PriceStatus } from '../../model/adminProductTypes';
import { ProductAudit } from '../ProductAudit';
import { PriceCalculation } from './PriceCalculation';
import { PriceDecision } from './PriceDecision';
import { FeeDialog, MarketDialog, PriceRejectDialog } from './PriceDialogs';
import styles from './Price.module.css';

export interface PriceWorkbenchProduct {
  id: string;
  name: string;
  basePrice: number | null;
  approvedPrice: number | null;
}

/** Qarordan keyin (holatlar 4): tasdiqlandi yoki rad etildi — kim, qachon, sabab. */
export type PriceOutcome =
  | { kind: 'approved'; price: number; status: PriceStatus; mode: DeliveryMode; total: number; reason: string | null; by: string; at: string }
  | { kind: 'rejected'; reason: string; by: string; at: string };

interface PriceWorkbenchProps {
  product: PriceWorkbenchProduct;
  phone: boolean;
  /** Moderatsiya: navbatdagi keyingi mahsulot («Keyingisi: …»). */
  next?: { name: string; open: () => void } | null;
  /** Qaror so'rovi ketyapti: navbat yangilanib mahsulot undan chiqadi — sahifa tanlovni shu mahsulotda qotiradi. */
  onDecisionStart?: () => void;
  /** Qaror bo'lgach (sahifa navbatni yangilaydi, sarlavhadagi holat o'zgaradi). */
  onOutcome?: (outcome: PriceOutcome) => void;
  /** Sahifada saqlangan natija (qayta o'rnatilsa ham «Narx tasdiqlandi» ko'rinib turadi). */
  initialOutcome?: PriceOutcome | null;
  /** Mahsulot kartasi: qarordan keyin «Narxni o'zgartirish» bilan qaytadan; ustunlar kartaning tepasida (chiziqsiz). */
  allowChange?: boolean;
}

type DialogState =
  | { kind: 'market' }
  | { kind: 'fee'; initial: number | null }
  | { kind: 'reject'; reason: string }
  | null;

/**
 * Narx kalkulyatori va narxni tasdiqlash (FE-13, admin-narx; TZ 2.1–2.6, NRX-1…6, NRX-13): «Hisob» va «Qaror»
 * ustunlari, oynalar va audit. Hisob faqat serverda (BE-09 `pricing`): kiritilgan narx va haq bilan qayta so'raladi,
 * UI natijani ko'rsatadi. Qizil — tasdiqlash yopiq (server ham 400), to'q sariq — sabab majburiy.
 */
export function PriceWorkbench({ product, phone, next = null, onDecisionStart, onOutcome, initialOutcome = null, allowChange = false }: PriceWorkbenchProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const [feeDraft, setFeeDraft] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState<number | null | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [outcome, setOutcome] = useState<PriceOutcome | null>(initialOutcome);

  const base = useProductPricingQuery(product.id, feeDraft === null ? {} : { affiliateFee: feeDraft });
  const pricing = base.data;
  const defaultPrice = pricing ? pricing.approvedPrice ?? pricing.calculation.recommended : null;
  const price = priceInput === undefined ? defaultPrice : priceInput;
  const debounced = useDebouncedValue(price, 300);
  const evaluated = useProductPricingQuery(
    product.id,
    { price: debounced ?? undefined, affiliateFee: feeDraft ?? undefined },
    debounced !== null && debounced > 0,
  );
  const evaluating = price !== debounced || evaluated.isFetching;
  const evaluation = price !== null && price > 0 ? evaluated.data?.evaluation ?? null : null;
  const currentMode = pricing?.modes?.find((row) => row.mode === pricing.params.deliveryMode) ?? null;

  const decide = useDecidePriceMutation();
  const reject = useRejectProductMutation();
  const market = useMarketCheckMutation();
  const mode = useDeliveryModeMutation();
  const placement = phone ? 'top' : 'bottomRight';
  const by = user?.name ? shortPersonName(user.name) : '—';
  const status = evaluation?.status ?? null;
  const orange = status === 'ORANGE';
  const canApprove = Boolean(evaluation && price !== null && status !== 'RED' && !evaluating && !decide.isPending);

  const finish = (result: PriceOutcome) => {
    setOutcome(result);
    setDialog(null);
    onOutcome?.(result);
  };

  const approve = () => {
    if (!pricing || !canApprove || price === null || !status) return;
    if (orange && !reason.trim()) {
      setReasonTouched(true);
      return;
    }
    const trimmed = reason.trim() || null;
    onDecisionStart?.();
    decide.mutateAsync({ id: product.id, price, affiliateFee: feeDraft ?? undefined, reason: trimmed ?? undefined })
      .then((result) => {
        const saved = result.priceStatus ?? status;
        const total = price + result.calculation.delivery.visibleCenter;
        const key = `price-${product.id}`;
        const statusName = t(`status.price.${saved}` as TranslationKey);
        notification.success({
          key,
          title: t('anarx.toast.approved'),
          description: t(saved === 'ORANGE' ? 'anarx.toast.approvedOrange' : 'anarx.toast.approvedText', { name: product.name, price: formatMoney(price), status: statusName }),
          placement,
          duration: 6,
          actions: next ? <Button size="small" onClick={() => { notification.destroy(key); next.open(); }}>{t('anarx.toast.next')}</Button> : undefined,
        });
        finish({ kind: 'approved', price, status: saved, mode: result.params.deliveryMode, total, reason: trimmed, by, at: new Date().toISOString() });
      })
      .catch((error: unknown) => notification.error({ title: t('anarx.toast.error'), description: getApiErrorMessage(error), placement }));
  };

  const confirmReject = (text: string) => {
    onDecisionStart?.();
    reject.mutateAsync({ id: product.id, reason: text })
      .then(() => {
        notification.success({ title: t('anarx.toast.rejected'), description: t('anarx.toast.rejectedText', { name: product.name }), placement, duration: 6 });
        finish({ kind: 'rejected', reason: text, by, at: new Date().toISOString() });
      })
      .catch((error: unknown) => notification.error({ title: t('anarx.toast.error'), description: getApiErrorMessage(error), placement }));
  };

  const saveMarket = (value: { competitorTotal: number; source?: string }) => {
    market.mutateAsync({ id: product.id, competitorTotal: value.competitorTotal, source: value.source || undefined })
      .then(() => setDialog(null))
      .catch((error: unknown) => notification.error({ title: t('anarx.market.error'), description: getApiErrorMessage(error), placement }));
  };

  const changeMode = (value: DeliveryMode) => {
    mode.mutateAsync({ id: product.id, deliveryMode: value })
      .then(() => {
        // Tavsiya o'zgaradi — admin narxini yozmagan bo'lsa, yangi tavsiya bilan qoladi.
        notification.success({ title: t('anarx.delivery.saved'), description: t('anarx.delivery.savedText', { name: product.name, mode: t(`anarx.mode.${value}` as TranslationKey) }), placement, duration: 4 });
      })
      .catch((error: unknown) => notification.error({ title: t('anarx.delivery.error'), description: getApiErrorMessage(error), placement }));
  };

  const cancel = () => {
    setPriceInput(undefined);
    setFeeDraft(null);
    setReason('');
    setReasonTouched(false);
  };

  // Ctrl+Enter — «Narxni tasdiqlash» (desktop; tugmadagi belgi bilan).
  useEffect(() => {
    if (phone || dialog || outcome || !canApprove) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        approve();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (base.isError && !pricing) {
    return <div className={styles.loading}><LoadError error={base.error} onRetry={() => void base.refetch()} title={t('anarx.loadError')} /></div>;
  }
  if (!pricing) {
    return (
      <div className={styles.loading} aria-busy="true" data-testid="price-loading">
        <span className={styles.skeleton} style={{ width: '40%' }} />
        <span className={styles.skeleton} style={{ height: 160 }} />
        <span className={styles.skeleton} style={{ height: 240 }} />
      </div>
    );
  }

  const audit = <div className={styles.audit}><ProductAudit productId={product.id} phone={phone} /></div>;

  if (outcome) {
    const approved = outcome.kind === 'approved';
    const tone = approved ? (outcome.status === 'ORANGE' ? 'orange' : undefined) : 'danger';
    return (
      <div className={styles.workbench}>
        <section className={styles.done} data-testid="price-outcome" data-kind={outcome.kind}>
          <div className={styles.doneBox} data-tone={tone}>
            {approved ? (outcome.status === 'ORANGE' ? <TriangleAlert aria-hidden /> : <CircleCheck aria-hidden />) : <Ban aria-hidden />}
            <div>
              {approved ? (
                <>
                  <p className={styles.doneTitle}>{t('anarx.done.approved', { price: formatMoney(outcome.price) })} <StatusBadge family="price" code={outcome.status} /></p>
                  <p>{t('anarx.done.modeLine', { mode: t(`anarx.mode.${outcome.mode}` as TranslationKey), total: formatMoney(outcome.total) })}</p>
                  {outcome.reason ? <p>{t('anarx.done.reason', { reason: outcome.reason })}</p> : null}
                  <p className={styles.note}>{t(outcome.status === 'ORANGE' ? 'anarx.done.byOrange' : 'anarx.done.by', { name: outcome.by, at: formatStamp(outcome.at) })}</p>
                </>
              ) : (
                <>
                  <p className={styles.doneTitle}>{t('anarx.done.rejected')}</p>
                  <p>{t('anarx.done.rejectedReason', { reason: outcome.reason, name: outcome.by, at: formatStamp(outcome.at) })}</p>
                </>
              )}
            </div>
          </div>
          {next || (allowChange && approved) ? (
            <div className={styles.doneActions}>
              {next ? <button type="button" className={styles.primary} onClick={next.open}>{t('anarx.done.next', { name: next.name })}</button> : null}
              {allowChange && approved ? <button type="button" className={styles.secondaryButton} onClick={() => { cancel(); setOutcome(null); }}>{t('anarx.done.change')}</button> : null}
            </div>
          ) : null}
        </section>
        {audit}
      </div>
    );
  }

  const reasonError = reasonTouched && orange && !reason.trim();

  return (
    <div className={styles.workbench} data-testid="price-workbench" data-flush={allowChange || undefined}>
      <div className={styles.columns}>
        <PriceCalculation
          pricing={pricing}
          feeDraft={feeDraft}
          modeSaving={mode.isPending}
          readOnly={false}
          phone={phone}
          onChangeFee={() => setDialog({ kind: 'fee', initial: feeDraft ?? pricing.calculation.affiliateFee })}
          onMode={changeMode}
        />
        <PriceDecision
          pricing={pricing}
          evaluation={evaluation}
          atRecommended={currentMode}
          price={price}
          onPrice={(value) => setPriceInput(value)}
          evaluating={evaluating}
          reason={reason}
          onReason={(value) => setReason(value)}
          reasonError={reasonError}
          approving={decide.isPending}
          rejecting={reject.isPending}
          phone={phone}
          marketSaving={market.isPending}
          onMarket={(total) => saveMarket({ competitorTotal: total })}
          onMarketDialog={() => setDialog({ kind: 'market' })}
          onNegotiate={(preset) => setDialog({ kind: 'reject', reason: preset })}
          onSafeFee={(fee) => setDialog({ kind: 'fee', initial: fee })}
          onApprove={approve}
          onReject={() => setDialog({ kind: 'reject', reason: '' })}
          onCancel={cancel}
        />
      </div>
      {audit}

      {phone ? (
        <PageActionBar>
          <button type="button" className={styles.barSecondary} disabled={reject.isPending} onClick={() => setDialog({ kind: 'reject', reason: '' })}>{t('anarx.action.reject')}</button>
          <button type="button" className={styles.barPrimary} disabled={!canApprove} onClick={approve}>{t('anarx.action.approve')}</button>
        </PageActionBar>
      ) : null}

      {dialog?.kind === 'market' ? (
        <MarketDialog productId={product.id} name={product.name} pricing={pricing} saving={market.isPending} onSave={saveMarket} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'fee' ? (
        <FeeDialog
          productId={product.id}
          name={product.name}
          pricing={pricing}
          price={price ?? pricing.calculation.recommended}
          current={evaluation}
          initialFee={dialog.initial}
          onSave={(fee) => {
            setFeeDraft(fee === pricing.calculation.affiliateFee && feeDraft === null ? null : fee);
            setDialog(null);
            notification.info({ title: t('anarx.toast.feeApplied'), description: t('anarx.toast.feeAppliedText', { fee: formatMoney(fee) }), placement, duration: 4 });
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'reject' ? (
        <PriceRejectDialog
          name={product.name}
          basePrice={pricing.calculation.basePrice}
          initialReason={dialog.reason}
          saving={reject.isPending}
          onConfirm={confirmReject}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
