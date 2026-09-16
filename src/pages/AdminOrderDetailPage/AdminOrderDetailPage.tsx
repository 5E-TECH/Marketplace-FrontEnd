import { CalendarClock, CreditCard, Hash, Store, UserRound } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { useAdminOrderQuery } from '../../features/orders/api/orderQueries';
import type { AdminOrder } from '../../features/orders/model/orderTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DetailPage, type DetailPageSection } from '../../shared/ui/DetailPage/DetailPage';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { AppDetailNotice } from '../AdminOrdersPage/AdminOrdersPage';
import styles from './AdminOrderDetailPage.module.css';

interface OrderLocationState {
  order?: AdminOrder;
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const { locale, t } = useTranslation();
  const query = useAdminOrderQuery(orderId ?? null);
  const routeOrder = (location.state as OrderLocationState | null)?.order;
  const order = query.data?.summary ?? (routeOrder?.id === orderId ? routeOrder : null);

  if (!orderId || query.isPending || query.isError || !query.data) {
    return (
      <main className={styles.page}>
        <PageHeader
          before={<BackButton fallback="/admin/orders" />}
          title={t('adminOrders.detail')}
          description={orderId ? `${t('adminOrders.order')} #${orderId}` : t('adminOrders.detailFormat')}
        />
        {!orderId ? (
          <ContentState state="error" description={t('adminOrders.detailFormat')} />
        ) : query.isError ? (
          <ContentState state="error" title={t('adminOrders.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />
        ) : (
          <ContentState state="loading" />
        )}
      </main>
    );
  }

  const shops = query.data.sellerOrders
    .map((item) => item.shopName || (item.shopId ? `#${item.shopId}` : null))
    .filter((value): value is string => Boolean(value))
    .join(', ');
  const status = order?.status;
  const sections: DetailPageSection[] = [{
    key: 'summary',
    icon: <Hash aria-hidden />,
    title: t('adminOrders.detail'),
    description: t('adminOrders.detailSubtitle'),
    fields: [
      { key: 'buyer', icon: <UserRound />, label: t('adminOrders.buyer'), value: order?.buyerName || '—' },
      { key: 'phone', icon: <UserRound />, label: t('users.phone'), value: order?.buyerPhone || '—' },
      { key: 'shop', icon: <Store />, label: t('adminOrders.shopId'), value: order?.shopName || (order?.shopId ? `#${order.shopId}` : shops || '—') },
      { key: 'amount', icon: <CreditCard />, label: t('adminOrders.amount'), value: order ? `${formatMoney(order.totalAmount)} UZS` : '—' },
      { key: 'payment', icon: <CreditCard />, label: t('adminOrders.payment'), value: order?.paymentMethod?.toUpperCase() || '—' },
      { key: 'created', icon: <CalendarClock />, label: t('users.createdAt'), value: order?.createdAt ? formatDateTime(order.createdAt, locale) : '—' },
    ],
  }];

  return (
    <DetailPage
      backFallback="/admin/orders"
      title={`${t('adminOrders.order')} #${order?.orderNumber ?? orderId}`}
      description={t('adminOrders.detailSubtitle')}
      hero={{
        avatarFallback: (order?.buyerName || orderId).slice(0, 2).toUpperCase(),
        title: order?.buyerName || `${t('adminOrders.order')} #${orderId}`,
        subtitle: order?.buyerPhone || `#${orderId}`,
        badges: status ? <StatusTag status={status === 'FULFILLED' ? 'SHIPMENT_CREATED' : status} /> : undefined,
      }}
      sections={sections}
    >
      <AppDetailNotice value={query.data} />
    </DetailPage>
  );
}
