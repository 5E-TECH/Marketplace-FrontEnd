import { Timeline } from 'antd';
import { Package } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { formatDateTime } from '../../../../shared/lib/date';
import { DetailList, type DetailItem } from '../../../../shared/ui/DetailList/DetailList';
import type { ReturnRequestDetail, ReturnScope, ReturnStatus } from '../../model/returnTypes';
import { returnMoney as money } from '../../lib/returnMoney';
import { ReturnStatusTag } from '../ReturnStatusTag/ReturnStatusTag';
import styles from './ReturnDetails.module.css';

const ACTORS = ['BUYER', 'SELLER', 'OPERATOR', 'ADMIN', 'SUPERADMIN', 'SYSTEM'] as const;
const timelineColors: Record<ReturnStatus, string> = { SUBMITTED: 'blue', IN_REVIEW: 'orange', APPROVED: 'green', REJECTED: 'red', REFUNDED: 'cyan' };

/**
 * Qaytarish so'rovining to'liq ko'rinishi: ma'lumotlar, tovarlar va holat tarixi.
 * Amallar (tugmalar) chaqiruvchi tomonidan beriladi — sotuvchi va admin qoidalari farq qiladi.
 */
export function ReturnDetails({ value, scope, actions }: { value: ReturnRequestDetail; scope: ReturnScope; actions?: ReactNode }) {
  const { locale, t } = useTranslation();
  const date = (iso: string) => formatDateTime(iso, locale);
  const actor = (role: string) => (ACTORS as readonly string[]).includes(role) ? t(`returns.actor.${role as typeof ACTORS[number]}` as TranslationKey) : role || '—';
  const items: DetailItem[] = [
    { label: t('returns.statusLabel'), value: <ReturnStatusTag status={value.status} /> },
    {
      label: t('returns.order'),
      value: <span className={styles.inline}>{scope === 'admin' ? <Link to={`/admin/orders/${encodeURIComponent(value.orderId)}`}>#{value.orderId}</Link> : `#${value.orderId}`}<small>{t('returns.parcel')} #{value.sellerOrderId}</small></span>,
    },
    ...(scope === 'admin' ? [{ label: t('returns.shop'), value: value.shopName ?? `#${value.shopId}` }] : []),
    { label: t('returns.buyer'), value: value.buyerName ?? '—' },
    { label: t('returns.reasonLabel'), value: t(`returns.reason.${value.reason}`) },
    ...(value.comment ? [{ label: t('returns.buyerComment'), value: <span className={styles.text}>{value.comment}</span> }] : []),
    { label: t('returns.payment'), value: value.paymentMethod.toUpperCase() },
    { label: t('returns.requestedAmount'), value: <strong>{money(value.requestedAmount)}</strong> },
    ...(value.refundedAmount !== null ? [{ label: t('returns.refundedAmount'), value: <strong>{money(value.refundedAmount)}</strong> }] : []),
    ...(value.restocked !== null ? [{ label: t('returns.restocked'), value: value.restocked ? t('returns.yes') : t('returns.no') }] : []),
    ...(value.decisionComment ? [{ label: t('returns.decisionComment'), value: <span className={styles.text}>{value.decisionComment}</span> }] : []),
    ...(value.decidedAt ? [{ label: t('returns.decidedAt'), value: date(value.decidedAt) }] : []),
    ...(value.refundedAt ? [{ label: t('returns.refundedAt'), value: date(value.refundedAt) }] : []),
    { label: t('returns.createdAt'), value: date(value.createdAt) },
  ];

  return <div className={styles.root}>
    <DetailList items={items} />
    {actions ? <div className={styles.actions}>{actions}</div> : null}
    <section className={styles.section} aria-label={t('returns.items')}>
      <h3>{t('returns.items')}</h3>
      <ul className={styles.items}>{value.items.map((item) => <li key={item.id}>
        <span className={styles.thumb}>{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <Package size={18} aria-hidden />}</span>
        <span className={styles.itemText}><strong>{item.productName}</strong><small>{item.quantity} × {money(item.unitPrice)}</small></span>
        <b>{money(item.lineTotal)}</b>
      </li>)}</ul>
    </section>
    <section className={styles.section} aria-label={t('returns.history')}>
      <h3>{t('returns.history')}</h3>
      <Timeline items={value.history.map((entry) => ({
        color: timelineColors[entry.toStatus],
        content: <div className={styles.event}>
          <strong>{t(`returns.status.${entry.toStatus}`)}</strong>
          <span>{actor(entry.actorRole)} · {date(entry.createdAt)}</span>
          {entry.comment ? <p>{entry.comment}</p> : null}
        </div>,
      }))} />
    </section>
  </div>;
}
