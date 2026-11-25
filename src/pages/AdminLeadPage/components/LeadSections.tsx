import { ArrowRight, ChartColumn, ChevronRight, CircleX, Clock4, GitMerge, Headphones, Info, Lock, RotateCcw, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AdminLeadAttempt, AdminLeadCard } from '../../../features/adminLeads/model/adminLeadTypes';
import type { LeadStatus } from '../../../features/operator/model/operatorTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge/Badge';
import { CopyButton } from '../../../shared/ui/CopyButton/CopyButton';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { TONE_ICON } from '../../../shared/ui/StatusBadge/statusConfig';
import { missingRecording, mmss, outcomeBadge, relativeDay, shortTime } from '../model/leadView';
import { Facts, Hint, Section, type Fact } from '../../../shared/ui/RecordCard/RecordCard';
import record from '../../../shared/ui/RecordCard/RecordCard.module.css';
import own from '../AdminLeadPage.module.css';

const styles = { ...record, ...own };

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;
const sum = (t: T, amount: number) => t('al.sum', { amount: formatMoney(amount) });

// ── Mijoz ────────────────────────────────────────────────────────────────────

/** Telefon: admin — to'liq raqam va nusxa (25-qaror); nazoratchi — yashirin. Manzil: formadan yoki operator tuzatgan. */
export function CustomerSection({ lead, admin, phone, now }: { lead: AdminLeadCard; admin: boolean; phone: boolean; now: number }) {
  const { t } = useTranslation();
  const address = lead.address;
  const edit = [...lead.history].reverse().find((entry) => entry.changes?.length);
  const originalDistrict = edit?.changes?.find((change) => change.field === 'district')?.from ?? null;
  const deliveryChanged = edit?.changes?.some((change) => change.field === 'whereDeliver') ?? false;
  const rows: Fact[] = [
    { label: t('alk.c.name'), value: lead.customerName },
    {
      label: t('alk.c.phone'),
      value: admin && lead.phone ? (
        <span className={styles.phoneValue}>
          {lead.phone}
          <CopyButton text={lead.phone} size="sm" ariaLabel={t('alk.c.copy')} successMessage={t('alk.c.copied')} />
        </span>
      ) : <span className={styles.hidden}><Lock aria-hidden />{t('alk.c.hidden')}</span>,
      notes: admin && lead.phone ? [t('alk.c.adminOnly')] : [],
    },
    {
      label: t('alk.c.address'),
      value: address ? [address.regionName, address.districtName, address.addressLine].filter(Boolean).join(', ') : t('alk.c.noAddress'),
      notes: address
        ? address.editedByOperator && edit
          ? [t('alk.c.edited', { name: edit.actor, time: `${shortTime(edit.at, now)}` }), originalDistrict ? t('alk.c.original', { value: originalDistrict }) : null]
          : [t('alk.c.fromForm')]
        : [],
    },
    { label: t('alk.c.delivery'), value: address ? t(`alk.c.where.${address.whereDeliver}`) : '—', notes: address ? [deliveryChanged ? t('alk.c.deliveryChanged') : t('alk.c.fromForm')] : [] },
    { label: t('alk.c.consent'), value: lead.consentAt ? t('alk.c.consentGiven') : '—', notes: lead.consentAt ? [t('alk.c.consentNote', { date: tashkentDateTime(lead.consentAt) })] : [] },
  ];
  const history = admin && lead.phone ? (
    <Link to={`/admin/orders?q=${encodeURIComponent(lead.phone)}`} className={styles.link}>{t('alk.c.history')}<ChevronRight aria-hidden /></Link>
  ) : undefined;
  return (
    <Section title={t('alk.c.title')} description={lead.sameNumberLeads && lead.sameNumberLeads > 1 ? t('alk.c.sameNumber', { count: lead.sameNumberLeads }) : undefined} link={history} phone={phone}>
      <Facts rows={rows} />
    </Section>
  );
}

// ── Mahsulot va narx ─────────────────────────────────────────────────────────

