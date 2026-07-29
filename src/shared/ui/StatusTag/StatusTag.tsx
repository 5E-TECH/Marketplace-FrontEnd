import { Tag } from 'antd';

const STATUS_CONFIG = {
  ACTIVE: { color: 'success', label: 'Faol' },
  INACTIVE: { color: 'default', label: 'Nofaol' },
  PENDING: { color: 'warning', label: 'Kutilmoqda' },
  NEW: { color: 'processing', label: 'Yangi' },
  PROCESSING: { color: 'purple', label: 'Tayyorlanmoqda' },
  SHIPPED: { color: 'cyan', label: 'Yo‘lda' },
  DELIVERED: { color: 'success', label: 'Yetkazildi' },
  CANCELLED: { color: 'error', label: 'Bekor qilindi' },
  LOW: { color: 'warning', label: 'Kam qoldiq' },
} as const;

export type AppStatus = keyof typeof STATUS_CONFIG;

export function StatusTag({ status }: { status: AppStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Tag color={config.color} bordered={false}>
      {config.label}
    </Tag>
  );
}
