import { ChevronRight, ExternalLink, Eye, Flag, Headphones, Info, Lock, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AT_ELCHI } from '../../../features/orders/lib/orderStatus';
import type { JournalState, MoneyState, OrderDetail, OrderHistoryEntry, OrderStatus } from '../../../features/orders/model/orderTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime, shortTime } from '../../../shared/lib/dayTime';
import { tashkentClock, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge/Badge';
import { CopyButton } from '../../../shared/ui/CopyButton/CopyButton';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { Facts, Hint, Section, type Fact } from '../../../shared/ui/RecordCard/RecordCard';
import { TONE_ICON } from '../../../shared/ui/StatusBadge/statusConfig';
import record from '../../../shared/ui/RecordCard/RecordCard.module.css';
import own from '../AdminOrderPage.module.css';
import { orderLeadLabel } from '../model/orderCard';

const styles = { ...record, ...own };

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;
const money = (t: T, amount: number) => t('ord.sum', { amount: formatMoney(amount) });
const Pending = () => {
  const { t } = useTranslation();
  return <span className={styles.muted}>{t('ordc.pending')}</span>;
};
/** «13.01 12:41» — tarix ustunida sana va vaqt ikki qatorda. */
const Stamp = ({ at }: { at: string | null }) => (at ? <>{tashkentDay(at).slice(0, 5)}<br />{tashkentClock(Date.parse(at))}</> : <>—</>);

const JOURNAL_TONE: Record<JournalState, BadgeTone> = { SENT: 'success', ACCEPTED: 'success', REJECTED: 'danger', PENDING: 'warning', FAILED: 'danger' };
const MONEY_TONE: Record<MoneyState, BadgeTone> = { HELD: 'warning', AVAILABLE: 'success', REVERSED: 'danger' };
const JournalBadge = ({ state }: { state: JournalState }) => {
  const { t } = useTranslation();
  return <Badge tone={JOURNAL_TONE[state]} icon={TONE_ICON[JOURNAL_TONE[state]]}>{t(`ordc.j.${state}`)}</Badge>;
};

// ── Mijoz va manzil ─────────────────────────────────────────────────────────

/** Telefon — admin «Ko'rsatish» bilan (25-qaror, ko'rish auditga); manzil — operator tuzatgan bo'lsa kim va qachon. */
export function CustomerSection({ order, admin, phone }: { order: OrderDetail; admin: boolean; phone: boolean }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const customer = order.customer ?? null;
  const full = order.lead?.customerPhone ?? null;
  const where = order.lead?.whereDeliver ?? 'CENTER';
  const edited = customer?.addressEditedBy ?? null;
  const original = customer?.original ?? null;
  const rows: Fact[] = [
    { label: t('ordc.c.name'), value: order.buyerName },
    {
      label: t('ordc.c.phone'),
      value: admin && full ? (
        revealed ? <span className={styles.phoneValue}>{full}<CopyButton text={full} ariaLabel={t('ordc.c.copyPhone')} size="sm" /></span> : (
          <span className={styles.reveal}>
            <span>{order.phoneMasked ?? '—'}</span>
            <button type="button" className={styles.smallButton} onClick={() => setRevealed(true)}><Eye aria-hidden />{t('ord.panel.show')}</button>
          </span>
        )
      ) : <span className={styles.hidden}><Lock aria-hidden />{order.phoneMasked ?? t('ord.panel.phoneHidden')}</span>,
      notes: admin && full ? [t('ordc.c.phoneAudit')] : [t('ordc.c.phoneHidden')],
    },
    {
      label: t('ordc.c.address'),
      value: customer ? [customer.regionName, customer.districtName, customer.addressLine].filter(Boolean).join(', ') : order.deliveryAddress ?? '—',
      notes: [
        edited ? t('ordc.c.edited', { name: edited.name, when: `${tashkentDay(edited.at).slice(0, 5)}, ${tashkentClock(Date.parse(edited.at))}` }) : null,
        original ? t('ordc.c.original', { place: original.districtName }) : null,
      ],
    },
    { label: t('ordc.c.where'), value: t(`ord.where.${where}`), notes: [t(original && original.whereDeliver !== where ? 'ordc.c.whereChanged' : 'ordc.c.whereForm')] },
    { label: t('ordc.c.consent'), value: t('ordc.c.consentValue'), notes: [customer?.consentAt ? t('ordc.c.consentAt', { when: tashkentDateTime(customer.consentAt) }) : null] },
  ];
  const history = admin && full ? <Link to={`/admin/leads?q=${encodeURIComponent(full)}`} className={styles.link}>{t('ordc.c.history')}<ChevronRight aria-hidden /></Link> : undefined;
  return (
    <Section title={t('ordc.c.title')} link={history} phone={phone}>
      <Facts rows={rows} width={140} />
    </Section>
  );
}

// ── Narx nusxasi ────────────────────────────────────────────────────────────

/** Buyurtma yaratilgan paytdagi narx, rejim, Elchi tarifi va to'rt qator taqsimoti — keyingi sozlama ta'sir qilmaydi. */
export function PriceSection({ order, phone }: { order: OrderDetail; phone: boolean }) {
  const { t } = useTranslation();
  const item = order.sellerOrders[0]?.items[0] ?? null;
  const pricing = order.pricing ?? null;
  const product = order.product ?? null;
  const where = order.lead?.whereDeliver ?? 'CENTER';
  const weight = product?.weightGrams ?? order.lead?.weightGrams ?? null;
  const rows: Fact[] = [
    { label: t('ordc.p.goods'), value: `${item?.productName ?? product?.name ?? '—'} × ${item?.quantity ?? 1}`, notes: [[product?.category, product?.wholesalerName, weight ? t('ordc.kg', { kg: formatKg(weight) }) : null].filter(Boolean).join(' · ') || null] },
    { label: t('ordc.p.sale'), value: money(t, pricing?.salePrice ?? item?.unitPrice ?? 0), notes: [t('ordc.p.saleNote', { stream: order.stream?.code ?? '—' })] },
    ...(pricing ? [
      { label: t('ordc.p.recommended'), value: money(t, pricing.recommendedPrice), notes: [pricing.approvedAt ? t('ordc.p.approved', { price: formatMoney(pricing.salePrice), date: tashkentDay(pricing.approvedAt) }) : null] },
      { label: t('ordc.p.mode'), value: t(`ordc.mode.${pricing.deliveryMode}`), notes: [pricing.deliveryMode === 'PARTIAL' ? t('ordc.p.modeNote', { hidden: formatMoney(pricing.hiddenDelivery), add: formatMoney(pricing.priceAdd) }) : null] },
      { label: t('ordc.p.visible'), value: money(t, order.deliveryFee), notes: [t(where === 'ADDRESS' ? 'ordc.p.visibleAddress' : 'ordc.p.visibleCenter', { other: formatMoney(where === 'ADDRESS' ? pricing.visibleCenter : pricing.visibleAddress) })] },
      { label: t('ordc.p.tariff'), value: money(t, pricing.elchiTariff), notes: [t('ordc.p.tariffNote', { where: t(`opw.whereDeliver.${where}`) })] },
    ] : []),
    { label: t('ordc.p.total'), value: <span className={styles.total}>{money(t, order.totalAmount)}</span> },
  ];
  const split = pricing?.split ?? null;
  const base = split ? split.wholesaler + split.affiliate + split.callCenter + split.platformService : 0;
  const share = (value: number) => `${((value / (base || 1)) * 100).toFixed(1)}%`;
  return (
    <Section title={t('ordc.p.title')} description={t('ordc.p.description')} phone={phone}>
      <Facts rows={rows} width={160} />
      {split && phone ? (
        <div className={styles.splitBox}>
          <p>{t('ordc.p.splitPhone', { base: formatMoney(base) })}</p>
          <dl>
            {([['ordc.p.wholesaler', split.wholesaler], ['ordc.p.affiliate', split.affiliate], ['ordc.p.callCenter', split.callCenter], ['ordc.p.platform', split.platformService]] as const).map(([key, value]) => (
              <div key={key}><dt>{t(key)}</dt><dd><strong>{formatMoney(value)}</strong><span>{share(value)}</span></dd></div>
            ))}
            <div data-total><dt>{t('ordc.p.goodsPrice')}</dt><dd><strong>{formatMoney(base)}</strong><span>100%</span></dd></div>
          </dl>
        </div>
      ) : split ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>{t('ordc.p.splitCaption')}</caption>
            <thead><tr><th scope="col">{t('ordc.p.splitBase', { base: formatMoney(base) })}</th><th scope="col" className={styles.num}>{t('ordc.p.splitSum')}</th><th scope="col" className={styles.num}>{t('ordc.p.splitShare')}</th></tr></thead>
            <tbody>
              {([['ordc.p.wholesaler', split.wholesaler], ['ordc.p.affiliate', split.affiliate], ['ordc.p.callCenter', split.callCenter], ['ordc.p.platform', split.platformService]] as const).map(([key, value]) => (
                <tr key={key}><td>{t(key)}</td><td className={styles.num}>{formatMoney(value)}</td><td className={styles.num}>{share(value)}</td></tr>
              ))}
              <tr><td><strong>{t('ordc.p.goodsPrice')}</strong></td><td className={styles.num}><strong>{formatMoney(base)}</strong></td><td className={styles.num}><strong>100%</strong></td></tr>
            </tbody>
          </table>
        </div>
      ) : null}
      <Hint icon={<Lock aria-hidden />}>{t('ordc.p.sealed', { when: tashkentDateTime(order.createdAt) })}</Hint>
    </Section>
  );
}

