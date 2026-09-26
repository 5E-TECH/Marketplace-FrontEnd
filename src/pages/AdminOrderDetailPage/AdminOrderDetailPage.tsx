import { Ban, CalendarClock, CreditCard, Hash, Printer, Store, Undo2, UserRound } from 'lucide-react';
import { Alert, App, Button, Form, Input, Modal, Space } from 'antd';
import { useLocation, useParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useAdminOrderQuery, useCancelAdminOrderMutation, useRefundAdminOrderMutation } from '../../features/orders/api/orderQueries';
import type { AdminOrder, AdminOrderStatus } from '../../features/orders/model/orderTypes';
import { getAdminOrderActionErrorMessage } from '../../features/orders/lib/getAdminOrderActionErrorMessage';
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
import { openOrderLabels } from '../../features/orders/api/orderLabelApi';

interface OrderLocationState {
  order?: AdminOrder;
}

type OrderAction = 'refund' | 'cancel';

/** Backend faqat to‘langan online buyurtmani to‘liq qaytaradi; COD rad etiladi. */
const REFUNDABLE_STATUSES: readonly AdminOrderStatus[] = ['PAID', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED'];
/** Backend majburiy bekor qilishga faqat shu holatlarda ruxsat beradi. */
const CANCELLABLE_STATUSES: readonly AdminOrderStatus[] = ['DRAFT', 'PENDING_PAYMENT'];

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const { locale, t } = useTranslation();
  const { message } = App.useApp();
  const [printing, setPrinting] = useState(false);
  const [action, setAction] = useState<OrderAction | null>(null);
  const [actionForm] = Form.useForm<{ reason: string }>();
  // Form validatsiyasi asinxron: isPending yoqilguncha ikkinchi bosish ham onFinish'ga yetadi.
  const submittingRef = useRef(false);
  const refund = useRefundAdminOrderMutation();
  const cancel = useCancelAdminOrderMutation();
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
  const printLabel = async () => {
    setPrinting(true);
    try { await openOrderLabels('admin', [orderId]); }
    catch (error) { void message.error(getAuthErrorMessage(error)); }
    finally { setPrinting(false); }
  };
  const canRefund = order?.paymentMethod === 'online' && Boolean(status && REFUNDABLE_STATUSES.includes(status));
  const canCancel = Boolean(status && CANCELLABLE_STATUSES.includes(status));
  const actionPending = refund.isPending || cancel.isPending;
  const closeAction = () => setAction(null);
  const submitAction = ({ reason }: { reason: string }) => {
    if (!action || submittingRef.current) return;
    submittingRef.current = true;
    const current = action;
    (current === 'refund' ? refund : cancel).mutate({ id: orderId, reason: reason.trim() }, {
      onSuccess: ({ idempotent }) => {
        closeAction();
        if (idempotent) void message.info(t(current === 'refund' ? 'adminOrders.refundIdempotent' : 'adminOrders.cancelIdempotent'));
        else void message.success(t(current === 'refund' ? 'adminOrders.refundSuccess' : 'adminOrders.cancelSuccess'));
      },
      onError: (error) => void message.error(getAdminOrderActionErrorMessage(error, t)),
      onSettled: () => { submittingRef.current = false; },
    });
  };
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
    <>
      <DetailPage
        backFallback="/admin/orders"
        title={`${t('adminOrders.order')} #${order?.orderNumber ?? orderId}`}
        description={t('adminOrders.detailSubtitle')}
        actions={
          <Space wrap>
            {canCancel ? <Button icon={<Ban size={16} />} disabled={actionPending} onClick={() => setAction('cancel')}>{t('adminOrders.cancel')}</Button> : null}
            {canRefund ? <Button danger icon={<Undo2 size={16} />} disabled={actionPending} onClick={() => setAction('refund')}>{t('adminOrders.refund')}</Button> : null}
            <Button icon={<Printer size={16} />} loading={printing} onClick={() => void printLabel()}>Yorliqni chop etish</Button>
          </Space>
        }
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
      <Modal
        open={Boolean(action)}
        title={t(action === 'cancel' ? 'adminOrders.cancel' : 'adminOrders.refund')}
        okText={t(action === 'cancel' ? 'adminOrders.cancel' : 'adminOrders.refund')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true, loading: actionPending }}
        cancelButtonProps={{ disabled: actionPending }}
        closable={!actionPending}
        maskClosable={!actionPending}
        keyboard={!actionPending}
        onCancel={closeAction}
        onOk={() => actionForm.submit()}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title={action === 'cancel' ? t('adminOrders.cancelWarning') : t('adminOrders.refundWarning', { amount: formatMoney(order?.totalAmount ?? 0) })}
        />
        <Form<{ reason: string }> form={actionForm} layout="vertical" onFinish={submitAction} className={styles.actionForm}>
          <Form.Item name="reason" label={t('adminOrders.reason')} rules={[{ required: true, whitespace: true, message: t('adminOrders.reasonRequired') }, { min: 5, message: t('adminOrders.reasonMin') }, { max: 500 }]}>
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
