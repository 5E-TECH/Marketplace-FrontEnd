import { Dropdown, Tooltip } from 'antd';
import { Ban, Check, CircleX, Ellipsis, EllipsisVertical, ExternalLink, Flag, Inbox, MapPin, MessageSquare, Printer, RefreshCw, Send, Tag, TriangleAlert, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AT_ELCHI, isCancelable } from '../../../features/orders/lib/orderStatus';
import { cancelBlock, orderChain, orderNumber } from '../../../features/orders/lib/orderView';
import type { OrderDetail, OrderStatus } from '../../../features/orders/model/orderTypes';
import { rich } from '../../../shared/i18n/richText';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime, shortTime } from '../../../shared/lib/dayTime';
import { tashkentClock, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { TONE_ICON } from '../../../shared/ui/StatusBadge/statusConfig';
import record from '../../../shared/ui/RecordCard/RecordCard.module.css';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import own from '../AdminOrderPage.module.css';
import { isStale, orderLeadLabel } from '../model/orderCard';
import { Journal } from './OrderSections';

const styles = { ...record, ...own };

export type OrderCardAction = 'cancel' | 'return' | 'dispute' | 'resend' | 'refresh' | 'address' | 'sms' | 'label' | 'sheet' | 'returns';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface OrderNowProps {
  order: OrderDetail;
  admin: boolean;
  phone: boolean;
  now: number;
  leadHref: string | null;
  onAction: (action: OrderCardAction) => void;
}

const LABEL_STATUSES: readonly OrderStatus[] = ['PACKED', ...AT_ELCHI];

/**
 * «Hozir» bloki (admin-buyurtma-karta): holat va nima bo'lyapti, mijoz · mahsulot · sahifa · lid, amallar, buyurtma yo'li
 * (8 qadam yoki qaytish zanjiri), 4 ko'rsatkich. Maxsus vaziyatlar: posilka Elchi'da yaratilmadi (navbat urinishlari),
 * Elchi'dan holat kelmayapti (webhook), qaytarish so'rovi ko'rib chiqilmoqda.
 */
export function OrderNow({ order, admin, phone, now, leadHref, onAction }: OrderNowProps) {
  const { t } = useTranslation();
  const number = orderNumber({ id: order.id, leadId: order.lead?.leadId ?? null });
  const failed = order.status === 'HANDED_TO_ELCHI' && Boolean(order.parcel?.attempts?.length);
  const stale = isStale(order, now);
  const block = cancelBlock(order.status);
  const trackUrl = order.sellerOrders[0]?.trackingUrl ?? null;
  const canLabel = admin && LABEL_STATUSES.includes(order.status);
  const beforeHandover = isCancelable(order.status);

  const title = failed ? t('ordc.failed.title') : stale ? t('ordc.stale.title', { date: tashkentDay(order.parcel?.lastWebhookAt ?? order.updatedAt) }) : nowTitle(order, t, now);
  const button = (key: string, icon: ReactNode, label: string, onClick: () => void, danger = false) => (
    <button key={key} type="button" className={danger ? `${styles.secondary} ${styles.danger}` : styles.secondary} onClick={onClick}>{icon}{label}</button>
  );
  const elchiLink = (key: string) => (trackUrl
    ? <a key={key} href={trackUrl} target="_blank" rel="noreferrer" className={styles.secondary}><ExternalLink aria-hidden />{t('ordc.a.elchi')}</a>
    : <button key={key} type="button" className={styles.secondary} disabled title={t('ordc.a.elchiNone')}><ExternalLink aria-hidden />{t('ordc.a.elchi')}</button>);

  // Holatga qarab asosiy tugmalar (dizayn «Hozir» kartalari); qolganlari — ⋯ menyuda.
  const buttons: ReactNode[] = [];
  if (failed) buttons.push(button('resend', <Send aria-hidden />, t('ordc.a.resend'), () => onAction('resend')));
  else if (stale) buttons.push(button('refresh', <RefreshCw aria-hidden />, t('ordc.a.refresh'), () => onAction('refresh')), elchiLink('elchi'));
  else if (order.status === 'DELIVERED') {
    buttons.push(button('return', <Undo2 aria-hidden />, t('ordc.a.return'), () => onAction('return')));
    if (!order.dispute) buttons.push(button('dispute', <Flag aria-hidden />, t('ordc.a.dispute'), () => onAction('dispute')));
  } else if (order.status === 'RETURN_REQUESTED') {
    buttons.push(button('reject', <Ban aria-hidden />, t('ordc.a.rejectReturn'), () => onAction('returns')), button('approve', <Check aria-hidden />, t('ordc.a.approveReturn'), () => onAction('returns')));
  } else if (order.status === 'HANDED_TO_ELCHI' || order.status === 'IN_TRANSIT') buttons.push(elchiLink('elchi'));
  else if (order.status === 'PACKED' && canLabel) buttons.push(button('label', <Printer aria-hidden />, t('ordc.a.labelShort'), () => onAction('label')));
  if (order.status === 'CONFIRMED' || (!admin && beforeHandover)) buttons.push(button('address', <MapPin aria-hidden />, t('ordc.a.address'), () => onAction('address')));
  if (beforeHandover) buttons.push(button('cancel', <Ban aria-hidden />, t('ordc.a.cancel'), () => onAction('cancel'), true));

  const shown = new Set(buttons.map((node) => (node as { key?: string }).key));
  const menuItems = [
    ...(leadHref ? [{ key: 'lead', icon: <Inbox aria-hidden />, label: <Link to={leadHref}>{t('ord.menu.lead')}</Link> }] : []),
    ...(admin ? [{ key: 'sms', icon: <MessageSquare aria-hidden />, label: t('ordc.a.sms') }] : []),
    ...(canLabel && !shown.has('label') ? [{ key: 'label', icon: <Printer aria-hidden />, label: t('ord.menu.label') }] : []),
    ...(admin && !shown.has('address') ? [{
      key: 'address',
      icon: <MapPin aria-hidden />,
      disabled: !beforeHandover,
      label: beforeHandover ? t('ordc.a.address') : <Tooltip title={t('ordc.a.addressLate')} placement="left">{t('ordc.a.address')}</Tooltip>,
    }] : []),
    ...(admin && AT_ELCHI.includes(order.status) && !order.dispute && !shown.has('dispute') ? [{ key: 'dispute', icon: <Flag aria-hidden />, label: t('ordc.a.dispute') }] : []),
    ...(!shown.has('cancel') ? [
      { type: 'divider' as const },
      {
        key: 'cancel',
        icon: <Ban aria-hidden />,
        danger: !block,
        disabled: Boolean(block),
        label: block ? <Tooltip title={cancelHint(order, t)} placement="left">{t('ord.menu.cancel')}</Tooltip> : t('ord.menu.cancel'),
      },
    ] : []),
  ];

  const statusBadge = (
    <span className={styles.statusLine}>
      <StatusBadge family="order" code={order.status} />
      {order.dispute ? <Badge tone="warning" icon={Flag}>{t('ordc.disputed')}</Badge> : null}
    </span>
  );
  const subline = (
    <p className={styles.nowSub}>
      {rich(t('ordc.sub', {
        name: order.buyerName,
        product: order.product?.name ?? order.sellerOrders[0]?.items[0]?.productName ?? '—',
        qty: order.sellerOrders[0]?.items[0]?.quantity ?? 1,
        affiliate: order.stream?.affiliateName ?? '—',
        date: tashkentDateTime(order.createdAt),
      }), {
        stream: <strong>{order.stream?.code ?? '—'}</strong>,
        lead: leadHref ? <Link to={leadHref} className={styles.leadLink}>{orderLeadLabel(order)}</Link> : <strong>{orderLeadLabel(order)}</strong>,
      })}
    </p>
  );
  const more = menuItems.length ? (
    phone ? (
      <button type="button" className={styles.iconButtonOutline} aria-label={t('ordc.a.more', { id: number })} onClick={() => onAction('sheet')}>
        <EllipsisVertical aria-hidden />
      </button>
    ) : (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        rootClassName={rowMenu.root}
        menu={{ items: menuItems, onClick: ({ key }) => { if (key !== 'lead') window.setTimeout(() => onAction(key as OrderCardAction)); } }}
      >
        <button type="button" className={styles.iconButtonOutline} aria-label={t('ordc.a.more', { id: number })}>
          <Ellipsis aria-hidden />
        </button>
      </Dropdown>
    )
  ) : null;

  const steps = orderChain({ status: order.status, statusAt: order.statusAt ?? order.updatedAt }, order);
  const act = order.parcel?.act ?? null;

  return (
    <section className={`${styles.now} ${styles.nowSplit}`} aria-labelledby="order-now" data-testid="order-now">
      {phone ? (
        <>
          <div className={styles.nowPhoneTop}>{statusBadge}{more}</div>
          <h2 id="order-now" className={styles.nowTitle}>{title}</h2>
          {subline}
        </>
      ) : (
        <div className={styles.nowHead}>
          <div className={styles.nowTitleRow}>
            {statusBadge}
            <h2 id="order-now" className={styles.nowTitle}>{title}</h2>
          </div>
          <div className={styles.nowSubRow}>
            {subline}
            <div className={styles.nowActions}>{buttons}{more}</div>
          </div>
        </div>
      )}

      {failed ? <FailedParcel order={order} now={now} /> : null}
      {stale ? <StaleWebhook order={order} /> : null}
      {order.status === 'RETURN_REQUESTED' && order.returnRequest ? <ReturnRequestBox order={order} now={now} /> : null}

      <ol className={styles.path} aria-label={t('ordc.path')}>
        {steps.map((step, index) => (
          <li key={`${step.status}-${index}`} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className={styles.pathMark}>
              <span className={styles.pathDot}>{step.state === 'done' ? <Check aria-hidden /> : phone ? null : index + 1}</span>
              {index < steps.length - 1 ? <span className={styles.pathLine} data-done={step.state === 'done' || undefined} /> : null}
            </span>
            <span className={styles.pathText}>
              <span>{t(`status.order.${step.status}`)}</span>
              <span>
                {step.at
                  ? [shortTime(step.at, now), step.status === 'HANDED_TO_ELCHI' && act ? act.code : null].filter(Boolean).join(' · ')
                  : PATH_HINT[step.status] ? t(PATH_HINT[step.status] as TranslationKey) : null}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <dl className={styles.metrics}>
        {metricsOf(order, t, now).map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            {metric.note ? <dd>{metric.note}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Kelgusi qadam izohi: «Elchi o'tkazmasi», «ulushlar mavjud». */
const PATH_HINT: Partial<Record<OrderStatus, TranslationKey>> = {
  PICKING: 'ordc.path.PICKING',
  PACKED: 'ordc.path.PACKED',
  HANDED_TO_ELCHI: 'ordc.path.HANDED_TO_ELCHI',
  IN_TRANSIT: 'ordc.path.IN_TRANSIT',
  DELIVERED: 'ordc.path.DELIVERED',
  REMITTED: 'ordc.path.REMITTED',
  SETTLED: 'ordc.path.SETTLED',
  RETURNING: 'ordc.path.RETURNING',
  RETURNED_GRADED: 'ordc.path.RETURNED_GRADED',
};

/** Bekor qilib bo'lmasa — sababi; Elchi'ga topshirilgan bo'lsa, qachonligi bilan (dizayn maslahati). */
function cancelHint(order: OrderDetail, t: T): string {
  const handed = order.lead?.statusHistory.find((entry) => entry.accepted && entry.toStatus === 'HANDED_TO_ELCHI')?.createdAt;
  const block = cancelBlock(order.status);
  if (block === 'ord.cancel.atElchi' && handed) return t('ordc.cancelAtElchi', { when: `${tashkentDay(handed).slice(0, 5)}, ${tashkentClock(Date.parse(handed))}` });
  return block ? t(block) : '';
}

/** «Hozir» sarlavhasi: nima bo'lyapti va keyingi qadam (13 holat — dizayn «Hozir» kartalari). */
function nowTitle(order: OrderDetail, t: T, now: number): string {
  const at = order.statusAt ?? order.updatedAt;
  switch (order.status) {
    case 'CONFIRMED':
      if (order.prepayment && !order.prepayment.paid) return t('ordc.now.prepay');
      return order.shipDate ? t(order.shipDate === tashkentDayIso(now) ? 'ordc.now.CONFIRMED_today' : 'ordc.now.CONFIRMED', { date: tashkentDay(`${order.shipDate}T12:00:00+05:00`) }) : t('ordc.now.CONFIRMED_wave');
    case 'PICKING':
      return t('ordc.now.PICKING', { who: order.picking?.by ?? t('ordc.warehouse'), time: shortTime(order.picking?.from ?? at, now) });
    case 'IN_TRANSIT':
      return t('ordc.now.IN_TRANSIT', { time: shortTime(at, now) });
    case 'REFUSED':
      return t('ordc.now.REFUSED', { detail: order.statusDetail ?? '' }).replace(/ — $/, '');
    case 'CANCELLED':
      return t('ordc.now.CANCELLED', { who: order.cancel?.by ?? '—' });
    default:
      return t(`ordc.now.${order.status}` as TranslationKey);
  }
}

const tashkentDayIso = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(now);

type Metric = { label: string; value: ReactNode; note?: ReactNode };

/** To'rt ko'rsatkich: birinchisi — mijoz summasi; qolgan uchtasi holatga qarab (dizayn «Hozir» kartalari). */
function metricsOf(order: OrderDetail, t: T, now: number): Metric[] {
  const sum = (amount: number) => t('ord.sum', { amount: formatMoney(amount) });
  const pending = <span className={styles.muted}>{t('ordc.pending')}</span>;
  const item = order.sellerOrders[0]?.items[0] ?? null;
  const qty = item?.quantity ?? 1;
  const goods = (item?.unitPrice ?? 0) * qty;
  const at = order.statusAt ?? order.updatedAt;
  const delivered = order.lead?.statusHistory.find((entry) => entry.accepted && entry.toStatus === 'DELIVERED')?.createdAt ?? null;
  const paid = ['DELIVERED', 'REMITTED', 'SETTLED', 'RETURN_REQUESTED'].includes(order.status);
  const first: Metric = { label: t(paid ? 'ordc.m.paid' : 'ordc.m.pays'), value: sum(order.totalAmount), note: t('ordc.m.split', { goods: formatMoney(goods), delivery: formatMoney(order.deliveryFee) }) };
  const money = order.money ?? null;
  const where = order.lead?.whereDeliver ?? 'CENTER';
  const confirmed: Metric = { label: t('ordc.m.confirmedBy'), value: order.confirmedByActor ? `${order.confirmedByActor.name} · ${shortTime(order.confirmedByActor.at, now)}` : '—' };
  const reserved: Metric = { label: t('ordc.m.reserved'), value: t('ordc.m.reservedValue', { count: qty, cell: order.picking?.cell ?? '—' }) };
  const refusalFee: Metric = { label: t('ordc.m.refusalFee'), value: pending, note: t('ordc.m.refusalFeeNote') };
  const returnUntil: Metric = { label: t('ordc.m.returnUntil'), value: money?.returnUntil ? dayTime(money.returnUntil, t, now) : pending, note: delivered ? t('ordc.m.deliveredAt', { when: dayTime(delivered, t, now, true) }) : undefined };
  const moneyState: Metric = {
    label: t('ordc.m.moneyState'),
    value: money?.state ? t(`ordc.money.${money.state}`) : '—',
    note: money?.entries.length ? t('ordc.m.entries', { count: money.entries.length, when: dayTime(money.entries[0].at, t, now, true) }) : undefined,
  };
  const elchiRemits: Metric = { label: t('ordc.m.elchiRemits'), value: money ? sum(money.elchiRemits) : '—', note: money ? t('ordc.m.elchiFee', { total: formatMoney(order.totalAmount), fee: formatMoney(money.elchiFee) }) : undefined };
  const act = order.parcel?.act ?? null;
  switch (order.status) {
    case 'CONFIRMED':
      if (order.prepayment && !order.prepayment.paid) {
        return [first, { label: t('ordc.m.prepayReason'), value: t('ordc.m.prepayReasonValue') }, { label: t('ordc.m.prepayAmount'), value: sum(order.prepayment.amount), note: t('ordc.m.prepayNote') }, { label: t('ordc.m.prepayMethod'), value: pending }];
      }
      return [first, confirmed, reserved, { label: t('ordc.m.delivery'), value: t(`ord.where.${where}`), note: order.customer?.districtName ?? undefined }];
    case 'PICKING':
      return [first, { label: t('ordc.m.wave'), value: order.picking?.wave ?? '—', note: order.picking?.from ? t('ordc.m.since', { time: shortTime(order.picking.from, now) }) : undefined }, confirmed, reserved];
    case 'PACKED':
      return [first, { label: t('ordc.m.packed'), value: [shortTime(at, now), order.parcel?.label?.by ?? order.picking?.by].filter(Boolean).join(' · ') }, { label: t('ordc.m.act'), value: act ? t('ordc.m.actOpen', { code: act.code }) : t('ordc.m.actNone') }, { label: t('ordc.m.track'), value: t('ord.trackOnHandover') }];
    case 'HANDED_TO_ELCHI':
      return [first, { label: t('ordc.m.act'), value: act ? t('ord.panel.actValue', { code: act.code, count: act.count }) : '—' }, { label: t('ordc.m.handed'), value: t('ordc.m.handedValue', { time: shortTime(at, now) }) }, { label: t('ordc.m.cancel'), value: t('ordc.m.cancelNo') }];
    case 'IN_TRANSIT': {
      const smsSent = order.sms?.find((entry) => entry.title.includes('yo‘lga'))?.at ?? null;
      return [first, { label: t('ordc.m.track'), value: order.parcel?.track ?? '—' }, { label: t('ordc.m.address'), value: [order.customer?.districtName, t(`opw.whereDeliver.${where}`)].filter(Boolean).join(' · ') }, { label: t('ordc.m.sms'), value: smsSent ? t('ordc.m.smsOnWay', { time: shortTime(smsSent, now) }) : '—' }];
    }
    case 'DELIVERED':
      return [first, elchiRemits, moneyState, returnUntil];
    case 'REMITTED':
      return [first, { label: t('ordc.m.remit'), value: money ? `${shortTime(at, now)} · ${formatMoney(money.elchiRemits)}` : '—' }, { label: t('ordc.m.recon'), value: pending }, { label: t('ordc.m.entriesLabel'), value: t('ordc.m.heldToAvailable') }];
    case 'SETTLED':
      return [first, { label: t('ordc.m.closed'), value: dayTime(at, t, now) }, { label: t('ordc.m.seller'), value: t('ordc.m.sellerFee', { name: order.stream?.affiliateName ?? '—', amount: formatMoney(order.pricing?.split.affiliate ?? 0) }) }, returnUntil];
    case 'REFUSED':
      return [first, { label: t('ordc.m.refused'), value: dayTime(at, t, now) }, refusalFee, { label: t('ordc.m.toSeller'), value: t('ordc.m.noEntry') }];
    case 'RETURNING':
      return [first, { label: t('ordc.m.returning'), value: dayTime(at, t, now), note: order.statusDetail ?? undefined }, { label: t('ordc.m.grading'), value: t('ordc.m.gradingValue') }, refusalFee];
    case 'RETURNED_GRADED':
      return [first, { label: t('ordc.m.graded'), value: dayTime(at, t, now), note: order.statusDetail ?? undefined }, { label: t('ordc.m.stock'), value: t('ordc.m.stockValue', { cell: order.picking?.cell ?? '—', count: qty }) }, refusalFee];
    case 'CANCELLED':
      return [first, { label: t('ordc.m.cancelled'), value: order.cancel ? dayTime(order.cancel.at, t, now) : '—', note: order.cancel?.by }, { label: t('ordc.m.comment'), value: order.cancel ? `«${order.cancel.reason}»` : '—' }, { label: t('ordc.m.reason'), value: pending, note: t('ordc.m.reasonNote') }];
    case 'RETURN_REQUESTED':
      return [first, { label: t('ordc.m.request'), value: order.returnRequest ? dayTime(order.returnRequest.at, t, now) : '—', note: order.returnRequest?.by }, returnUntil, { label: t('ordc.m.money'), value: t('ordc.m.moneyUnchanged'), note: money?.state ? t(`ordc.money.${money.state}`) : undefined }];
    default:
      return [first];
  }
}

/** Posilka Elchi'da yaratilmadi: navbat urinishlari, buyurtma yo'qolmaydi (qayta yuborish ikkinchi posilka yaratmaydi). */
function FailedParcel({ order, now }: { order: OrderDetail; now: number }) {
  const { t } = useTranslation();
  const attempts = order.parcel?.attempts ?? [];
  return (
    <div className={styles.situation}>
      <div className={styles.alert} role="alert">
        <CircleX aria-hidden />
        <div><p>{t('ordc.failed.alert')}</p><p>{t('ordc.failed.text')}</p></div>
      </div>
      <ol className={styles.timeline} data-compact>
        {attempts.map((attempt, index) => (
          <li key={index} data-state={attempt.state === 'QUEUED' ? 'pending' : attempt.state === 'FAILED' ? 'failed' : undefined} data-last={index === attempts.length - 1 || undefined}>
            <span className={styles.timeAt}>{attempt.at ? <Stamp at={attempt.at} now={now} /> : '—'}</span>
            <span className={styles.timeDot}><span /></span>
            {index < attempts.length - 1 ? <span className={styles.timeLine} /> : null}
            <span className={styles.timeText}>
              <span>{t('ordc.failed.attempt', { n: index + 1 })}</span>
              <span>{t(attempt.state === 'QUEUED' ? 'ordc.failed.queued' : 'ordc.failed.noAnswer')}</span>
            </span>
            <span className={styles.timeBadge}>
              {attempt.state === 'QUEUED' ? <Badge tone="warning" icon={TONE_ICON.warning}>{t('ordc.failed.inQueue')}</Badge> : <Badge tone="danger" icon={TONE_ICON.danger}>{t('ordc.failed.error')}</Badge>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Elchi'dan uzoq vaqt holat kelmagan «Yo'lda» posilka: oxirgi webhook va 2-bosqich «Muammoli» eslatmasi. */
function StaleWebhook({ order }: { order: OrderDetail }) {
  const { t } = useTranslation();
  const last = order.parcel?.lastWebhookAt ?? order.updatedAt;
  return (
    <div className={styles.situation}>
      <div className={styles.warn} role="note">
        <TriangleAlert aria-hidden />
        <div>
          <p>{t('ordc.stale.last', { status: t('status.order.IN_TRANSIT'), when: tashkentDateTime(last) })}</p>
          <p>{t('ordc.stale.text')}</p>
        </div>
      </div>
      <Journal items={[
        ...(order.elchiEvents ?? []).filter((event) => event.state === 'ACCEPTED').slice(-2),
        { at: null, title: t('ordc.stale.next'), detail: t('ordc.stale.nextNote'), state: 'PENDING' as const },
      ]} />
    </div>
  );
}

/** Qaytarish so'rovi ko'rib chiqilmoqda: so'rov, sabab, muddat, pul (qaror — «Rad va qaytarishlar» bo'limida). */
function ReturnRequestBox({ order, now }: { order: OrderDetail; now: number }) {
  const { t } = useTranslation();
  const request = order.returnRequest;
  if (!request) return null;
  return (
    <div className={styles.situation}>
      <div className={styles.box}>
        <dl className={styles.facts} data-width="110">
          <div><dt>{t('ordc.rr.request')}</dt><dd>{dayTime(request.at, t, now)}<span className={styles.factNote}>{t('ordc.rr.by', { name: request.by })}</span></dd></div>
          <div><dt>{t('ordc.rr.reason')}</dt><dd>«{request.reason}»</dd></div>
          <div><dt>{t('ordc.rr.money')}</dt><dd>{t('ordc.rr.moneyValue')}<span className={styles.factNote}>{t('ordc.rr.moneyNote')}</span></dd></div>
        </dl>
      </div>
      <p className={styles.hint}><Tag aria-hidden />{t('ordc.rr.decision')}</p>
    </div>
  );
}

/** Ixcham vaqt ustuni: bugun — «15:10», boshqa kun — sana va vaqt ikki qatorda. */
function Stamp({ at, now }: { at: string; now: number }) {
  const day = tashkentDay(at);
  return day === tashkentDay(now) ? <>{tashkentClock(Date.parse(at))}</> : <>{day.slice(0, 5)}<br />{tashkentClock(Date.parse(at))}</>;
}
