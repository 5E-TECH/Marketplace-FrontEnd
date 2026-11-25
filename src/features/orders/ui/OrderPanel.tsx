import { Drawer } from 'antd';
import { Ban, Check, Eye, Info, Lock, Mail, Pencil, Play, Printer, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime, shortTime } from '../../../shared/lib/dayTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { useOrderQuery } from '../api/ordersQueries';
import { isCancelable, ORDER_PATH } from '../lib/orderStatus';
import { orderChain, orderNumber, placeLine } from '../lib/orderView';
import type { CustomerRequestRow, OrderListItem, OrderRole } from '../model/orderTypes';
import { OrderRowMenu, type OrderAction } from './OrderRowMenu';
import styles from './OrderPanel.module.css';

interface OrderPanelProps {
  order: OrderListItem;
  role: OrderRole;
  href: string;
  actions: readonly OrderAction[];
  onAction: (action: OrderAction) => void;
  onClose: () => void;
  /** Adminga to'liq raqam «Ko'rsatish» bilan (25-qaror; ko'rish auditga). */
  canRevealPhone: boolean;
  /** Yorliqni qayta chop etish tugmasi (admin). */
  canPrintLabel: boolean;
  /** Nazoratchi: ochiq mijoz so'rovi (belgi va izoh) va pastki amallar (bekor qilish, manzil). */
  request?: CustomerRequestRow | null;
  /** Nazoratchi pastki amallari: topshirilgunga qadar bekor qilish va manzilni o'zgartirish. */
  onCancel?: () => void;
  onAddress?: () => void;
  /** Lid kartasi (nazoratchi — «Tasdiq qo'ng'irog'i», `?listen=1`). */
  leadHref?: string | null;
  /** Operator: o'zining qisqa ismi («Dilnoza R.») — «siz bekor qildingiz», «siz tasdiqlagansiz». */
  me?: string | null;
}

/**
 * Tafsilot paneli 560 (admin-buyurtmalar, komponentlar-E R8): qator bosilganda o'ngdan; sarlavhadagi «Buyurtma L-…»
 * havolasi to'liq sahifani ochadi. Holat zanjiri, mijoz, summa, trek va akt; pastda — yorliqni qayta chop etish.
 */