const formatKg = (grams: number) => (grams / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

// ── Pul yozuvlari ───────────────────────────────────────────────────────────

/** Yetkazilganda yoziladi: ushlab turilgan → mavjud (Elchi o'tkazgach) yoki teskari (qaytarilsa). */
export function MoneySection({ order, phone, now }: { order: OrderDetail; phone: boolean; now: number }) {
  const { t } = useTranslation();
  const entries = order.money?.entries ?? [];
  const state = order.money?.state ?? null;
  const number = orderLeadLabel(order);
  const goods = (order.sellerOrders[0]?.items[0]?.unitPrice ?? 0) * (order.sellerOrders[0]?.items[0]?.quantity ?? 1);
  const partial = order.pricing?.deliveryMode === 'PARTIAL';
  return (
    <Section title={t('ordc.mo.title')} description={state ? t('ordc.mo.description', { state: t(`ordc.money.${state}`).toLowerCase() }) : t('ordc.mo.notYet')} phone={phone}>
      {entries.length && phone ? (
        <ul className={styles.moneyList} aria-label={t('ordc.mo.caption', { id: number })}>
          {entries.map((entry) => (
            <li key={entry.account}>
              <span><strong>{entry.account}</strong><strong>{entry.amount === null ? <Pending /> : `${entry.state === 'REVERSED' ? '−' : '+'}${formatMoney(entry.amount)}`}</strong></span>
              <span>{entry.label}</span>
              <span><Badge tone={MONEY_TONE[entry.state]} icon={TONE_ICON[MONEY_TONE[entry.state]]}>{t(`ordc.money.${entry.state}`)}</Badge><span>{shortTime(entry.at, now)}</span></span>
            </li>
          ))}
          <li data-total><span><strong>{t('ordc.mo.total')}</strong><strong>{formatMoney(goods)}</strong></span></li>
        </ul>
      ) : entries.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>{t('ordc.mo.caption', { id: number })}</caption>
            <thead><tr><th scope="col">{t('ordc.mo.account')}</th><th scope="col" className={styles.num}>{t('ordc.mo.amount')}</th><th scope="col">{t('ordc.mo.state')}</th><th scope="col">{t('ordc.mo.at')}</th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.account}>
                  <td><span className={styles.stack}><span>{entry.account}</span><span>{entry.label}</span></span></td>
                  <td className={styles.num}>{entry.amount === null ? <Pending /> : `${entry.state === 'REVERSED' ? '−' : '+'}${formatMoney(entry.amount)}`}</td>
                  <td><Badge tone={MONEY_TONE[entry.state]} icon={TONE_ICON[MONEY_TONE[entry.state]]}>{t(`ordc.money.${entry.state}`)}</Badge></td>
                  <td>{shortTime(entry.at, now)}</td>
                </tr>
              ))}
              <tr><td><strong>{t('ordc.mo.total')}</strong></td><td className={styles.num}><strong>{formatMoney(goods)}</strong></td><td /><td /></tr>
            </tbody>
          </table>
        </div>
      ) : <p className={styles.empty}>{t('ordc.mo.empty')}</p>}
      {entries.length ? <Hint icon={<Wallet aria-hidden />}>{t(state === 'REVERSED' ? 'ordc.mo.reversedHint' : state === 'AVAILABLE' ? 'ordc.mo.availableHint' : 'ordc.mo.heldHint')}</Hint> : null}
      {entries.length && partial && order.pricing ? <Hint icon={<Info aria-hidden />}>{t('ordc.mo.partialHint', { add: formatMoney(order.pricing.priceAdd), hidden: formatMoney(order.pricing.hiddenDelivery) })}</Hint> : null}
    </Section>
  );
}

