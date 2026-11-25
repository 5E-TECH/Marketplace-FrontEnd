import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime } from '../../../shared/lib/dayTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { statusKey } from '../../../shared/ui/StatusBadge/statusConfig';
import { AT_ELCHI } from '../lib/orderStatus';
import { isFreshOrder, orderNumber, placeLine, statusLine } from '../lib/orderView';
import type { OrderListItem, OrderListQuery } from '../model/orderTypes';
import styles from './OrderList.module.css';

/** Ustunlar: admin — buyurtma, mijoz, sahifa, summa, holat, trek; nazoratchi — tasdiqlagan, bekor qilish; operator — tovar. */
export type OrderColumn = 'order' | 'customer' | 'stream' | 'confirmedBy' | 'product' | 'total' | 'status' | 'track' | 'cancel';

const SKELETON = [0, 1, 2, 3, 4];

interface OrdersTableProps {
  rows: readonly OrderListItem[];
  columns: readonly OrderColumn[];
  hrefOf: (order: OrderListItem) => string;
  now: number;
  caption: string;
  sort: NonNullable<OrderListQuery['sort']>;
  onSort: () => void;
  /** Qator bosilganda — tafsilot paneli (admin); berilmasa qator bosilmaydi. */
  onOpen?: (order: OrderListItem) => void;
  activeId?: string | null;
  /** Oxirgi ustun — qator amallari (⋯) yoki «Bekor qilish» tugmasi. */
  actions?: (order: OrderListItem) => ReactNode;
  /** «Bekor qilish» ustuni (nazoratchi, operator). */
  cancelCell?: (order: OrderListItem) => ReactNode;
  /**
   * Operator (operator-buyurtmalarim): buyurtma raqami — panelni ochadigan tugma (operatorda to'liq sahifa yo'q), ostida
   * «tasdiq bugun, 10:24»; qatorning o'zi bosilmaydi.
   */
  openByNumber?: boolean;
  body?: ReactNode;
  loading?: boolean;
}

/**
 * Buyurtmalar jadvali (admin-buyurtmalar, nazoratchi-buyurtmalar, operator-buyurtmalarim). Buyurtma lid raqami bilan
 * ko'rinadi; «Holat · o'zgardi» — saralanadi. Planshetda (container `content`) «Sahifa · sotuvchi» va trek yashiriladi.
 */
