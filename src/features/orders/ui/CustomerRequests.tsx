import { Ban, Check, ChevronRight, Info, Lock, MapPin, Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { rich } from '../../../shared/i18n/richText';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime, shortTime } from '../../../shared/lib/dayTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { useCustomerRequestsQuery } from '../api/ordersQueries';
import { isCancelable } from '../lib/orderStatus';
import { orderNumber, placeLine, statusLine } from '../lib/orderView';
import type { CustomerRequestRow } from '../model/orderTypes';
import styles from './CustomerRequests.module.css';

/** Shu sessiyada bajarilgan so'rov: qator «Bajarildi» bilan qoladi, keyin «Yopilgan so'rovlar»ga o'tadi (dizayn). */
export type DoneRequest = { row: CustomerRequestRow; at: string; by: string };

interface CustomerRequestsProps {
  phone: boolean;
  now: number;
  done: readonly DoneRequest[];
  orderHref: (id: string) => string;
  onCancel: (row: CustomerRequestRow) => void;
  onAddress: (row: CustomerRequestRow) => void;
  onClose: (row: CustomerRequestRow) => void;
}

/**
 * «Mijoz so'rovlari» (nazoratchi-buyurtmalar, 47-qaror [taklif]): mijoz «Buyurtmam qayerda» sahifasidan bekor qilish yoki
 * manzilni o'zgartirishni so'raydi — Elchi'ga topshirilgunga qadar bajariladi; kech qolgan so'rov faqat yopiladi (izoh bilan).
 */
