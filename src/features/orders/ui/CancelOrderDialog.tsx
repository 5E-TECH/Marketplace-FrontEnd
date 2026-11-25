import { App } from 'antd';
import { Ban, ChevronDown, CircleAlert, Package, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorCode, getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { useNow } from '../../../shared/lib/useNow';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { dayTime } from '../../../shared/lib/dayTime';
import { useCancelOrderMutation, useOrderQuery } from '../api/ordersQueries';
import { orderListItem, orderNumber, statusLine } from '../lib/orderView';
import type { CustomerRequestRow, OrderListItem, OrderRole } from '../model/orderTypes';
import styles from './OrderDialogs.module.css';

type CancelOrder = Pick<OrderListItem, 'id' | 'leadId' | 'buyerName' | 'regionName' | 'productName' | 'streamCode' | 'affiliateName' | 'status' | 'statusAt' | 'statusDetail' | 'totalAmount' | 'quantity' | 'stockCell'>;

interface CancelOrderDialogProps {
  order: CancelOrder;
  /** Admin — `/admin/orders/{id}/cancel`; nazoratchi va operator — `/operator/orders/{id}/cancel`. */
  role: OrderRole;
  /** Mijoz so'rovi bo'yicha (nazoratchi): oynada so'rov ko'rinadi, bekor qilingach so'rov «Bajarildi» bo'ladi. */
  request?: CustomerRequestRow | null;
  onClose: () => void;
  onDone?: () => void;
}

const REASON_MAX = 500;

/**
 * «{Buyurtma} ni bekor qilish» (admin-buyurtmalar, xavfli tasdiq; BUY-3): Elchi'ga topshirilgunga qadar, izoh
 * majburiy (holat tarixiga). Band qilingan tovar darhol bo'shaydi; sotuvchiga haq yozilmaydi; holat yakuniy.
 * «Sabab» ro'yxati — 16-qaror (ma'lumotnomada kiritilguncha yopiq, sabab izohda).
 */
export function CancelOrderDialog({ order, role, request = null, onClose, onDone }: CancelOrderDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const reasonId = useId();
  const commentId = useId();
  const errorId = useId();
  const cancel = useCancelOrderMutation();
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  // 409: oyna ochiq turganda holat o'zgardi (masalan, posilka topshirildi) — oyna «bekor qilib bo'lmadi» ko'rinishiga o'tadi.
  const [conflict, setConflict] = useState(false);
  const current = useOrderQuery(role, order.id, conflict).data;
  const trimmed = comment.trim();
  const invalid = touched && !trimmed;
  const number = orderNumber(order);
  const quantity = order.quantity ?? 1;
  const line = statusLine(order, t, now);

  const submit = () => {
    setTouched(true);
    if (!trimmed || cancel.isPending) return;
    cancel.mutate({ role, id: order.id, reason: trimmed }, {
      onSuccess: () => {
        notification.success({ title: t('ord.cancel.done', { id: number }), description: t(request ? 'ord.cancel.doneRequest' : 'ord.cancel.doneText', { count: quantity }), placement: phone ? 'top' : 'bottomRight', duration: 5 });
        onDone?.();
        onClose();
      },
      onError: (error) => {
        if (getApiErrorCode(error) === 'INVALID_STATE') {
          setConflict(true);
          notification.error({ title: t('ord.cancel.notCancelled', { id: number }), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
          return;
        }
        notification.error({ title: t('ord.cancel.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
      },
    });
  };

  if (conflict) {
    const fresh = current ? orderListItem(current) : null;
    const nowLine = fresh ? statusLine(fresh, t, now) : null;
    return (
      <Dialog
        open
        title={t('ord.cancel.conflictTitle', { id: number })}
        description={t('ord.cancel.conflictText')}
        icon={<CircleAlert />}
        tone="danger"
        onClose={onClose}
        testId="cancel-order-dialog"
        footer={<DialogCancel onClick={onClose}>{t('ord.panel.close')}</DialogCancel>}
      >
        <div className={styles.body} role="alertdialog" aria-label={t('ord.cancel.conflictTitle', { id: number })}>
          <div className={styles.box}>
            <dl className={styles.facts}>
              <div><dt>{t('ord.cancel.order')}</dt><dd>{[number, order.buyerName, order.regionName].filter(Boolean).join(' · ')}</dd></div>
              <div>
                <dt>{t('ord.cancel.now')}</dt>
                <dd>{fresh ? <StatusBadge family="order" code={fresh.status} /> : '—'}{nowLine ? <span className={styles.note}>{nowLine}</span> : null}</dd>
              </div>
              <div>
                <dt>{t('ord.cancel.opened')}</dt>
                <dd><StatusBadge family="order" code={order.status} />{line ? <span className={styles.note}>{line}</span> : null}</dd>
              </div>
            </dl>
          </div>
          <p className={styles.hint}><Package aria-hidden />{t('ord.cancel.conflictHint')}</p>
          <p className={styles.hint}><CircleAlert aria-hidden />{t('ord.cancel.conflictNothing')}</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title={t('ord.cancel.title', { id: number })}
      description={[order.buyerName, order.productName, order.streamCode ? t('ord.cancel.page', { stream: order.streamCode }) : null].filter(Boolean).join(' · ')}
      icon={<Ban />}
      tone="danger"
      locked={cancel.isPending}
      onClose={onClose}
      testId="cancel-order-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={cancel.isPending}>{t('ord.cancel.back')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={cancel.isPending} savingLabel={t('ord.cancel.saving')} shortcut={false} danger icon={<Ban />} disabled={!trimmed}>
            {t('ord.cancel.submit')}
          </DialogPrimary>
        </>
      )}
    >
      <div className={styles.body} role="alertdialog" aria-label={t('ord.cancel.title', { id: number })}>
        <div className={styles.box}>
          <dl className={styles.facts}>
            <div><dt>{t('ord.cancel.order')}</dt><dd>{[number, order.buyerName, order.regionName].filter(Boolean).join(' · ')}</dd></div>
            <div>
              <dt>{t('ord.cancel.status')}</dt>
              <dd><StatusBadge family="order" code={order.status} />{line ? <span className={styles.note}>{line}</span> : null}</dd>
            </div>
            <div><dt>{t('ord.col.total')}</dt><dd>{t('ord.sum', { amount: formatMoney(order.totalAmount) })}</dd></div>
            {request ? (
              <div>
                <dt>{t('ord.cancel.request')}</dt>
                <dd>{t('ord.cancel.requestValue', { when: dayTime(request.createdAt, t, now, true) })}{request.comment ? <span className={styles.note}>«{request.comment}»</span> : null}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {order.status === 'PICKING' ? (
          <div className={styles.warn} role="note">
            <TriangleAlert aria-hidden />
            <div>
              <p>{t('ord.cancel.picking', { name: order.statusDetail ?? t('ord.cancel.picker') })}</p>
              <p>{t('ord.cancel.pickingText', { cell: order.stockCell ?? '—' })}</p>
            </div>
          </div>
        ) : null}
        <p className={styles.hint}>
          <Package aria-hidden />
          {order.stockCell ? t('ord.cancel.stockCell', { count: quantity, cell: order.stockCell }) : t('ord.cancel.stock', { count: quantity })}
        </p>
        <div>
          <div className={styles.labelRow}><label htmlFor={reasonId}>{t('ord.cancel.reason')}</label></div>
          <span className={styles.select}>
            <select id={reasonId} disabled defaultValue="">
              <option value="">{t('ord.cancel.reasonPending')}</option>
            </select>
            <ChevronDown aria-hidden />
          </span>
          <p className={styles.fieldHint}>{t('ord.cancel.reasonHint')}</p>
        </div>
        <div>
          <div className={styles.labelRow}>
            <label htmlFor={commentId}>{t('ord.cancel.comment')} <span className={styles.required} aria-hidden>*</span></label>
          </div>
          <textarea
            id={commentId}
            className={styles.textarea}
            value={comment}
            maxLength={REASON_MAX}
            required
            autoFocus
            placeholder={t('ord.cancel.placeholder')}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => setComment(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {invalid ? <p id={errorId} className={styles.error}><CircleAlert aria-hidden />{t('ord.cancel.commentError')}</p> : null}
        </div>
        <div className={styles.box}>
          <p className={styles.boxTitle}>{t('ord.cancel.after')}</p>
          <dl className={styles.facts}>
            <div>
              <dt>{t('ord.cancel.status')}</dt>
              <dd><StatusBadge family="order" code="CANCELLED" /><span className={styles.note}>{t('ord.cancel.final')}</span></dd>
            </div>
            <div><dt>{t('ord.cancel.stockLabel')}</dt><dd>{t('ord.cancel.stockValue', { count: quantity })}</dd></div>
            <div><dt>{t('ord.cancel.seller')}</dt><dd>{t('ord.cancel.sellerValue', { name: order.affiliateName ?? '—' })}</dd></div>
            {request ? <div><dt>{t('ord.cancel.requestAfter')}</dt><dd>{t('ord.cancel.requestAfterValue')}</dd></div> : null}
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
