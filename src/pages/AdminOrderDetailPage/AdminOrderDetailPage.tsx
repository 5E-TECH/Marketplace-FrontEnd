import { Ban, CalendarClock, CreditCard, Hash, PackageOpen, Printer, Store, Undo2, UserRound } from 'lucide-react';
import { Alert, App, Button, Form, Input, Modal, Space, Tooltip } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useAdminOrderQuery, useCancelAdminOrderMutation, useRefundAdminOrderMutation } from '../../features/orders/api/orderQueries';
import type { AdminOrder, AdminOrderStatus } from '../../features/orders/model/orderTypes';
import { getAdminOrderActionErrorMessage } from '../../features/orders/lib/getAdminOrderActionErrorMessage';
import { getAdminPaymentState } from '../../features/orders/lib/adminPaymentState';
import { AdminPaymentStatus } from '../../features/orders/ui/AdminPaymentStatus/AdminPaymentStatus';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { getApiErrorMessage } from '../../shared/api/apiError';
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
import { formatSkippedLabels, openOrderLabels, openParcelLabel, type LabelPrintResult } from '../../features/orders/api/orderLabelApi';

interface OrderLocationState {
  order?: AdminOrder;
}

type OrderAction = 'refund' | 'cancel';

/**
 * Backend faqat to‘langan online buyurtmani to‘liq qaytaradi; COD rad etiladi. Refund — faqat SUPERADMIN
 * (`POST /admin/orders/:id/refund` @Roles(SUPERADMIN)); ADMIN'ga tugma o‘chiq ko‘rinadi, 403 olib qolmasin.
 */
const REFUNDABLE_STATUSES: readonly AdminOrderStatus[] = ['PAID', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED'];
/** Backend majburiy bekor qilishga faqat shu holatlarda ruxsat beradi. */
const CANCELLABLE_STATUSES: readonly AdminOrderStatus[] = ['DRAFT', 'PENDING_PAYMENT'];

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, t } = useTranslation();
  const { message } = App.useApp();
  const [printing, setPrinting] = useState(false);
  const [printingParcelId, setPrintingParcelId] = useState<string | null>(null);
  const [action, setAction] = useState<OrderAction | null>(null);
  const [actionForm] = Form.useForm<{ reason: string }>();
  // Form validatsiyasi asinxron: isPending yoqilguncha ikkinchi bosish ham onFinish'ga yetadi.
  const submittingRef = useRef(false);
  const refund = useRefundAdminOrderMutation();
  const cancel = useCancelAdminOrderMutation();
  const query = useAdminOrderQuery(orderId ?? null);
  const role = useAppSelector(selectAuthUser)?.role;
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
          <ContentState state="error" title={t('adminOrders.loadError')} description={getApiErrorMessage(query.error)} onAction={() => void query.refetch()} />
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
  const warnSkipped = ({ skipped }: LabelPrintResult) => {
    if (skipped.length) void message.warning(t('order.labelsSkipped', { count: skipped.length, list: formatSkippedLabels(skipped) }));
  };
  const printLabel = async () => {
    setPrinting(true);
    try { warnSkipped(await openOrderLabels('admin', [orderId])); }
    catch (error) { void message.error(getApiErrorMessage(error)); }
    finally { setPrinting(false); }
  };
  const printParcel = async (sellerOrderId: string) => {
    if (printingParcelId) return;
    setPrintingParcelId(sellerOrderId);
    try { warnSkipped(await openParcelLabel(orderId, sellerOrderId)); }
    catch (error) { void message.error(getApiErrorMessage(error)); }
    finally { setPrintingParcelId(null); }
  };
  const refundable = Boolean(order && status && REFUNDABLE_STATUSES.includes(status) && getAdminPaymentState(order) === 'PAID');
  const canRefund = refundable && role === 'SUPERADMIN';
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
      { key: 'payment', icon: <CreditCard />, label: t('adminOrders.payment'), value: order ? <AdminPaymentStatus order={order} /> : '—' },
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
            {canRefund ? <Button danger icon={<Undo2 size={16} />} disabled={actionPending} onClick={() => setAction('refund')}>{t('adminOrders.refund')}</Button>
              : refundable ? <Tooltip title={t('adminOrders.refundSuperadminOnly')}><Button danger icon={<Undo2 size={16} />} disabled aria-describedby="refund-superadmin-only">{t('adminOrders.refund')}</Button></Tooltip> : null}
            {refundable && !canRefund ? <span id="refund-superadmin-only" className={styles.actionHint}>{t('adminOrders.refundSuperadminOnly')}</span> : null}
            <Button icon={<Printer size={16} />} loading={printing} onClick={() => void printLabel()}>{t('order.printLabel')}</Button>
            <Button icon={<PackageOpen size={16} />} onClick={() => void navigate(`/admin/returns?orderId=${encodeURIComponent(orderId)}`)}>{t('returns.orderReturns')}</Button>
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
        <AppDetailNotice value={query.data} onPrintParcel={(sellerOrderId) => void printParcel(sellerOrderId)} printingParcelId={printingParcelId} />
      </DetailPage>
      <Modal
        open={Boolean(action)}
        title={t(action === 'cancel' ? 'adminOrders.cancel' : 'adminOrders.refund')}
        okText={t(action === 'cancel' ? 'adminOrders.cancel' : 'adminOrders.refund')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true, loading: actionPending }}
        cancelButtonProps={{ disabled: actionPending }}
        closable={!actionPending}
        mask={{ closable: !actionPending }}
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