export function CustomerRequests({ phone, now, done, orderHref, onCancel, onAddress, onClose }: CustomerRequestsProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [closedView, setClosedView] = useState(false);
  const open = useCustomerRequestsQuery('OPEN');
  const closed = useCustomerRequestsQuery('CLOSED');
  const doneIds = new Set(done.map((item) => item.row.id));
  const openRows = (open.data ?? []).filter((row) => !doneIds.has(row.id));
  const rows: Array<{ row: CustomerRequestRow; done: DoneRequest | null }> = closedView
    ? (closed.data ?? []).map((row) => ({ row, done: null }))
    : [...openRows.map((row) => ({ row, done: null })), ...done.map((item) => ({ row: item.row, done: item }))];
  const loading = closedView ? closed.isPending : open.isPending;

  const actions = (row: CustomerRequestRow, finished: DoneRequest | null) => {
    if (finished) return <span className={styles.done}><Check aria-hidden />{t('ord.req.done', { time: shortTime(finished.at, now), by: finished.by })}</span>;
    if (row.state !== 'OPEN') {
      return (
        <span className={row.state === 'DONE' ? styles.done : styles.closedState}>
          {row.state === 'DONE' ? <Check aria-hidden /> : null}
          {t(row.state === 'DONE' ? 'ord.req.done' : 'ord.req.closed', { time: row.closedAt ? shortTime(row.closedAt, now) : '—', by: row.closedBy ?? '—' })}
        </span>
      );
    }
    const number = row.order ? orderNumber(row.order) : row.orderId;
    const cancelable = row.order ? isCancelable(row.order.status) : false;
    return (
      <>
        {!cancelable ? <span className={styles.late}><Lock aria-hidden />{t('ord.req.late')}</span>
          : row.kind === 'CANCEL' ? <button type="button" className={styles.danger} aria-label={t('ord.req.cancelAria', { id: number })} onClick={() => onCancel(row)}><Ban aria-hidden />{t('ord.menu.cancel')}</button>
            : <button type="button" className={styles.secondary} onClick={() => onAddress(row)}><Pencil aria-hidden />{t('ord.req.address')}</button>}
        <button type="button" className={styles.ghost} onClick={() => onClose(row)}>{t('ord.req.close')}</button>
      </>
    );
  };

  return (
    <section className={styles.card} aria-labelledby={headingId} data-layout={phone ? 'phone' : undefined} data-testid="customer-requests">
      <div className={styles.head}>
        <div>
          <div className={styles.titleRow}>
            <h2 id={headingId}>{t(closedView ? 'ord.req.closedTitle' : 'ord.req.title')}</h2>
            {!closedView && openRows.length ? <span className={styles.count}>{openRows.length}</span> : null}
          </div>
          <p>{t('ord.req.subtitle')}</p>
        </div>
        {phone ? null : (
          <button type="button" className={styles.link} aria-pressed={closedView} onClick={() => setClosedView((value) => !value)}>
            {t(closedView ? 'ord.req.showOpen' : 'ord.req.showClosed')}
            <ChevronRight aria-hidden />
          </button>
        )}
      </div>
      {loading ? (
        <ul className={styles.list} aria-busy="true"><li className={styles.skeleton}><span /><span /><span /></li></ul>
      ) : rows.length ? (
        <ul className={styles.list}>
          {rows.map(({ row, done: finished }) => {
            const order = row.order ?? null;
            const number = order ? orderNumber(order) : row.orderId;
            const line = order ? statusLine(order, t, now) : null;
            const meta = order ? t('ord.req.orderMeta', { amount: formatMoney(order.totalAmount), name: order.confirmedBy?.name ?? '—' }) : null;
            return (
              <li key={row.id} data-testid="customer-request" data-done={finished || row.state === 'DONE' || undefined}>
                <div className={styles.what}>
                  <span className={styles.icon} data-kind={row.kind} aria-hidden>{row.kind === 'CANCEL' ? <Ban /> : <MapPin />}</span>
                  <div>
                    <span>{t(row.kind === 'CANCEL' ? 'ord.req.kindCancel' : 'ord.req.kindAddress')}</span>
                    <span>{t('ord.req.when', { when: dayTime(row.createdAt, t, now, true) })}</span>
                    {row.kind === 'CHANGE_ADDRESS' ? (
                      <span>{rich(t('ord.req.addressChange', { where: row.whereDeliver ? t(`opw.whereDeliver.${row.whereDeliver}`) : '—' }), { from: <span className={styles.muted}>{order?.districtName ?? '—'}</span>, to: <strong>{row.districtName ?? '—'}</strong> })}</span>
                    ) : row.comment ? <span>{t('ord.req.comment', { text: row.comment })}</span> : null}
                    {row.closedComment ? <span className={styles.muted}>{t('ord.req.answer', { text: row.closedComment })}</span> : null}
                  </div>
                </div>
                {phone ? (
                  <Link to={orderHref(row.orderId)} className={styles.orderBox} aria-label={t('ord.req.openOrder', { id: number, name: order?.buyerName ?? '' })}>
                    <span className={styles.orderTop}><strong>{`${number} · ${order?.buyerName ?? '—'}`}</strong><ChevronRight aria-hidden /></span>
                    {order ? <span className={styles.muted}>{placeLine(order) ?? '—'}</span> : null}
                    {order ? <span className={styles.statusRow}><StatusBadge family="order" code={order.status} />{line ? <span>{line}</span> : null}</span> : null}
                    {meta ? <span className={styles.meta}>{meta}</span> : null}
                  </Link>
                ) : (
                  <div className={styles.order}>
                    <span>
                      <Link to={orderHref(row.orderId)}>{number}</Link>{' · '}<strong>{order?.buyerName ?? '—'}</strong>{order && placeLine(order) ? <span className={styles.muted}>{` · ${placeLine(order)}`}</span> : null}
                    </span>
                    {order ? <span className={styles.statusRow}><StatusBadge family="order" code={order.status} />{line ? <span>{line}</span> : null}</span> : null}
                    {meta ? <span className={styles.meta}>{meta}</span> : null}
                  </div>
                )}
                <div className={styles.actions}>{actions(row, finished)}</div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}><Info aria-hidden />{t(closedView ? 'ord.req.emptyClosed' : 'ord.req.empty')}</p>
      )}
      <p className={styles.note}><Info aria-hidden />{t('ord.req.note')}</p>
      {phone ? (
        <button type="button" className={`${styles.link} ${styles.footLink}`} aria-pressed={closedView} onClick={() => setClosedView((value) => !value)}>
          {t(closedView ? 'ord.req.showOpen' : 'ord.req.showClosed')}
          <ChevronRight aria-hidden />
        </button>
      ) : null}
    </section>
  );
}