// ── Holat tarixi ────────────────────────────────────────────────────────────

/** Keyingi qadam (kutilmoqda) — asosiy yo'lning navbatdagi holati. */
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: 'PICKING', PICKING: 'PACKED', PACKED: 'HANDED_TO_ELCHI', HANDED_TO_ELCHI: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED', DELIVERED: 'REMITTED', REMITTED: 'SETTLED',
  REFUSED: 'RETURNING', RETURN_REQUESTED: 'RETURNING', RETURNING: 'RETURNED_GRADED',
};

/** Har o'tish: kim, qachon; ruxsat etilmagan (masalan, Elchi «Yetkazildi → Yo'lda») ham yoziladi (BUY-2). */
export function HistorySection({ order, phone }: { order: OrderDetail; phone: boolean }) {
  const { t } = useTranslation();
  const entries = order.lead?.statusHistory ?? [];
  const next = NEXT[order.status];
  const label = (code: OrderStatus | null) => (code ? t(`status.order.${code}`) : t('ordc.h.created'));
  // Joriy holatga olib kelgan yozuv — halqa; undan keyingi chiziq kulrang (dizayn «Yo'lda → Yetkazildi»).
  const currentIndex = entries.reduce((found, entry, index) => (entry.accepted && entry.toStatus === order.status ? index : found), -1);
  return (
    <Section title={t('ordc.h.title')} description={t('ordc.h.description')} phone={phone}>
      <ol className={styles.timeline} data-compact>
        {entries.map((entry, index) => {
          const last = index === entries.length - 1 && !next;
          return (
            <li key={index} data-state={entry.accepted ? (index === currentIndex ? 'current' : undefined) : 'failed'} data-last={last || undefined}>
              <span className={styles.timeAt}><Stamp at={entry.createdAt} /></span>
              <span className={styles.timeDot}><span /></span>
              {last ? null : <span className={styles.timeLine} data-done={(entry.accepted && index < currentIndex) || undefined} />}
              <span className={styles.timeText}>
                <span>{entry.accepted ? t('ordc.h.step', { from: label(entry.fromStatus), to: label(entry.toStatus) }) : t('ordc.h.rejected', { from: label(entry.fromStatus), to: label(entry.toStatus) })}</span>
                <span>{historyNote(entry, t)}</span>
              </span>
              {entry.accepted ? null : <span className={styles.timeBadge}><Badge tone="danger" icon={TONE_ICON.danger}>{t('ordc.j.REJECTED')}</Badge></span>}
            </li>
          );
        })}
        {next ? (
          <li data-state="pending" data-last>
            <span className={styles.timeAt}>—</span>
            <span className={styles.timeDot}><span /></span>
            <span className={styles.timeText}>
              <span>{t('ordc.h.step', { from: label(order.status), to: label(next) })}</span>
              <span>{t(`ordc.h.next.${next}` as TranslationKey)}</span>
            </span>
          </li>
        ) : null}
      </ol>
    </Section>
  );
}