/** Narx ariza paytida lidga yoziladi: sahifa narxi, ikki yetkazish turi va mijozga jami (rejim bilan). */
export function ProductSection({ lead, admin, phone }: { lead: AdminLeadCard; admin: boolean; phone: boolean }) {
  const { t } = useTranslation();
  const info = lead.productInfo;
  const price = lead.price;
  const where = price?.whereDeliver ?? lead.address?.whereDeliver ?? 'CENTER';
  const options = info?.options ?? price?.deliveryOptions ?? null;
  const unit = price?.unitPrice ?? lead.product.salePrice;
  const mode = info?.deliveryMode ?? price?.deliveryMode ?? null;
  const other = where === 'CENTER' ? 'ADDRESS' : 'CENTER';
  const meta = [info?.category, info?.wholesalerName ? t('alk.p.wholesaler', { name: info.wholesalerName }) : null, info?.weightGrams ? t('alk.p.kg', { kg: info.weightGrams / 1000 }) : null].filter(Boolean).join(' · ');
  const rows: Fact[] = [
    { label: t('alk.p.product'), value: lead.product.name, notes: meta ? [meta] : [] },
    { label: t('alk.p.price'), value: sum(t, unit), notes: [t('alk.p.priceNote')] },
    {
      label: t('alk.p.delivery'),
      value: options ? t('alk.p.deliveryValue', { mode: mode ? t(`alk.p.mode.${mode}`) : t('alk.p.mode.SEPARATE'), center: sum(t, options.CENTER) }) : price ? sum(t, price.deliveryFee) : '—',
      notes: options ? [t('alk.p.deliveryDoor', { address: sum(t, options.ADDRESS) })] : [],
    },
    {
      label: t('alk.p.total'),
      value: price ? sum(t, price.totalAmount) : '—',
      notes: price && options ? [t(`alk.p.totalNote.${where}`, { amount: sum(t, price.subtotal + options[other]) })] : [],
    },
  ];
  const open = admin ? <Link to={`/admin/products/${encodeURIComponent(lead.product.id)}`} className={styles.link}>{t('alk.p.open')}<ChevronRight aria-hidden /></Link> : undefined;
  return (
    <Section title={t('alk.p.title')} link={open} phone={phone}>
      <Facts rows={rows} />
      <Hint icon={<Info aria-hidden />}>{t('alk.p.fixed')}</Hint>
    </Section>
  );
}

// ── Urinishlar ───────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: AdminLeadAttempt['outcome'] }) {
  const { t } = useTranslation();
  const { tone, label } = outcomeBadge(outcome, t);
  return <Badge tone={tone} icon={outcome === 'IN_CALL' ? Clock4 : TONE_ICON[tone]}>{label}</Badge>;
}

function RecordingCell({ attempt, index, onListen }: { attempt: AdminLeadAttempt; index: number; onListen: (index: number) => void }) {
  const { t } = useTranslation();
  if (attempt.recording === 'READY') {
    return (
      <button type="button" className={styles.listen} onClick={() => onListen(index)} aria-label={t('alk.u.listenAria', { n: index + 1 })}>
        <Headphones aria-hidden />
        {t('alk.u.listen')}
      </button>
    );
  }
  if (attempt.recording === 'AFTER_CALL') return <span className={styles.muted}>{t('alk.u.afterCall')}</span>;
  if (missingRecording(attempt)) return <span className={styles.missing}><CircleX aria-hidden />{t('alk.u.missing')}</span>;
  return <span className={styles.muted}>—</span>;
}

