import axios from 'axios';
import { CircleCheck, CircleX, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LeadAddressInput } from '../../features/operator/api/operatorApi';
import { useLeadProductQuery, useLeadQuoteQuery } from '../../features/operator/api/operatorQueries';
import { addressFromLead, addressLine } from '../../features/address/lib/addressValue';
import { sum } from '../../features/operator/lib/leadFormat';
import { kgLabel, orderBlock, type QuoteState } from '../../features/operator/lib/orderRules';
import type { LeadCard, LeadPrice, LeadResultAccepted, LeadResultInput } from '../../features/operator/model/operatorTypes';
import { getApiErrorCode, getApiErrorFields } from '../../shared/api/apiError';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useNow } from '../../shared/lib/useNow';
import { LeadCardView } from './LeadCardView';
import { OrderDoneCard } from './OrderDoneCard';
import { OrderForm, type OrderAlert, type OrderDraft, type OrderFieldErrors } from './OrderForm';
import { ProductDrawer } from './ProductDrawer';
import { ResultDialog } from './ResultDialog';
import { ResultPanel, type NoAnswerDraft } from './ResultPanel';
import { confirmBlocked, type DialogChoice, type ResultChoice } from './resultChoices';
import styles from './OperatorWorkspace.module.css';

/** «Buyurtmani tasdiqlash» so'rovi: manzil formadagidek, miqdor va izoh; summa — ko'rsatilgan server summasi. */
export interface ConfirmOrderRequest {
  address: LeadAddressInput;
  quantity: number;
  comment: string;
  price: LeadPrice | null;
  available: number | null;
}

/** Buyurtma yaratildi (20-kadr): kartani, natijani va o'sha paytdagi summani ushlab turadi. */
export interface OrderDone extends ConfirmOrderRequest {
  card: LeadCard;
  result: LeadResultAccepted;
  at: number;
}

interface ActiveLeadProps {
  card: LeadCard;
  queue: ReactNode;
  selected: 'CONFIRMED' | 'NO_ANSWER' | null;
  dialog: DialogChoice | null;
  productOpen: boolean;
  saving: boolean;
  error: string | null;
  /** «Buyurtmani tasdiqlash» xatosi — maydon xatolari, «manzil tasdiqlanmadi», «band qilinmadi». */
  confirmError: unknown;
  done: OrderDone | null;
  onChoose: (choice: ResultChoice) => void;
  onCloseDialog: () => void;
  onProductOpen: (open: boolean) => void;
  onHelp: () => void;
  onSubmit: (input: LeadResultInput) => void;
  onConfirmOrder: (request: ConfirmOrderRequest) => void;
  /** Pastki asosiy tugma uchun — sahifa Ctrl+Enter ni shu orqali chaqiradi. */
  primaryRef: { current: (() => void) | null };
}

/** Server maydoni → forma maydoni (`details[].field`, BE-38). */
const FIELD_OF: Record<string, keyof OrderFieldErrors> = { regionSoato: 'region', districtSoato: 'district', addressLine: 'street', whereDeliver: 'whereDeliver' };

const availableOf = (error: unknown): number | null => {
  const data: unknown = axios.isAxiosError(error) ? error.response?.data : null;
  const value: unknown = typeof data === 'object' && data !== null && 'available' in data ? data.available : null;
  return typeof value === 'number' ? value : null;
};

/**
 * Faol lid (operator-lid-kartasi, operator-buyurtma-formasi): navbat | lid kartasi | «Natija va buyurtma», pastda
 * doimiy qator — mijozga aytiladigan summa (server hisobi) va asosiy amal. Shakl holati shu lidga tegishli.
 */