function historyNote(entry: OrderHistoryEntry, t: T): string {
  const who = entry.actorType === 'WEBHOOK' || entry.actorType === 'ELCHI' ? t('ordc.h.webhook') : entry.actorType === 'SYSTEM' ? t('ordc.h.system') : entry.actorName ?? entry.actorRole ?? '—';
  const note = entry.accepted ? entry.note ?? entry.reason : t('ordc.h.rejectedNote');
  return [who, note].filter(Boolean).join(' · ');
}

// ── Posilka va Elchi ────────────────────────────────────────────────────────

export function ParcelSection({ order, phone, now }: { order: OrderDetail; phone: boolean; now: number }) {
  const { t } = useTranslation();
  const parcel = order.parcel ?? null;
  const url = order.sellerOrders[0]?.trackingUrl ?? null;
  const where = order.lead?.whereDeliver ?? 'CENTER';
  const weight = order.lead?.weightGrams ?? order.product?.weightGrams ?? null;
  const created = order.elchiEvents?.find((event) => event.state === 'ACCEPTED' && event.title.startsWith('Posilka'))?.at ?? parcel?.createdAt ?? null;
  const rows: Fact[] = [
    {
      label: t('ordc.e.track'),
      value: parcel?.track ? <span className={styles.phoneValue}>{parcel.track}<CopyButton text={parcel.track} ariaLabel={t('ordc.e.copyTrack')} size="sm" /></span> : <span className={styles.muted}>{t(AT_ELCHI.includes(order.status) ? 'ord.trackPending' : 'ord.trackOnHandover')}</span>,
    },
    { label: t('ordc.e.parcel'), value: t('ordc.e.parcelValue', { kg: weight ? formatKg(weight) : '—' }), notes: [t('ordc.e.parcelNote')] },
    { label: t('ordc.e.delivery'), value: t(`ord.where.${where}`), notes: [order.customer ? t(where === 'ADDRESS' ? 'ordc.e.toDoor' : 'ordc.e.toCenter', { district: order.customer.districtName }) : null] },
    { label: t('ordc.e.act'), value: parcel?.act ? parcel.act.code : '—', notes: [parcel?.act ? t('ordc.e.actNote', { when: tashkentDateTime(parcel.act.at), count: parcel.act.count }) : null] },
    { label: t('ordc.e.atElchi'), value: created ? t('ordc.e.created', { when: shortTime(created, now) }) : order.parcel?.attempts?.length ? t('ordc.e.notCreated') : '—', notes: [created ? t('ordc.e.createdNote') : null] },
    { label: t('ordc.e.label'), value: parcel?.label ? t('ordc.e.printed', { when: shortTime(parcel.label.printedAt, now) }) : '—', notes: [parcel?.label ? t('ordc.e.printedNote', { by: parcel.label.by, count: parcel.label.count }) : null] },
  ];
  const open = url ? <a href={url} target="_blank" rel="noreferrer" className={styles.iconLink} aria-label={t('ordc.e.open')} title={t('ordc.e.open')}><ExternalLink aria-hidden /></a> : undefined;
  return (
    <Section title={t('ordc.e.title')} link={open} phone={phone}>
      <Facts rows={rows} width={120} />
    </Section>
  );
}

