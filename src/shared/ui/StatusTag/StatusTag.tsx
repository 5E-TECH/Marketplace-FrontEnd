import { Tag } from 'antd';
import styles from './StatusTag.module.css';
import { useTranslation } from '../../i18n/useTranslation';

const STATUS_CONFIG = {
  ACTIVE: { color: 'success', label: 'status.active' },
  INACTIVE: { color: 'default', label: 'status.inactive' },
  BLOCKED: { color: 'error', label: 'status.blocked' },
  PENDING: { color: 'warning', label: 'status.pending' },
  NEW: { color: 'processing', label: 'status.new' },
  CONFIRMED: { color: 'success', label: 'status.confirmed' },
  PROCESSING: { color: 'purple', label: 'status.processing' },
  SHIPPED: { color: 'cyan', label: 'status.shipped' },
  DELIVERED: { color: 'success', label: 'status.delivered' },
  CANCELLED: { color: 'error', label: 'status.cancelled' },
  LOW: { color: 'warning', label: 'status.low' },
  DRAFT: { color: 'default', label: 'status.draft' },
  PENDING_PAYMENT: { color: 'warning', label: 'status.pendingPayment' },
  PAID: { color: 'success', label: 'status.paid' },
  APPROVED: { color: 'success', label: 'status.approved' },
  HELD: { color: 'warning', label: 'status.held' },
  PARTIALLY_FULFILLED: { color: 'processing', label: 'status.partiallyFulfilled' },
  FULFILLED: { color: 'success', label: 'status.fulfilled' },
  REFUNDED: { color: 'orange', label: 'status.refunded' },
  ARCHIVED: { color: 'default', label: 'status.archived' },
  OUT_OF_STOCK: { color: 'error', label: 'status.outOfStock' },
  SHIPMENT_CREATED: { color: 'processing', label: 'status.shipmentCreated' },
  ON_THE_ROAD: { color: 'cyan', label: 'status.onTheRoad' },
  RETURNED: { color: 'orange', label: 'status.returned' },
} as const;

export type AppStatus = keyof typeof STATUS_CONFIG;

export function StatusTag({ status }: { status: AppStatus }) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];

  return (
    <Tag className={styles.tag} color={config.color} bordered={false}>
      {t(config.label)}
    </Tag>
  );
}