export function OrdersTable({ rows, columns, hrefOf, now, caption, sort, onSort, onOpen, activeId, actions, cancelCell, openByNumber = false, body, loading }: OrdersTableProps) {
  const { t } = useTranslation();
  const count = columns.length + (actions ? 1 : 0);
  const desc = sort.startsWith('-');

  const cell = (order: OrderListItem, column: OrderColumn) => {
    switch (column) {
      case 'order':
        return (
          <td key={column} className={styles.orderCell}>
            {openByNumber ? (
              <button type="button" className={styles.orderButton} aria-label={t('ord.openDetails', { id: orderNumber(order) })} onClick={() => onOpen?.(order)}>{orderNumber(order)}</button>
            ) : <Link to={hrefOf(order)} className={styles.orderLink} onClick={(event) => event.stopPropagation()}>{orderNumber(order)}</Link>}
            <span className={styles.cellNote}>
              {openByNumber && order.confirmedBy ? t('ord.confirmedAt', { when: dayTime(order.confirmedBy.at, t, now, true) }) : dayTime(order.createdAt, t, now, true)}
            </span>
          </td>
        );
      case 'customer':
        return (
          <td key={column}>
            <span className={styles.stack}>
              <span>{order.buyerName}</span>
              <span>{placeLine(order) ?? '—'}</span>
            </span>
          </td>
        );
      case 'stream':
        return (
          <td key={column} data-col="stream">
            <span className={styles.stream}>
              {order.streamCode ? <span className={styles.code}>{order.streamCode}</span> : null}
              <span>{order.affiliateName ?? '—'}</span>
            </span>
          </td>
        );
      case 'confirmedBy':
        return (
          <td key={column}>
            {order.confirmedBy?.name ?? '—'}
          </td>
        );
      case 'product':
        return (
          <td key={column}>
            <span className={`${styles.stack} ${styles.plain}`}>
              <span>{order.productName ?? '—'}</span>
              <span>{order.quantity ? t('ord.qty', { count: order.quantity }) : null}</span>
            </span>
          </td>
        );
      case 'total':
        return (
          <td key={column} className={styles.num}>
            <span className={styles.amount}>
              <span>{t('ord.sum', { amount: formatMoney(order.totalAmount) })}</span>
              {order.whereDeliver ? <span>{t(`opw.whereDeliver.${order.whereDeliver}`)}</span> : null}
            </span>
          </td>
        );
      case 'status': {
        const line = statusLine(order, t, now);
        return (
          <td key={column} className={styles.statusCell}>
            <span className={styles.statusStack}>
              <StatusBadge family="order" code={order.status} />
              {line ? <span>{line}</span> : null}
            </span>
          </td>
        );
      }
      case 'track':
        return (
          <td key={column} data-col="track">
            <span className={styles.track}>
              {order.trackNumber ?? (order.status === 'CANCELLED' ? '—' : AT_ELCHI.includes(order.status) ? t('ord.trackPending') : t('ord.trackOnHandover'))}
            </span>
          </td>
        );
      case 'cancel':
        return <td key={column}>{cancelCell?.(order)}</td>;
      default:
        return null;
    }
  };

  const header = (column: OrderColumn) => {
    if (column === 'status') {
      const Icon = desc ? ArrowDown : ArrowUp;
      return (
        <th key={column} aria-sort={desc ? 'descending' : 'ascending'}>
          <button type="button" className={styles.sort} onClick={onSort}>
            {t('ord.col.status')}
            <Icon aria-hidden />
          </button>
        </th>
      );
    }
    return (
      <th key={column} className={column === 'total' ? styles.num : undefined} data-col={column === 'stream' || column === 'track' ? column : undefined}>
        {t(`ord.col.${column}`)}
      </th>
    );
  };

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className={styles.visuallyHidden}>{caption}</caption>
        <thead>
          <tr>
            {columns.map(header)}
            {actions ? <th className={styles.actions}><span className={styles.visuallyHidden}>{t('ord.col.actions')}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {loading ? SKELETON.map((row) => (
            <tr key={row} aria-hidden>
              {columns.map((column) => (
                <td key={column} data-col={column === 'stream' || column === 'track' ? column : undefined}>
                  <span className={styles.bone} data-shape={column === 'status' || column === 'stream' ? 'pill' : undefined} style={{ width: column === 'customer' ? 120 : column === 'status' ? 96 : 70, marginLeft: column === 'total' ? 'auto' : undefined }} />
                </td>
              ))}
              {actions ? <td className={styles.actions} /> : null}
            </tr>
          )) : body ? (
            <tr className={styles.messageRow}><td colSpan={count}>{body}</td></tr>
          ) : rows.map((order) => (
            <tr
              key={order.id}
              data-testid="order-row"
              data-fresh={isFreshOrder(order, now) || undefined}
              data-active={activeId === order.id || undefined}
              data-clickable={onOpen && !openByNumber ? true : undefined}
              onClick={onOpen && !openByNumber ? () => onOpen(order) : undefined}
            >
              {columns.map((column) => cell(order, column))}
              {actions ? <td className={styles.actions} onClick={(event) => event.stopPropagation()}>{actions(order)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface OrderCardsProps {
  rows: readonly OrderListItem[];
  hrefOf: (order: OrderListItem) => string;
  now: number;
  caption: string;
  shownLabel: string;
  moreLabel: string;
  onMore: (() => void) | null;
}

/** Telefon (admin-buyurtmalar.mobil): karta bosilsa buyurtma sahifasi (R8); kartada ⋯ yo'q. */
export function OrderCards({ rows, hrefOf, now, caption, shownLabel, moreLabel, onMore }: OrderCardsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.cardList}>
      <ul aria-label={caption}>
        {rows.map((order) => {
          const line = statusLine(order, t, now);
          return (
            <li key={order.id} data-testid="order-row" data-fresh={isFreshOrder(order, now) || undefined}>
              <Link to={hrefOf(order)} className={styles.cardLink} aria-label={t('ord.cardOpen', { id: orderNumber(order), name: order.buyerName, status: t(statusKey('order', order.status)) })}>
                <span className={styles.cardTop}>
                  <span className={styles.cardId}>{orderNumber(order)}</span>
                  <StatusBadge family="order" code={order.status} />
                </span>
                <span className={styles.cardName}>
                  {order.buyerName}
                  {order.districtName ? <span> · {order.districtName}</span> : null}
                </span>
                <span className={styles.cardBottom}>
                  <span className={styles.cardMeta}>{order.productName ? `${order.productName} × ${order.quantity ?? 1}` : null}</span>
                  <span className={styles.cardPrice}>{t('ord.sum', { amount: formatMoney(order.totalAmount) })}</span>
                </span>
                {line ? <span className={styles.cardLine}>{line}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={styles.cardMore}>
        {onMore ? <button type="button" className={styles.secondary} onClick={onMore}><ChevronDown aria-hidden />{moreLabel}</button> : null}
        <p role="status">{shownLabel}</p>
      </div>
    </div>
  );
}