/** Har webhook jurnalda saqlanadi; ruxsat etilmagan o'tish — «Rad etildi». */
export function ElchiSection({ order, phone }: { order: OrderDetail; phone: boolean }) {
  const { t } = useTranslation();
  const events = order.elchiEvents ?? [];
  return (
    <Section title={t('ordc.ev.title')} description={t('ordc.ev.description')} phone={phone}>
      {events.length ? <Journal items={events} /> : <p className={styles.empty}>{t('ordc.ev.empty')}</p>}
    </Section>
  );
}

/** Mijozga SMS: holat o'zgargandan keyin 1 daqiqa ichida; «Yetkazildi» matni — 11-qaror. */
export function SmsSection({ order, admin, phone, onResend }: { order: OrderDetail; admin: boolean; phone: boolean; onResend: () => void }) {
  const { t } = useTranslation();
  const items = [
    ...(order.sms ?? []),
    ...(['DELIVERED', 'REMITTED', 'SETTLED'].includes(order.status) ? [{ at: null, title: t('status.order.DELIVERED'), detail: t('ordc.sms.deliveredPending'), state: null }] : []),
  ];
  const resend = admin && order.sms?.length ? <button type="button" className={styles.linkButton} onClick={onResend}>{t('ordc.sms.resend')}</button> : undefined;
  return (
    <Section title={t('ordc.sms.title')} description={t('ordc.sms.description')} link={resend} phone={phone}>
      <Journal items={items} />
    </Section>
  );
}