/** Har urinish: operator, vaqt, natija, izoh, davomiylik va yozuv; telefonda — kartalar. */
export function AttemptsSection({ lead, phone, now, onListen }: { lead: AdminLeadCard; phone: boolean; now: number; onListen: (index: number) => void }) {
  const { t } = useTranslation();
  const log = lead.attemptLog ?? [];
  const finished = !['NEW', 'BOOKED', 'CALLBACK'].includes(lead.status);
  const missing = log.some(missingRecording);
  return (
    <Section id="lead-attempts" title={t('alk.u.title', { count: log.filter((attempt) => attempt.outcome !== 'IN_CALL').length || log.length })} description={t('alk.u.desc')} phone={phone}>
      {!log.length ? <p className={styles.empty}>{t('alk.u.empty')}</p> : phone ? (
        <ul className={styles.attemptCards} aria-label={t('alk.u.caption', { id: lead.id })}>
          {log.map((attempt, index) => (
            <li key={index}>
              <span className={styles.attemptTop}>
                <span>{t('alk.u.cardTitle', { n: index + 1, time: shortTime(attempt.at, now) })}</span>
                <OutcomeBadge outcome={attempt.outcome} />
              </span>
              <span className={styles.attemptWho}>{attempt.operatorName}{attempt.channel ? <span> · {attempt.channel}</span> : null}</span>
              {attempt.comment ? <span className={styles.muted}>{attempt.comment}</span> : null}
              <span className={styles.attemptMeta}>
                <span>{t('alk.u.duration')} <strong>{attempt.durationSeconds ? mmss(attempt.durationSeconds) : '—'}</strong></span>
                <span>{t('alk.u.recording')} <RecordingCell attempt={attempt} index={index} onListen={onListen} /></span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>{t('alk.u.caption', { id: lead.id })}</caption>
            <thead>
              <tr>
                <th>{t('alk.u.col.no')}</th>
                <th>{t('alk.u.col.at')}</th>
                <th>{t('alk.u.col.operator')}</th>
                <th>{t('alk.u.col.result')}</th>
                <th className={styles.num}>{t('alk.u.col.duration')}</th>
                <th>{t('alk.u.col.recording')}</th>
              </tr>
            </thead>
            <tbody>
              {log.map((attempt, index) => (
                <tr key={index}>
                  <td className={styles.tabular}>{index + 1}</td>
                  <td className={styles.tabular}>{shortTime(attempt.at, now)}</td>
                  <td>
                    <span className={styles.stack}>
                      <span>{attempt.operatorName}</span>
                      <span>{attempt.channel ?? '—'}</span>
                    </span>
                  </td>
                  <td>
                    <OutcomeBadge outcome={attempt.outcome} />
                    {attempt.comment ? <span className={styles.cellNote}>{attempt.comment}</span> : null}
                  </td>
                  <td className={styles.num}>{attempt.durationSeconds ? mmss(attempt.durationSeconds) : '—'}</td>
                  <td><RecordingCell attempt={attempt} index={index} onListen={onListen} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {missing ? (
        <div className={styles.alert} role="alert">
          <CircleX aria-hidden />
          <div>
            <p>{t('alk.u.missingTitle')}</p>
            <p>{t('alk.u.missingText')}</p>
          </div>
        </div>
      ) : null}
      {finished && lead.status === 'NO_CONTACT' ? (
        <>
          <Hint icon={<Clock4 aria-hidden />}>{t('alk.u.scheduleClosed')}</Hint>
          <Hint icon={<RotateCcw aria-hidden />}>{t('alk.u.reopenAuto')}</Hint>
        </>
      ) : !finished ? <Hint icon={<Clock4 aria-hidden />}>{t('alk.u.schedule')}</Hint> : null}
    </Section>
  );
}

// ── Lid tarixi ───────────────────────────────────────────────────────────────

const STATUS_TITLE: Record<LeadStatus, TranslationKey> = {
  NEW: 'alk.h.returned',
  BOOKED: 'alk.h.booked',
  CALLBACK: 'alk.h.callback',
  CONFIRMED: 'alk.h.confirmed',
  REJECTED: 'alk.h.rejected',
  INVALID: 'alk.h.invalid',
  MERGED: 'alk.h.merged',
  NO_CONTACT: 'alk.h.noContact',
};

/** Holat o'zgarishlari: kim va qachon; ochiq lidda — keyingi kutilayotgan qadam (uzuq doira). */
export function HistorySection({ lead, phone, now }: { lead: AdminLeadCard; phone: boolean; now: number }) {
  const { t } = useTranslation();
  const entries = lead.history.map((entry) => {
    const note = entry.note ?? '';
    let title = t(STATUS_TITLE[entry.toStatus]);
    let sub = entry.actor;
    if (entry.fromStatus === null) {
      title = t('alk.h.arrived');
      sub = t('alk.h.arrivedSub', { stream: lead.stream?.code ?? '—' });
    } else if (/qayta ochdi|Qayta ochildi/i.test(note)) {
      title = t('alk.h.reopened');
      sub = `${entry.actor} · «${note.replace(/^.*?:\s*/, '')}»`;
    } else if (/o‘tkazildi/.test(note)) {
      title = t('alk.h.transferred');
      sub = `${entry.actor} · ${note.replace(/^.*?:\s*/, '')}`;
    } else if (/bo‘shatildi/.test(note)) {
      title = t('alk.h.released');
      sub = `${entry.actor} · «${note.replace(/^.*?:\s*/, '')}»`;
    } else if (entry.changes?.length) {
      title = t('alk.h.address');
    } else if (entry.toStatus === 'REJECTED' && note) {
      title = t('alk.h.rejectedWhy', { reason: note });
    } else if (note) {
      sub = `${entry.actor} · ${note}`;
    }
    return { at: entry.at, title, sub, status: entry.toStatus };
  });
  const pending = lead.status === 'BOOKED' && lead.bookedUntil
    ? { at: lead.bookedUntil, title: t('alk.h.resultDue'), sub: t('alk.h.resultDueSub') }
    : lead.status === 'CALLBACK' && lead.nextAttemptAt && Date.parse(lead.nextAttemptAt) > now
      ? { at: lead.nextAttemptAt, title: t('alk.h.nextCall'), sub: t('alk.h.nextCallSub', { operator: lead.operator?.name ?? '—' }) }
      : null;
  return (
    <Section title={t('alk.h.title')} description={t('alk.h.desc')} phone={phone}>
      <ol className={styles.timeline} data-wide={[...entries, ...(pending ? [pending] : [])].some((entry) => shortTime(entry.at, now).includes(',')) || undefined}>
        {entries.map((entry, index) => {
          const last = index === entries.length - 1;
          return (
            <li key={index} data-state={last && pending ? 'current' : 'done'} data-last={last && !pending ? true : undefined}>
              <span className={styles.timeAt}>{shortTime(entry.at, now)}</span>
              <span className={styles.timeDot}><span /></span>
              {!last || pending ? <span className={styles.timeLine} data-done={!last || undefined} /> : null}
              <span className={styles.timeText}>
                <span>{entry.title}</span>
                <span>{entry.sub}</span>
              </span>
              <span className={styles.timeBadge}><StatusBadge family="lead" code={entry.status} /></span>
            </li>
          );
        })}
        {pending ? (
          <li data-state="pending" data-last>
            <span className={styles.timeAt}>{shortTime(pending.at, now)}</span>
            <span className={styles.timeDot}><span /></span>
            <span className={styles.timeText}>
              <span>{pending.title}</span>
              <span>{pending.sub}</span>
            </span>
            <span className={styles.timeBadge} />
          </li>
        ) : null}
      </ol>
    </Section>
  );
}

// ── Manba va klik ────────────────────────────────────────────────────────────

const POSTBACK_TONE: Record<'SENT' | 'FAILED' | 'PENDING', BadgeTone> = { SENT: 'success', FAILED: 'danger', PENDING: 'warning' };

export function SourceSection({ lead, admin, phone }: { lead: AdminLeadCard; admin: boolean; phone: boolean }) {
  const { t } = useTranslation();
  const stream = lead.stream;
  const main: Fact[] = [
    { label: t('alk.s.source'), value: t(`al.source.${lead.source}`) },
    {
      label: t('alk.s.page'),
      value: <span className={styles.pageValue}>{stream?.code ? <span className={styles.code}>{stream.code}</span> : null}{stream?.productName ?? lead.product.name}</span>,
      notes: stream?.createdAt ? [t('alk.s.created', { date: tashkentDay(stream.createdAt) })] : [],
    },
    {
      label: t('alk.s.seller'),
      value: stream?.affiliateId && admin
        ? <Link to={`/admin/users/${encodeURIComponent(stream.affiliateId)}`} className={styles.link}>{stream.affiliateName}</Link>
        : stream?.affiliateName ?? lead.affiliateName ?? '—',
    },
  ];
  const click: Fact[] = [
    { label: 'sub1', value: stream?.sub1 ?? '—' },
    { label: t('alk.s.subs'), value: stream?.subs ?? '—' },
    { label: 'utm_source', value: stream?.utmSource ?? '—' },
    { label: 'fbclid', value: stream ? t(stream.fbclid ? 'alk.s.fbclidYes' : 'alk.s.fbclidNo') : '—' },
    { label: t('alk.s.ip'), value: stream?.ip ?? '—' },
    { label: t('alk.s.device'), value: stream?.device ?? '—' },
  ];
  return (
    <Section title={t('alk.s.title')} description={t('alk.s.desc')} phone={phone}>
      <div className={styles.factGroups}>
        <Facts rows={main} width={110} />
        <Facts rows={click} width={110} pairs />
      </div>
      <div className={styles.postbacks}>
        <p>{t('alk.s.postback')}</p>
        {lead.postbacks?.length ? lead.postbacks.map((item, index) => (
          <div key={index} className={styles.box}>
            <div className={styles.postback}>
              <span className={styles.stack}>
                <span>{tashkentClock(Date.parse(item.at))} · {item.event}</span>
                <span>{t('alk.s.postbackMeta', { attempt: item.attempt, code: item.code ?? '—' })}</span>
              </span>
              <Badge tone={POSTBACK_TONE[item.state]} icon={TONE_ICON[POSTBACK_TONE[item.state]]}>{t(`alk.s.pb.${item.state}`)}</Badge>
            </div>
          </div>
        )) : <p className={styles.muted}>{t('alk.s.noPostback')}</p>}
      </div>
    </Section>
  );
}

// ── Dublikat ─────────────────────────────────────────────────────────────────

/** Dublikat yo'q (shu raqam va mahsulot, 30 kun) va mijozning boshqa lidlari; dublikat lidda — asosiy lid. */
export function DuplicateSection({ lead, phone, leadHref }: { lead: AdminLeadCard; phone: boolean; leadHref: (id: string) => string }) {
  const { t } = useTranslation();
  const others = lead.previousLeads;
  // Dublikat lidda asosiy lid tepada ko'rsatilgan — boshqa lidlar bo'lmasa bo'lim takrorlanmaydi.
  if (lead.status === 'MERGED' && !others.length) return null;
  const title = lead.status === 'MERGED' && lead.mergedInto ? t('alk.d.merged', { id: lead.mergedInto.id }) : t('alk.d.none');
  return (
    <Section title={title} phone={phone}>
      {lead.status !== 'MERGED' ? <Hint icon={<GitMerge aria-hidden />}>{t('alk.d.noneText')}</Hint> : null}
      {others.length ? (
        <div className={styles.box}>
          <p className={styles.boxTitle}>{t(others.length > 1 ? 'alk.d.otherMany' : 'alk.d.other')}</p>
          <ul className={styles.others}>
            {others.map((item) => (
              <li key={item.id}>
                <div>
                  <div className={styles.otherHead}>
                    <Link to={leadHref(item.id)}>{item.id}</Link>
                    <span>{tashkentDay(item.createdAt)}</span>
                  </div>
                  <p className={styles.otherName}>{item.productName}</p>
                  <p className={styles.otherNote}>{t(item.productName === lead.product.name ? 'alk.d.sameProduct' : 'alk.d.otherProduct')}</p>
                </div>
                <div className={styles.otherStatus}>
                  <StatusBadge family="lead" code={item.status} />
                  {item.rejectReason ? <span>«{t(`opw.reject.${item.rejectReason}`)}»</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

/** Dublikat lid tepasida: «Bu lid» va «Asosiy lid» ustma-ust, pastda — haq kimga (admin-lid-karta L-1265). */
export function DuplicateNote({ lead, now, leadHref }: { lead: AdminLeadCard; now: number; leadHref: (id: string) => string }) {
  const { t } = useTranslation();
  const main = lead.mergedInto;
  if (lead.status !== 'MERGED' || !main) return null;
  const duplicateAttempt = lead.attemptLog?.find((attempt) => attempt.outcome === 'DUPLICATE');
  return (
    <div className={styles.dup}>
      <div className={styles.dupNote} role="note">
        <Info aria-hidden />
        <div>
          <p className={styles.dupTitle}>{t('alk.d.noteTitle', { id: main.id })}</p>
          <p>{t('alk.d.noteText', { date: tashkentDay(main.createdAt).slice(0, 5) })}</p>
          <Link to={leadHref(main.id)} className={styles.textButton}>{t('alk.a.openMain')}</Link>
        </div>
      </div>
      <div className={styles.dupCards}>
        <DupCard label={t('alk.d.this')} id={lead.id} name={lead.customerName} status={lead.status} rows={[
          [t('alk.m.arrived'), relativeDay(lead.createdAt, t, now)],
          [t('alk.d.page'), <>{lead.affiliateName ?? '—'} <span className={styles.code}>{lead.stream?.code ?? '—'}</span></>],
          [t('alk.d.result'), duplicateAttempt ? `«${t('opw.outcome.DUPLICATE')}» · ${duplicateAttempt.operatorName}` : '—'],
        ]} />
        <span className={styles.dupArrow} aria-hidden><ArrowRight /></span>
        <DupCard label={t('alk.d.main')} id={main.id} name={lead.customerName} status={main.status} rows={[
          [t('alk.m.arrived'), relativeDay(main.createdAt, t, now)],
          [t('alk.d.page'), <>{main.affiliateName ?? '—'} <span className={styles.code}>{main.streamCode ?? '—'}</span></>],
          [t('alk.d.mainNow'), main.attemptsCount !== undefined ? t('alk.d.mainNowValue', { count: main.attemptsCount, operator: main.operatorName ?? '—' }) : '—'],
        ]} />
      </div>
      <div className={styles.dupHints}>
        <Hint icon={<UserRound aria-hidden />}>{t('alk.d.owner1', { name: main.affiliateName ?? '—' })}</Hint>
        <Hint icon={<ChartColumn aria-hidden />}>{t('alk.d.owner2', { name: lead.affiliateName ?? '—', id: lead.id })}</Hint>
      </div>
    </div>
  );
}

function DupCard({ label, id, name, status, rows }: { label: string; id: string; name: string; status: LeadStatus; rows: Array<[string, ReactNode]> }) {
  return (
    <div className={styles.dupCard}>
      <div className={styles.dupCardHead}>
        <span>{label}</span>
        <StatusBadge family="lead" code={status} />
      </div>
      <p className={styles.dupCardId}>{id} · {name}</p>
      <dl>
        {rows.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}
      </dl>
    </div>
  );
}

// ── Buyurtma ─────────────────────────────────────────────────────────────────

export function OrderSection({ lead, phone, now, orderHref }: { lead: AdminLeadCard; phone: boolean; now: number; orderHref: (id: string) => string }) {
  const { t } = useTranslation();
  const open = lead.status === 'NEW' || lead.status === 'BOOKED' || lead.status === 'CALLBACK';
  const price = lead.price;
  if (lead.order) {
    const link = <Link to={orderHref(lead.order.id)} className={styles.link}>{t('alk.o.open')}<ChevronRight aria-hidden /></Link>;
    return (
      <Section title={t('alk.o.title', { id: lead.order.id })} link={link} phone={phone}>
        <Facts width={170} rows={[
          { label: t('alk.o.status'), value: <StatusBadge family="order" code={lead.order.status} /> },
          { label: t('alk.o.created'), value: relativeDay(lead.order.createdAt, t, now) },
          { label: t('alk.o.total'), value: sum(t, lead.order.totalAmount) },
        ]} />
      </Section>
    );
  }
  return (
    <Section title={t(open ? 'alk.o.none' : 'alk.o.closed')} phone={phone}>
      <p className={styles.text}>{t(open ? 'alk.o.noneText' : 'alk.o.closedText')}</p>
      {open && price ? (
        <div className={styles.box}>
          <p className={styles.boxTitle}>{t('alk.o.sum')}</p>
          <Facts width={170} rows={[
            { label: t('alk.o.goods'), value: sum(t, price.subtotal) },
            { label: t('alk.o.delivery', { where: t(`opw.whereDeliver.${price.whereDeliver}`) }), value: sum(t, price.deliveryFee) },
            { label: t('alk.o.total'), value: sum(t, price.totalAmount) },
          ]} />
        </div>
      ) : null}
    </Section>
  );
}
