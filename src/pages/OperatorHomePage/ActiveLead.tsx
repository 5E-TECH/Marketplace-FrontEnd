import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useLeadProductQuery, useLeadQuoteMutation } from '../../features/operator/api/operatorQueries';
import { sum } from '../../features/operator/lib/leadFormat';
import type { LeadCard, LeadPrice, LeadResultInput } from '../../features/operator/model/operatorTypes';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LeadCardView } from './LeadCardView';
import { ProductDrawer } from './ProductDrawer';
import { ResultDialog } from './ResultDialog';
import { ResultPanel, type NoAnswerDraft, type OrderDraft } from './ResultPanel';
import { confirmBlocked, type DialogChoice, type ResultChoice } from './resultChoices';
import styles from './OperatorWorkspace.module.css';

interface ActiveLeadProps {
  card: LeadCard;
  queue: ReactNode;
  selected: 'CONFIRMED' | 'NO_ANSWER' | null;
  dialog: DialogChoice | null;
  productOpen: boolean;
  saving: boolean;
  error: string | null;
  onChoose: (choice: ResultChoice) => void;
  onCloseDialog: () => void;
  onProductOpen: (open: boolean) => void;
  onHelp: () => void;
  onSubmit: (input: LeadResultInput) => void;
  onConfirmOrder: (draft: OrderDraft) => void;
  /** Pastki asosiy tugma uchun — sahifa Ctrl+Enter ni shu orqali chaqiradi. */
  primaryRef: { current: (() => void) | null };
}

/**
 * Faol lid (operator-lid-kartasi): navbat | lid kartasi | «Natija va buyurtma», pastda doimiy qator —
 * mijozga aytiladigan summa (server hisobi) va asosiy amal. Shakl holati shu lidga tegishli.
 */
export function ActiveLead({ card, queue, selected, dialog, productOpen, saving, error, onChoose, onCloseDialog, onProductOpen, onHelp, onSubmit, onConfirmOrder, primaryRef }: ActiveLeadProps) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderDraft>({ whereDeliver: card.address?.whereDeliver ?? 'CENTER', quantity: card.quantity, comment: '' });
  const [noAnswer, setNoAnswer] = useState<NoAnswerDraft>({ outcome: 'NO_ANSWER', comment: '' });
  const [quote, setQuote] = useState<LeadPrice | null>(null);
  const quoteMutation = useLeadQuoteMutation();
  const product = useLeadProductQuery(card.id, selected === 'CONFIRMED' || productOpen);
  const blocked = confirmBlocked(card);

  const price = quote ?? card.price;
  const changed = order.quantity !== card.quantity || order.whereDeliver !== (card.address?.whereDeliver ?? 'CENTER');
  const quoteMutate = quoteMutation.mutate;
  useEffect(() => {
    if (!changed) return;
    quoteMutate({ id: card.id, quantity: order.quantity, whereDeliver: order.whereDeliver }, { onSuccess: setQuote });
  }, [card.id, changed, order.quantity, order.whereDeliver, quoteMutate]);

  const primary = () => {
    if (saving) return;
    if (selected === 'NO_ANSWER') {
      const comment = noAnswer.comment.trim();
      onSubmit({ outcome: noAnswer.outcome, ...(comment ? { comment } : {}) });
    } else if (selected === 'CONFIRMED' && !blocked) {
      onConfirmOrder({ ...order, comment: order.comment.trim() });
    }
  };
  useEffect(() => {
    primaryRef.current = primary;
  });

  const primaryLabel: TranslationKey = selected === 'NO_ANSWER' ? 'opw.confirmResult' : 'opw.confirmOrder';
  const primaryEnabled = selected === 'NO_ANSWER' || (selected === 'CONFIRMED' && !blocked);
  const whereLabel = t(`opw.whereDeliver.${price?.whereDeliver ?? order.whereDeliver}` as TranslationKey);

  return (
    <div className={styles.page}>
      <div className={styles.workspace} data-active="lead">
        {queue}
        <LeadCardView card={card} onProductInfo={() => onProductOpen(true)} onHelp={onHelp} />
        <ResultPanel
          card={card}
          selected={selected}
          order={order}
          noAnswer={noAnswer}
          product={product.data}
          busy={saving}
          onChoose={onChoose}
          onOrderChange={(patch) => setOrder((current) => ({ ...current, ...patch }))}
          onNoAnswerChange={(patch) => setNoAnswer((current) => ({ ...current, ...patch }))}
        />
      </div>

      <footer className={styles.footer} aria-label={t('opw.footerLabel')}>
        <div className={styles.sum} role="group" aria-label={t('opw.sumTitle')} data-testid="order-sum">
          <span className={styles.sumTop}>
            <span>{t('opw.sumTitle')}</span>
            <span>{t('opw.payLabel')} <strong>{t('opw.payValue')}</strong></span>
          </span>
          {price ? (
            <span className={styles.sumBottom}>
              <span><span className={styles.sumLabel}>{price.quantity > 1 ? t('opw.sumGoodsQty', { qty: price.quantity }) : t('opw.sumGoods')}</span> <strong>{sum(price.subtotal)}</strong></span>
              <span><span className={styles.sumLabel}>{t('opw.sumDelivery', { where: whereLabel })}</span> <strong>{sum(price.deliveryFee)}</strong></span>
              <span className={styles.sumTotal}><span>{t('opw.sumTotal')}</span> <strong>{sum(price.totalAmount)}</strong></span>
            </span>
          ) : (
            <span className={styles.sumBottom}><span className={styles.sumLabel}>{t('opw.sumUnknown')}</span></span>
          )}
        </div>
        <button
          type="button"
          className={styles.footerAction}
          data-testid="footer-action"
          disabled={!primaryEnabled || saving}
          aria-busy={saving || undefined}
          aria-keyshortcuts="Control+Enter"
          title={t('opw.confirmOrderTitle')}
          onClick={primary}
        >
          {saving ? <LoaderCircle size={18} aria-hidden /> : null}
          {saving ? t('opw.saving') : t(primaryLabel)}
          {primaryEnabled && !saving ? <kbd className={`${styles.kbd} ${styles.kbdOnPrimary}`}>Ctrl+Enter</kbd> : null}
        </button>
      </footer>

      <ResultDialog card={card} choice={dialog} saving={saving} error={dialog ? error : null} onSubmit={onSubmit} onClose={onCloseDialog} />
      <ProductDrawer card={card} open={productOpen} onClose={() => onProductOpen(false)} />
      {error && !dialog && selected ? <span className={styles.srOnly} role="alert">{error}</span> : null}
    </div>
  );
}