export function ActiveLead({ card, queue, selected, dialog, productOpen, saving, error, confirmError, done, onChoose, onCloseDialog, onProductOpen, onHelp, onSubmit, onConfirmOrder, primaryRef }: ActiveLeadProps) {
  const { t } = useTranslation();
  const now = useNow();
  const original = useMemo(() => (card.address ? addressFromLead(card.address) : null), [card.address]);
  const originalWhere = card.address?.whereDeliver ?? null;
  const [order, setOrder] = useState<OrderDraft>(() => ({
    address: addressFromLead(card.address),
    whereDeliver: card.address?.whereDeliver ?? card.price?.whereDeliver ?? 'CENTER',
    quantity: card.quantity,
    comment: '',
  }));
  const [noAnswer, setNoAnswer] = useState<NoAnswerDraft>({ outcome: 'NO_ANSWER', comment: '' });
  // Xato ko'rsatilgach operator formani o'zgartirsa — xato yopiladi (yangi urinish).
  const [dismissed, setDismissed] = useState<unknown>(null);
  const product = useLeadProductQuery(card.id, selected === 'CONFIRMED' || productOpen);
  const blocked = confirmBlocked(card);

  const changed = !card.price || order.quantity !== card.price.quantity || order.whereDeliver !== card.price.whereDeliver;
  const quote = useLeadQuoteQuery(card.id, order.quantity, order.whereDeliver, changed && !done, card.price);
  const price = done ? done.price : changed ? quote.data ?? null : card.price;
  const quoteState: QuoteState = !changed ? (card.price ? 'ready' : 'failed')
    : quote.isError || (quote.isSuccess && !quote.isPlaceholderData && quote.data === null) ? 'failed'
      : quote.isFetching || quote.isPlaceholderData ? 'pending' : 'ready';
  const available = product.data?.available ?? null;
  const block = selected === 'CONFIRMED' ? orderBlock({ address: order.address, quantity: order.quantity, available, quote: quoteState }) : null;

  const shownError = confirmError && confirmError !== dismissed ? confirmError : null;
  const code = shownError ? getApiErrorCode(shownError) : null;
  const fieldErrors: OrderFieldErrors = {};
  if (code === 'VALIDATION_ERROR') {
    for (const field of getApiErrorFields(shownError)) {
      const key = FIELD_OF[field];
      if (key) fieldErrors[key] = t(key === 'region' ? 'opo.fieldRegion' : key === 'district' ? 'opo.fieldDistrict' : key === 'street' ? 'address.streetRequired' : 'opo.noDoor');
    }
  }
  const left = code === 'OUT_OF_STOCK' ? availableOf(shownError) : null;
  const alert: OrderAlert | null = code === 'ADDRESS_NOT_CONFIRMED'
    ? { title: t('opo.addressRejectedTitle'), text: t('opo.addressRejectedText') }
    : code === 'OUT_OF_STOCK'
      ? { title: t('opo.reserveTitle'), text: left ? t('opo.reserveShort', { count: left }) : t('opo.reserveRace') }
      : null;

  // Band qilinmasa — qoldiq qayta so'raladi (oxirgi dona boshqa buyurtmaga ketgan).
  const refetchProduct = product.refetch;
  useEffect(() => {
    if (code === 'OUT_OF_STOCK') void refetchProduct();
  }, [code, refetchProduct, shownError]);

  const updateOrder = (patch: Partial<OrderDraft>) => {
    setOrder((current) => ({ ...current, ...patch }));
    if (confirmError) setDismissed(confirmError);
  };

  const confirmable = selected === 'CONFIRMED' && !blocked && !block && !done;
  const primary = () => {
    if (saving || done) return;
    if (selected === 'NO_ANSWER') {
      const comment = noAnswer.comment.trim();
      onSubmit({ outcome: noAnswer.outcome, ...(comment ? { comment } : {}) });
    } else if (confirmable && order.address.regionSoato && order.address.districtSoato) {
      setDismissed(null);
      onConfirmOrder({
        address: { regionSoato: order.address.regionSoato, districtSoato: order.address.districtSoato, addressLine: addressLine(order.address), whereDeliver: order.whereDeliver },
        quantity: order.quantity,
        comment: order.comment.trim(),
        price,
        available,
      });
    }
  };
  useEffect(() => {
    primaryRef.current = primary;
  });

  const primaryLabel: TranslationKey = selected === 'NO_ANSWER' ? 'opw.confirmResult' : 'opw.confirmOrder';
  const primaryEnabled = selected === 'NO_ANSWER' || confirmable;
  const whereLabel = t(`opw.whereDeliver.${price?.whereDeliver ?? order.whereDeliver}` as TranslationKey);
  const heavyGrams = price?.weightGrams != null && price.deliveryFormula && price.weightGrams > price.deliveryFormula.baseWeightGrams ? price.weightGrams : null;
  const deliveryLabel = heavyGrams !== null ? t('opo.sumDeliveryKg', { where: whereLabel, kg: kgLabel(heavyGrams) }) : t('opw.sumDelivery', { where: whereLabel });
  // Tugma ostidagi sabab: desktopda to'liq (2, 3, 14-kadrlar), planshetda qisqa (23, 25). «Qoldiq yo'q» — ogohlantirish
  // o'zi tushuntiradi (19); «summa hisoblanmadi» — desktopda xato qatori yetarli (17), planshetda sabab ham (25).
  const reasonLong = block && block !== 'quote' && block !== 'outOfStock' ? t(`opo.block.${block}` as TranslationKey) : card.blacklistRejections && confirmable ? t('opo.prepayNote') : null;
  const reasonShort = block && block !== 'outOfStock' ? t(`opo.blockShort.${block}` as TranslationKey) : null;
  const reason = reasonLong ?? reasonShort;
  const quoteFailed = selected === 'CONFIRMED' && !blocked && quoteState === 'failed';

  const orderForm = (
    <OrderForm
      card={card}
      draft={order}
      original={original}
      originalWhere={originalWhere}
      price={price}
      initial={card.price}
      product={product.data}
      errors={fieldErrors}
      alert={alert}
      showRequired={Boolean(original) || Boolean(shownError)}
      now={now}
      busy={saving}
      onChange={updateOrder}
    />
  );

  return (
    <div className={styles.page}>
      <div className={styles.workspace} data-active="lead">
        {queue}
        <LeadCardView card={card} onProductInfo={() => onProductOpen(true)} onHelp={onHelp} />
        <ResultPanel
          card={card}
          selected={selected}
          noAnswer={noAnswer}
          busy={saving}
          orderForm={orderForm}
          done={done ? <OrderDoneCard done={done} /> : null}
          onChoose={onChoose}
          onNoAnswerChange={(patch) => setNoAnswer((current) => ({ ...current, ...patch }))}
        />
      </div>

      <footer className={styles.footer} aria-label={t('opw.footerLabel')}>
        {done ? (
          <div className={styles.doneStatus} role="status" data-testid="order-done-status">
            <CircleCheck aria-hidden />
            <div>
              <p>{t('opo.doneStatusTitle', { lead: done.card.id })}</p>
              <p>{t('opo.doneStatusText')}</p>
            </div>
          </div>
        ) : quoteFailed ? (
          <div className={styles.sumError} role="alert" data-testid="quote-error">
            <CircleX aria-hidden />
            <div>
              <p>{t('opo.quoteFailedTitle')}</p>
              <p>{t('opo.quoteFailedText')}</p>
            </div>
            <button type="button" className={styles.smallButton} disabled={quote.isFetching} onClick={() => void quote.refetch()}>
              <RefreshCw aria-hidden />
              {t('opo.requote')}
            </button>
          </div>
        ) : (
          <div className={styles.sum} role="group" aria-label={t('opw.sumTitle')} data-testid="order-sum" data-stale={quoteState === 'pending' || undefined} aria-busy={quoteState === 'pending' || undefined}>
            <span className={styles.sumTop}>
              <span>{t('opw.sumTitle')}</span>
              <span>{t('opw.payLabel')} <strong>{t('opw.payValue')}</strong></span>
            </span>
            {price ? (
              <span className={styles.sumBottom}>
                <span><span className={styles.sumLabel}>{t('opw.sumGoods')}</span> <strong>{sum(price.subtotal)}</strong></span>
                <span><span className={styles.sumLabel}>{deliveryLabel}</span> <strong>{price.deliveryFee === 0 ? t('opo.free') : sum(price.deliveryFee)}</strong></span>
                {card.blacklistRejections && price.prepayment ? <span><span className={styles.sumLabel}>{t('opo.prepay')}</span> <strong>{sum(price.prepayment.amount)}</strong></span> : null}
                <span className={styles.sumTotal}><span>{t('opw.sumTotal')}</span> <strong>{sum(price.totalAmount)}</strong></span>
              </span>
            ) : (
              <span className={styles.sumBottom}><span className={styles.sumLabel}>{quoteState === 'pending' ? t('opo.quoting') : t('opw.sumUnknown')}</span></span>
            )}
          </div>
        )}
        {done ? null : (
          <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.footerAction}
            data-testid="footer-action"
            disabled={!primaryEnabled || saving}
            aria-busy={saving || undefined}
            aria-keyshortcuts="Control+Enter"
            aria-describedby={reason ? 'footer-reason' : undefined}
            title={t('opw.confirmOrderTitle')}
            onClick={primary}
          >
            {saving ? <LoaderCircle size={18} aria-hidden /> : null}
            {saving ? t('opw.saving') : t(primaryLabel)}
            {primaryEnabled && !saving ? <kbd className={`${styles.kbd} ${styles.kbdOnPrimary}`}>Ctrl+Enter</kbd> : null}
          </button>
          {reason ? (
            <p className={styles.footerReason} id="footer-reason" data-testid="footer-reason">
              {reasonLong ? <span className={reasonShort ? styles.reasonLong : undefined}>{reasonLong}</span> : null}
              {reasonShort ? <span className={styles.reasonShort}>{reasonShort}</span> : null}
            </p>
          ) : null}
          </div>
        )}
      </footer>

      <ResultDialog card={card} choice={dialog} saving={saving} error={dialog ? error : null} onSubmit={onSubmit} onClose={onCloseDialog} />
      <ProductDrawer card={card} open={productOpen} onClose={() => onProductOpen(false)} />
      {error && !dialog && selected ? <span className={styles.srOnly} role="alert">{error}</span> : null}
    </div>
  );
}