export function Journal({ items }: { items: ReadonlyArray<{ at: string | null; title: string; detail: string | null; state: JournalState | null }> }) {
  return (
    <ol className={styles.timeline} data-compact>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const pending = item.state === 'PENDING' || item.state === null;
        return (
          <li key={index} data-state={pending ? 'pending' : item.state === 'REJECTED' || item.state === 'FAILED' ? 'failed' : undefined} data-last={last || undefined}>
            <span className={styles.timeAt}>{item.at ? <Stamp at={item.at} /> : '—'}</span>
            <span className={styles.timeDot}><span /></span>
            {last ? null : <span className={styles.timeLine} data-done={!pending || undefined} />}
            <span className={styles.timeText}>
              <span>{item.title}</span>
              {item.detail ? <span>{item.detail}</span> : null}
            </span>
            {item.state ? <span className={styles.timeBadge}><JournalBadge state={item.state} /></span> : null}
          </li>
        );
      })}
    </ol>
  );
}

// ── Yig'ish ─────────────────────────────────────────────────────────────────

export function PickingSection({ order, phone, now }: { order: OrderDetail; phone: boolean; now: number }) {
  const { t } = useTranslation();
  const picking = order.picking ?? null;
  if (!picking) return null;
  const item = order.sellerOrders[0]?.items[0] ?? null;
  const rows: Fact[] = [
    { label: t('ordc.pk.by'), value: picking.by ?? <span className={styles.muted}>{t('ordc.pk.notYet')}</span>, notes: [picking.from ? [picking.wave, `${shortTime(picking.from, now)}${picking.to ? `–${tashkentClock(Date.parse(picking.to))}` : ''}`].filter(Boolean).join(' · ') : null] },
    { label: t('ordc.pk.scan'), value: `${item?.productName ?? '—'} · ${picking.scanned} / ${picking.total}`, notes: [[picking.barcode, picking.cell ? t('ordc.pk.cell', { cell: picking.cell }) : null].filter(Boolean).join(' · ') || null] },
    {
      label: t('ordc.pk.reserved'),
      value: picking.reservedAt ? t('ordc.pk.reservedValue', { count: picking.total, when: shortTime(picking.reservedAt, now) }) : '—',
      notes: [picking.releasedAt ? t('ordc.pk.released', { when: shortTime(picking.releasedAt, now) }) : order.status === 'CANCELLED' ? t('ordc.pk.freed') : t('ordc.pk.untilHandover')],
    },
  ];
  return <Section title={t('ordc.pk.title')} phone={phone}><Facts rows={rows} width={120} /></Section>;
}

// ── Fiskal chek ─────────────────────────────────────────────────────────────

/** Chek (EQ-09) va kim chiqarishi (28-savol) hali belgilanmagan — qiymatlar ochiq, summa va tarkib ma'lum. */
export function ReceiptSection({ order, phone }: { order: OrderDetail; phone: boolean }) {
  const { t } = useTranslation();
  const goods = (order.sellerOrders[0]?.items[0]?.unitPrice ?? 0) * (order.sellerOrders[0]?.items[0]?.quantity ?? 1);
  const rows: Fact[] = [
    { label: t('ordc.r.receipt'), value: <Pending /> },
    { label: t('ordc.r.issuer'), value: <Pending /> },
    { label: t('ordc.r.sum'), value: money(t, order.totalAmount), notes: [t('ordc.m.split', { goods: formatMoney(goods), delivery: formatMoney(order.deliveryFee) })] },
    { label: t('ordc.r.contents'), value: t('ordc.r.contentsValue'), notes: [t('ordc.r.contentsNote')] },
  ];
  return <Section title={t('ordc.r.title')} phone={phone}><Facts rows={rows} width={120} /></Section>;
}

