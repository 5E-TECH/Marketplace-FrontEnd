import { Tag } from 'antd';
import styles from './StatusTag.module.css';

const STATUS_CONFIG = {
  ACTIVE: { color: 'success', label: 'Faol' },
  INACTIVE: { color: 'default', label: 'Nofaol' },
  BLOCKED: { color: 'error', label: 'Bloklangan' },
  PENDING: { color: 'warning', label: 'Kutilmoqda' },
  NEW: { color: 'processing', label: 'Yangi' },
  CONFIRMED: { color: 'success', label: 'Tasdiqlangan' },
  PROCESSING: { color: 'purple', label: 'Tayyorlanmoqda' },
  SHIPPED: { color: 'cyan', label: 'Yo‘lda' },
  DELIVERED: { color: 'success', label: 'Yetkazildi' },
  CANCELLED: { color: 'error', label: 'Bekor qilindi' },
  LOW: { color: 'warning', label: 'Kam qoldiq' },
  DRAFT: { color: 'default', label: 'Qoralama' },
  PENDING_PAYMENT: { color: 'warning', label: 'To‘lov kutilmoqda' },
  PAID: { color: 'success', label: 'To‘langan' },
  APPROVED: { color: 'success', label: 'Tasdiqlangan' },
  HELD: { color: 'warning', label: 'Ushlab turilgan' },
  PARTIALLY_FULFILLED: { color: 'processing', label: 'Qisman bajarilgan' },
  FULFILLED: { color: 'success', label: 'Bajarilgan' },
  REFUNDED: { color: 'orange', label: 'Qaytarilgan' },
  ARCHIVED: { color: 'default', label: 'Arxivlangan' },
  OUT_OF_STOCK: { color: 'error', label: 'Sotuvda yo‘q' },
  SHIPMENT_CREATED: { color: 'processing', label: 'Elchi yaratildi' },
  ON_THE_ROAD: { color: 'cyan', label: 'Yo‘lda' },
  RETURNED: { color: 'orange', label: 'Qaytarildi' },
} as const;

export type AppStatus = keyof typeof STATUS_CONFIG;

export function StatusTag({ status }: { status: AppStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Tag className={styles.tag} color={config.color} bordered={false}>
      {config.label}
    </Tag>
  );
}
