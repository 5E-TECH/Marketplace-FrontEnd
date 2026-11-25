import axios from 'axios';
import { App } from 'antd';
import { Ban, Ellipsis, ExternalLink, Flag, Inbox, MapPin, MessageSquare, Printer, SearchX, Send, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import { useCloseDisputeMutation, useOrderQuery, useRefreshFromElchiMutation } from '../../features/orders/api/ordersQueries';
import { AT_ELCHI, isCancelable } from '../../features/orders/lib/orderStatus';
import { cancelBlock, orderListItem } from '../../features/orders/lib/orderView';
import type { OrderRole } from '../../features/orders/model/orderTypes';
import { CancelOrderDialog } from '../../features/orders/ui/CancelOrderDialog';
import { AddressDialog, DisputeDialog, ResendDialog, ReturnDialog, SmsDialog } from '../../features/orders/ui/OrderCardDialogs';
import { OrderLabelDialog } from '../../features/orders/ui/OrderLabelDialog';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { useNow } from '../../shared/lib/useNow';
import { Dialog } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import record from '../../shared/ui/RecordCard/RecordCard.module.css';
import { OrderNow, type OrderCardAction } from './components/OrderNow';
import { CustomerSection, DisputeSection, ElchiSection, HistorySection, MoneySection, ParcelSection, PickingSection, PriceSection, ReceiptSection, SmsSection, SourceSection } from './components/OrderSections';
import { isStale, orderLeadLabel } from './model/orderCard';
import own from './AdminOrderPage.module.css';

const styles = { ...record, ...own };

type DialogKind = 'cancel' | 'return' | 'dispute' | 'resend' | 'address' | 'sms' | 'label' | 'sheet';

/**
 * Buyurtma kartasi (FE-26, admin-buyurtma-karta; `GET /admin/orders/{id}`): «Hozir» bloki (holat, yo'l, ko'rsatkichlar,
 * amallar), mijoz va manzil, narx nusxasi, pul yozuvlari, holat tarixi; yon ustunda posilka va Elchi, Elchi hodisalari,
 * SMS, yig'ish, fiskal chek, lid va manba. `?return=1` — ro'yxatdagi «Qaytarish so'rovini qayd etish» oynasi ochiq.
 */
export default function AdminOrderPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const { orderId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const role = useCurrentUserQuery().data?.role;
  const admin = role === 'ADMIN' || role === 'SUPERADMIN';
  const queryRole: OrderRole = admin ? 'ADMIN' : 'SUPERVISOR';
  const base = admin ? '/admin/orders' : '/supervisor/orders';
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const query = useOrderQuery(queryRole, orderId);
  const order = query.data;
  const refresh = useRefreshFromElchiMutation();
  const closeDispute = useCloseDisputeMutation();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  usePageTitle(t('ordc.pageTitle', { id: order ? orderLeadLabel(order) : orderId }));

  // Ro'yxatdagi «Qaytarish so'rovini qayd etish» (`?return=1`) — faqat «Yetkazildi» buyurtmada; yopilganda parametr ketadi.
  const requested: DialogKind | null = params.get('return') && order?.status === 'DELIVERED' && admin ? 'return' : null;
  const active = dialog ?? requested;
  const closeDialog = () => {
    setDialog(null);
    if (!params.has('return')) return;
    const next = new URLSearchParams(params);
    next.delete('return');
    setParams(next, { replace: true });
  };
  const placement = phone ? 'top' : 'bottomRight';

  if (query.isPending) {
    return (
      <div className={styles.page} aria-busy="true" data-testid="order-card-loading">
        <span className={styles.skeleton} style={{ height: 260 }} />
        <span className={styles.skeleton} style={{ height: 360 }} />
      </div>
    );
  }
  if (!order) {
    const notFound = axios.isAxiosError(query.error) && query.error.response?.status === 404;
    return notFound ? (
      <section className={styles.notFound} data-testid="order-not-found">
        <span aria-hidden><SearchX /></span>
        <h2>{t('ordc.notFound', { id: orderId })}</h2>
        <p>{t('ordc.notFoundText')}</p>
        <Link to={base} className={styles.secondary}>{t('ordc.back')}</Link>
      </section>
    ) : <LoadError variant="page" error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} />;
  }

  const number = orderLeadLabel(order);
  const leadHref = order.lead?.leadId ? `${admin ? '/admin/leads' : '/supervisor/leads'}/${encodeURIComponent(order.lead.leadId)}` : null;
  const item = orderListItem(order);
  const failed = order.status === 'HANDED_TO_ELCHI' && Boolean(order.parcel?.attempts?.length);
  const trackUrl = order.sellerOrders[0]?.trackingUrl ?? null;
  const canLabel = admin && (order.status === 'PACKED' || AT_ELCHI.includes(order.status));
  // Ochiq mijoz so'rovi (nazoratchi): bekor qilish va manzil oynalarida ko'rinadi, bajarilgach «Bajarildi».
  const openRequest = (kind: 'CANCEL' | 'CHANGE_ADDRESS') => {
    const found = order.requests?.find((request) => request.state === 'OPEN' && request.kind === kind);
    return found ? { ...found, orderId: order.id } : null;
  };

  const onAction = (action: OrderCardAction) => {
    if (action === 'returns') {
      void navigate(`${base}/returns?order=${encodeURIComponent(order.id)}`);
      return;
    }
    if (action === 'refresh') {
      refresh.mutate({ id: order.id }, {
        onSuccess: () => notification.success({ title: t('ordc.rf.done'), description: t('ordc.rf.doneText', { id: number }), placement, duration: 5 }),
        onError: (error) => notification.error({ title: t('ordc.rf.error'), description: getApiErrorMessage(error), placement }),
      });
      return;
    }
    setDialog(action);
  };
  const onCloseDispute = () => closeDispute.mutate({ id: order.id }, {
    onSuccess: () => notification.success({ title: t('ordc.d.closed'), description: t('ordc.d.closedText', { id: number }), placement, duration: 5 }),
    onError: (error) => notification.error({ title: t('ordc.d.closeError'), description: getApiErrorMessage(error), placement }),
  });

  // Telefon: pastki paneldagi asosiy amal (dizayn — «Qaytarish so'rovini qayd etish»).
  const barAction: ReactNode = !admin && !isCancelable(order.status) ? null
    : failed ? <button type="button" className={styles.barButton} onClick={() => setDialog('resend')}><Send aria-hidden />{t('ordc.a.resend')}</button>
      : order.status === 'DELIVERED' ? <button type="button" className={styles.barButton} onClick={() => setDialog('return')}><Undo2 aria-hidden />{t('ordc.a.return')}</button>
        : isCancelable(order.status) ? (
          <>
            <button type="button" className={`${styles.barButton} ${styles.danger}`} onClick={() => setDialog('cancel')}><Ban aria-hidden />{t('ordc.a.cancel')}</button>
            {admin ? null : <button type="button" className={styles.barButton} onClick={() => setDialog('address')}><MapPin aria-hidden />{t('ord.req.address')}</button>}
          </>
        ) : null;
  const block = cancelBlock(order.status);
  const sheetItem = (key: string, icon: ReactNode, label: string, onClick: () => void, hint?: string | null) => (
    <li role="none" key={key}>
      <button type="button" role="menuitem" aria-disabled={hint ? true : undefined} aria-describedby={hint ? `order-sheet-${key}` : undefined} onClick={() => !hint && onClick()}>{icon}{label}</button>
      {hint ? <p id={`order-sheet-${key}`} className={styles.sheetHint}>{hint}</p> : null}
    </li>
  );

  return (
    <div className={styles.page} data-layout={phone ? 'phone' : undefined} data-testid="order-card">
      <OrderNow order={order} admin={admin} phone={phone} now={now} leadHref={leadHref} onAction={onAction} />
      <div className={styles.columns}>
        <div className={styles.main}>
          <DisputeSection order={order} admin={admin} leadHref={leadHref} onClose={onCloseDispute} />
          <CustomerSection order={order} admin={admin} phone={phone} />
          <PriceSection order={order} phone={phone} />
          <MoneySection order={order} phone={phone} now={now} />
          <HistorySection order={order} phone={phone} />
        </div>
        <div className={styles.side}>
          <ParcelSection order={order} phone={phone} now={now} />
          <ElchiSection order={order} phone={phone} />
          <SmsSection order={order} admin={admin} phone={phone} onResend={() => setDialog('sms')} />
          <PickingSection order={order} phone={phone} now={now} />
          <ReceiptSection order={order} phone={phone} />
          <SourceSection order={order} phone={phone} now={now} leadHref={leadHref} />
        </div>
      </div>

      {barAction ? <PageActionBar>{barAction}</PageActionBar> : null}

      {active === 'cancel' ? <CancelOrderDialog order={item} role={queryRole} request={openRequest('CANCEL')} onClose={closeDialog} /> : null}
      {active === 'return' ? <ReturnDialog order={order} onClose={closeDialog} /> : null}
      {active === 'dispute' ? <DisputeDialog order={order} onClose={closeDialog} /> : null}
      {active === 'resend' ? <ResendDialog order={order} onClose={closeDialog} /> : null}
      {active === 'address' ? <AddressDialog order={order} request={openRequest('CHANGE_ADDRESS')} onClose={closeDialog} /> : null}
      {active === 'sms' ? <SmsDialog order={order} onClose={closeDialog} /> : null}
      {active === 'label' ? <OrderLabelDialog order={item} onClose={closeDialog} /> : null}
      {active === 'sheet' ? (
        <Dialog open title={t('ordc.a.sheetTitle', { id: number })} description={[order.buyerName, t(`status.order.${order.status}`)].join(' · ')} icon={<Ellipsis />} onClose={closeDialog}>
          <ul className={styles.sheetMenu} role="menu">
            {leadHref ? <li role="none"><Link role="menuitem" to={leadHref} className={styles.sheetLink}><Inbox aria-hidden />{t('ord.menu.lead')}</Link></li> : null}
            {trackUrl ? <li role="none"><a role="menuitem" href={trackUrl} target="_blank" rel="noreferrer" className={styles.sheetLink}><ExternalLink aria-hidden />{t('ordc.a.elchi')}</a></li> : null}
            {admin && order.status === 'DELIVERED' && !order.dispute ? sheetItem('dispute', <Flag aria-hidden />, t('ordc.a.dispute'), () => setDialog('dispute')) : null}
            {admin ? sheetItem('sms', <MessageSquare aria-hidden />, t('ordc.a.sms'), () => setDialog('sms')) : null}
            {canLabel ? sheetItem('label', <Printer aria-hidden />, t('ord.menu.label'), () => setDialog('label')) : null}
            {sheetItem('address', <MapPin aria-hidden />, t('ordc.a.address'), () => setDialog('address'), isCancelable(order.status) ? null : t('ordc.a.addressLate'))}
            {sheetItem('cancel', <Ban aria-hidden />, t('ord.menu.cancel'), () => setDialog('cancel'), block ? t(block) : null)}
          </ul>
        </Dialog>
      ) : null}
      {isStale(order, now) && refresh.isPending ? <span className={styles.visuallyHidden} role="status">{t('ordc.rf.pending')}</span> : null}
    </div>
  );
}