// ── Lid va manba ────────────────────────────────────────────────────────────

const POSTBACK_TONE: Record<JournalState, BadgeTone> = JOURNAL_TONE;

export function SourceSection({ order, phone, now, leadHref }: { order: OrderDetail; phone: boolean; now: number; leadHref: string | null }) {
  const { t } = useTranslation();
  const stream = order.stream ?? null;
  const number = orderLeadLabel(order);
  const source = order.lead?.source ?? null;
  const rows: Fact[] = [
    { label: t('ordc.s.lead'), value: leadHref ? <Link to={leadHref} className={styles.leadLink}>{number}</Link> : number, notes: [stream?.leadCreatedAt ? t('ordc.s.leadAt', { when: tashkentDateTime(stream.leadCreatedAt) }) : null] },
    { label: t('ordc.s.source'), value: source ? t(`al.source.${source}` as TranslationKey) : '—' },
    { label: t('ordc.s.page'), value: <span className={styles.pageValue}>{stream?.code ? <span className={styles.code}>{stream.code}</span> : null}{stream?.affiliateName ?? '—'}</span> },
    { label: 'sub1', value: stream?.sub1 ?? '—' },
    { label: t('ordc.s.confirmed'), value: order.confirmedByActor ? `${order.confirmedByActor.name} · ${shortTime(order.confirmedByActor.at, now)}` : '—' },
  ];
  const postbacks = order.postbacks ?? [];
  const lastPostback = postbacks.at(-1) ?? null;
  return (
    <Section title={t('ordc.s.title')} description={t('ordc.s.description')} phone={phone}>
      <Facts rows={rows} width={120} />
      {lastPostback ? (
        <div className={`${styles.postback} ${styles.postbackBox}`}>
          <span className={styles.stack}>
            <span>{`${dayTime(lastPostback.at, t, now)} · ${lastPostback.event}`}</span>
            <span>{t('ordc.s.postbackMeta', { attempt: lastPostback.attempt, code: lastPostback.code ?? '—' })}</span>
          </span>
          <Badge tone={POSTBACK_TONE[lastPostback.state]} icon={TONE_ICON[POSTBACK_TONE[lastPostback.state]]}>{t(`ordc.j.${lastPostback.state}`)}</Badge>
        </div>
      ) : null}
    </Section>
  );
}

// ── Nizoli ──────────────────────────────────────────────────────────────────

/** Nizoli buyurtma: qo'ng'iroq yozuvi 1 yil saqlanadi; tinglash — lid kartasida; nizoni yopish — admin. */
export function DisputeSection({ order, admin, leadHref, onClose }: { order: OrderDetail; admin: boolean; leadHref: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const dispute = order.dispute;
  if (!dispute) return null;
  const actions: ReactNode = (
    <div className={styles.nowActions}>
      {leadHref ? <Link to={`${leadHref}?listen=1`} className={styles.secondary}><Headphones aria-hidden />{t('ordc.d.listen')}</Link> : null}
      {admin ? <button type="button" className={styles.secondary} onClick={onClose}><ShieldCheck aria-hidden />{t('ordc.d.close')}</button> : null}
    </div>
  );
  return (
    <section className={styles.now} aria-labelledby="order-dispute" data-testid="order-dispute">
      <div className={styles.nowTitleRow}>
        <Badge tone="warning" icon={Flag}>{t('ordc.disputed')}</Badge>
        <h2 id="order-dispute" className={styles.sectionTitle}>{t('ordc.d.title')}</h2>
      </div>
      {dispute.keepUntil ? (
        <div className={styles.warn} role="note">
          <TriangleAlert aria-hidden />
          <div><p>{t('ordc.d.keep', { date: tashkentDay(dispute.keepUntil) })}</p><p>{t('ordc.d.keepText')}</p></div>
        </div>
      ) : null}
      <Facts rows={[
        { label: t('ordc.d.by'), value: `${dispute.by} · ${tashkentClock(Date.parse(dispute.at))}`, notes: [`«${dispute.reason}»`] },
        { label: t('ordc.d.who'), value: <Pending /> },
      ]} width={140} />
      {actions}
    </section>
  );
}

