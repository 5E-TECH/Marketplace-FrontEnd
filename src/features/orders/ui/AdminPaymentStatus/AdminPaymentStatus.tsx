import { Space } from 'antd';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { StatusTag } from '../../../../shared/ui/StatusTag/StatusTag';
import { getAdminPaymentState } from '../../lib/adminPaymentState';
import type { AdminOrder } from '../../model/orderTypes';

/** To'lov usuli va holati: "Online · To'langan" yoki "Yetkazilganda (naqd)". */
export function AdminPaymentStatus({ order }: { order: Pick<AdminOrder, 'paymentMethod' | 'paymentStatus' | 'status'> }) {
  const { t } = useTranslation();
  const state = getAdminPaymentState(order);
  if (!state) return <>—</>;
  if (state === 'COD') return <span>{t('adminOrders.paymentCod')}</span>;
  return <Space size={6} wrap><span>Online</span><StatusTag status={state} /></Space>;
}