export function OrderPanel({ order, role, href, actions, onAction, onClose, canRevealPhone, canPrintLabel, request = null, onCancel, onAddress, leadHref = null, me = null }: OrderPanelProps) {
  const { t } = useTranslation();
  const detail = useOrderQuery(role, order.id).data;
  const [revealed, setRevealed] = useState(false);
  const number = orderNumber(order);
  const item = detail?.sellerOrders[0]?.items[0] ?? null;
  const supervisor = role === 'SUPERVISOR';
  const operator = role === 'OPERATOR';
  const menuActions = actions.filter((action) => action !== 'open');
  // Nazoratchi zanjiri «Yetkazildi» gacha: keyingisini moliya beradi (izohda).
  const delivered = ORDER_PATH.indexOf('DELIVERED');
  const steps = orderChain(order, detail).filter((step) => !supervisor || ORDER_PATH.indexOf(step.status) <= delivered);
  const footerActions: ReactNode = operator ? (
    <>
      {isCancelable(order.status) && onCancel ? <button type="button" className={styles.dangerSoft} onClick={onCancel}><Ban aria-hidden />{t('ord.cancel.submit')}</button> : null}
      <button type="button" className={`${styles.secondary} ${styles.pushEnd}`} onClick={onClose}>{t('ord.panel.close')}</button>
    </>
  ) : isCancelable(order.status) && (onCancel || onAddress) ? (
    <>
      {onCancel ? <button type="button" className={styles.dangerSoft} onClick={onCancel}><Ban aria-hidden />{t('ord.menu.cancel')}</button> : null}
      {onAddress ? <button type="button" className={styles.primary} onClick={onAddress}><Pencil aria-hidden />{t('ord.req.address')}</button> : null}
    </>
  ) : null;
  const stepNote = (status: string, state: string) => {
    if (operator) {
      if (status === 'CONFIRMED' && order.confirmedBy) return t('ord.panel.byYou', { when: dayTime(order.confirmedBy.at, t, undefined, true) });
      if (state === 'current') return [order.statusAt ? shortTime(order.statusAt) : null, order.statusDetail].filter(Boolean).join(' · ') || null;
      if (status === 'PICKING' && state === 'done') return detail?.picking?.by ?? null;
      if (status === 'HANDED_TO_ELCHI' && state === 'todo' && act && order.status === 'PACKED') return t('ord.panel.actOpenNote', { code: act.code });
      return null;
    }
    if (!supervisor) return null;
    if (state === 'current') return [order.statusAt ? dayTime(order.statusAt, t, undefined, true) : null, order.statusDetail].filter(Boolean).join(' · ') || null;
    if (status === 'HANDED_TO_ELCHI' && isCancelable(order.status)) return t('ord.panel.cancelUntil');
    if (status === 'DELIVERED') return t('ord.panel.afterDelivered');
    return null;
  };
  const act = detail?.parcel?.act ?? null;
  const fullPhone = detail?.lead?.customerPhone ?? null;
  const where = order.whereDeliver ?? detail?.lead?.whereDeliver ?? 'CENTER';

  return (
    <Drawer
      open
      onClose={onClose}
      size="min(560px, 100vw)"
      closable={false}
      rootClassName={styles.root}
      footer={canPrintLabel || footerActions ? (
        <div className={styles.footer}>
          {footerActions}
          {canPrintLabel ? <button type="button" className={styles.secondary} onClick={() => onAction('label')}><Printer aria-hidden />{t('ord.menu.label')}</button> : null}
        </div>
      ) : null}
      aria-labelledby="order-panel-title"
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3 id="order-panel-title"><Link to={href}>{t('ord.panel.title', { id: number, name: order.buyerName })}</Link></h3>
          <div className={styles.headBadge}>
            <StatusBadge family="order" code={order.status} />
            {request ? <span className={styles.requestBadge}><Mail aria-hidden />{t(request.kind === 'CANCEL' ? 'ord.panel.requestCancel' : 'ord.panel.requestAddress')}</span> : null}
          </div>
        </div>
        {menuActions.length ? <OrderRowMenu order={order} actions={menuActions} onAction={onAction} compact /> : null}
        <button type="button" className={styles.close} aria-label={t('ord.panel.close')} onClick={onClose}><X aria-hidden /></button>
      </div>
      <div className={styles.body} data-testid="order-panel">
        {operator ? <OperatorNote order={order} me={me} reason={detail?.cancel?.reason ?? null} /> : null}
        {request ? (
          <div className={styles.note} role="note">
            <Info aria-hidden />
            <div>
              <p>{t(request.kind === 'CANCEL' ? 'ord.panel.requestCancelTitle' : 'ord.panel.requestAddressTitle', { time: shortTime(request.createdAt) })}</p>
              <p>
                {request.kind === 'CANCEL'
                  ? (request.comment ? t('ord.req.comment', { text: request.comment }) : t('ord.panel.requestNoComment'))
                  : t('ord.panel.requestAddressText', { region: request.regionName ?? order.regionName ?? '—', from: order.districtName ?? '—', to: request.districtName ?? '—', where: request.whereDeliver ? t(`opw.whereDeliver.${request.whereDeliver}`) : '—' })}
                {request.kind === 'CHANGE_ADDRESS' && ['CONFIRMED', 'PICKING'].includes(order.status) ? ` ${t('ord.panel.requestLabelNew')}` : ''}
              </p>
            </div>
          </div>
        ) : null}
        <div>
          <h4 className={styles.chainTitle}>{t('ord.panel.chain')}{supervisor || operator ? null : <span> · BUY-2</span>}</h4>
          <ol className={styles.chain} aria-label={t('ord.panel.chainLabel')}>
            {steps.map((step, index) => (
              <li key={`${step.status}-${index}`} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
                {index < steps.length - 1 ? <span className={styles.line} data-done={step.state === 'done' || undefined} /> : null}
                <span className={styles.dot}>{step.state === 'done' ? <Check aria-hidden /> : null}</span>
                <span className={styles.stepText}>
                  <span>{t(`status.order.${step.status}`)}</span>
                  {step.state === 'todo' && step.status === 'HANDED_TO_ELCHI' && act && !operator ? <span>{t('ord.panel.actPending', { code: act.code, count: act.count, time: shortTime(act.at) })}</span> : null}
                  {stepNote(step.status, step.state) ? <span>{stepNote(step.status, step.state)}</span> : null}
                </span>
                {step.state === 'current' && step.at && !supervisor && !operator ? <span className={styles.stepAt}>{shortTime(step.at)}</span> : null}
              </li>
            ))}
          </ol>
        </div>
        <span className={styles.divider} />
        <dl className={styles.facts}>
          <div><dt>{t('ord.panel.customer')}</dt><dd>{order.buyerName}</dd></div>
          <div><dt>{t('ord.panel.address')}</dt><dd>{placeLine(order) ?? '—'}</dd></div>
          <div><dt>{t('ord.panel.delivery')}</dt><dd>{t(`ord.where.${where}`)}</dd></div>
          <div>
            <dt>{t('ord.panel.phone')}</dt>
            <dd>
              {canRevealPhone && fullPhone ? (revealed ? fullPhone : (
                <span className={styles.reveal}>
                  {order.phoneMasked ?? '—'}
                  <button type="button" onClick={() => setRevealed(true)}><Eye aria-hidden />{t('ord.panel.show')}</button>
                </span>
              )) : <span className={styles.muted}><Lock aria-hidden />{t(operator ? 'ord.panel.phoneHiddenOp' : 'ord.panel.phoneHidden')}</span>}
            </dd>
          </div>
        </dl>
        <span className={styles.divider} />
        <dl className={styles.facts}>
          <div><dt>{t('ord.panel.goods')}</dt><dd>{`${item?.productName ?? order.productName ?? '—'} × ${item?.quantity ?? order.quantity ?? 1}`}</dd></div>
          <div><dt>{t('ord.panel.price')}</dt><dd>{t('ord.sum', { amount: formatMoney(item?.unitPrice ?? order.totalAmount - order.deliveryFee) })}</dd></div>
          <div><dt>{t('ord.panel.deliveryFee', { where: t(`opw.whereDeliver.${where}`) })}</dt><dd>{t('ord.sum', { amount: formatMoney(order.deliveryFee) })}</dd></div>
          <div><dt>{t('ord.panel.total')}</dt><dd><span className={styles.total}>{t('ord.sum', { amount: formatMoney(order.totalAmount) })}</span></dd></div>
          {operator ? <div><dt>{t('ord.panel.payment')}</dt><dd>{t('ord.panel.paymentValue')}</dd></div> : null}
        </dl>
        <span className={styles.divider} />
        {operator ? (
          <dl className={styles.facts}>
            <div><dt>{t('ord.panel.track')}</dt><dd>{order.trackNumber ?? <span className={styles.muted}>{t('ord.panel.trackLater')}</span>}</dd></div>
            <div><dt>{t('ord.panel.act')}</dt><dd>{act ? (order.status === 'PACKED' ? t('ord.panel.actOpen', { code: act.code }) : t('ord.panel.actValue', { code: act.code, count: act.count })) : '—'}</dd></div>
          </dl>
        ) : null}
        {operator ? <span className={styles.divider} /> : null}
        {operator ? (
          <dl className={styles.facts}>
            <div><dt>{t('ord.panel.lead')}</dt><dd>{t('ord.panel.leadYours', { id: number })}</dd></div>
            <div><dt>{t('ord.panel.source')}</dt><dd>{order.source ? t(`al.source.${order.source}` as 'al.source.LANDING').toLowerCase() : '—'}</dd></div>
          </dl>
        ) : supervisor ? (
          <dl className={styles.facts}>
            <div><dt>{t('ord.panel.lead')}</dt><dd>{leadHref ? <Link to={leadHref}>{number}</Link> : number}</dd></div>
            <div><dt>{t('ord.panel.confirmedBy')}</dt><dd>{order.confirmedBy ? `${order.confirmedBy.name} · ${dayTime(order.confirmedBy.at, t, undefined, true)}` : '—'}</dd></div>
            <div><dt>{t('ord.panel.call')}</dt><dd>{leadHref ? <Link to={`${leadHref}?listen=1`} className={styles.inlineLink}><Play aria-hidden />{t('ord.panel.listen')}</Link> : '—'}</dd></div>
            <div><dt>{t('ord.panel.page')}</dt><dd>{[order.streamCode, order.affiliateName].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt>{t('ord.panel.stock')}</dt><dd>{isCancelable(order.status) && order.stockCell ? t('ord.panel.stockValue', { cell: order.stockCell, count: order.quantity ?? 1 }) : '—'}</dd></div>
          </dl>
        ) : (
          <dl className={styles.facts}>
            <div><dt>{t('ord.panel.track')}</dt><dd>{order.trackNumber ?? <span className={styles.muted}>{t('ord.trackOnHandover')}</span>}</dd></div>
            <div><dt>{t('ord.panel.act')}</dt><dd>{act ? t('ord.panel.actValue', { code: act.code, count: act.count }) : '—'}</dd></div>
          </dl>
        )}
      </div>
    </Drawer>
  );
}

/** Operator paneli izohi: bekor qilsa bo'ladimi, Elchi'da (16-qaror) yoki o'zi bekor qilgan (yakuniy). */
function OperatorNote({ order, me, reason }: { order: OrderListItem; me: string | null; reason: string | null }) {
  const { t } = useTranslation();
  if (isCancelable(order.status)) {
    return (
      <div className={styles.note} role="note">
        <Info aria-hidden />
        <div><p>{t('ord.panel.opCan')}</p><p>{t('ord.panel.opCanText')}</p></div>
      </div>
    );
  }
  if (order.status === 'CANCELLED') {
    const mine = Boolean(me) && order.statusDetail === me;
    const time = order.statusAt ? shortTime(order.statusAt) : '—';
    return (
      <div className={styles.note} data-tone="neutral" role="note">
        <Ban aria-hidden />
        <div>
          <p>{mine ? t('ord.panel.opCancelledYou', { time }) : t('ord.panel.opCancelledBy', { name: order.statusDetail ?? '—', time })}</p>
          <p>{t('ord.panel.opCancelledText')}{reason ? ` «${reason}»` : ''}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.note} data-tone="warning" role="note">
      <Lock aria-hidden />
      <div><p>{t('ord.panel.opCannot')}</p><p>{t('ord.panel.opCannotText')}</p></div>
    </div>
  );
}
