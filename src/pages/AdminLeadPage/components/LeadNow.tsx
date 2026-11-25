import { Dropdown } from 'antd';
import { ArrowRightLeft, Check, Ellipsis, ExternalLink, Headphones, History, Info, Lock, LockOpen, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { withinDays } from '../../../features/adminLeads/lib/leadRows';
import type { AdminLeadCard } from '../../../features/adminLeads/model/adminLeadTypes';
import { rich } from '../../../shared/i18n/richText';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { tashkentClock, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { mmss, outcomeBadge, relativeDay } from '../model/leadView';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import record from '../../../shared/ui/RecordCard/RecordCard.module.css';
import own from '../AdminLeadPage.module.css';

const styles = { ...record, ...own };

export type LeadAction = 'transfer' | 'release' | 'reopen' | 'listen' | 'attempts' | 'sheet';

interface LeadNowProps {
  lead: AdminLeadCard;
  admin: boolean;
  phone: boolean;
  now: number;
  /** Buyurtma kartasi manzili (admin yoki nazoratchi). */
  orderHref: (id: string) => string;
  leadHref: (id: string) => string;
  onAction: (action: LeadAction) => void;
}

type Step = { label: string; sub: string | null; state: 'done' | 'current' | 'todo' };
type Metric = { label: string; value: ReactNode; note?: ReactNode };

const MAX_ATTEMPTS = 6;
const REOPEN_DAYS = 3;

/**
 * «Hozir» bloki (admin-lid-karta, 8 holat): nima bo'lyapti, kimda, keyingi qadam va mumkin bo'lgan amal; lid yo'li
 * (5 qadam) va 4 ko'rsatkich. Telefonda yo'l tik, ko'rsatkichlar 2 ustun, amallar ⋯ varag'ida va pastki panelda.
 */
export function LeadNow({ lead, admin, phone, now, orderHref, leadHref, onAction }: LeadNowProps) {
  const { t } = useTranslation();
  const operator = lead.operator?.name ?? lead.attempts.at(-1)?.operatorName ?? null;
  const lastAttempt = lead.attemptLog?.filter((attempt) => attempt.outcome !== 'IN_CALL').at(-1) ?? null;
  const callSeconds = lead.operator?.callStartedAt ? (now - Date.parse(lead.operator.callStartedAt)) / 1000 : null;
  const reopenOpen = lead.status === 'REJECTED' && (!lead.rejectedAt || withinDays(lead.rejectedAt, REOPEN_DAYS, now));
  const recording = [...(lead.attemptLog ?? [])].reverse().find((attempt) => attempt.recording === 'READY') ?? null;
  // Suhbat paytida joriy urinish ham sanaladi («1 / 6» — backend urinishni natija bilan yozadi).
  const attemptsValue = t('alk.m.attemptsValue', { count: lead.attemptsCount + (lead.status === 'BOOKED' && lead.operator?.inCall ? 1 : 0), max: MAX_ATTEMPTS });
  const autoClose: Metric = { label: t('alk.m.autoClose'), value: lead.closesAt ? tashkentDateTime(lead.closesAt) : '—', note: t('alk.m.autoCloseNote') };
  const arrived: Metric = { label: t('alk.m.arrived'), value: relativeDay(lead.createdAt, t, now) };
  const closer = lead.closedBy ?? (lastAttempt ? { name: lastAttempt.operatorName, at: lastAttempt.at } : null);
  const closerValue = closer ? `${closer.name} · ${relativeDay(closer.at, t, now)}` : '—';

  // ── Sarlavha va ko'rsatkichlar holatga qarab ──
  let title: string;
  let metrics: Metric[];
  switch (lead.status) {
    case 'BOOKED': {
      const until = lead.bookedUntil ? tashkentClock(Date.parse(lead.bookedUntil)) : '—';
      const left = lead.bookedUntil ? (Date.parse(lead.bookedUntil) - now) / 1000 : 0;
      title = t(lead.operator?.inCall ? 'alk.now.BOOKEDcall' : 'alk.now.BOOKED', { operator: operator ?? '—', time: until });
      metrics = [
        { label: t('alk.m.operator'), value: operator ?? '—', note: lead.operator ? operatorState(lead.operator, t) : null },
        {
          label: t('alk.m.booking'),
          value: left > 0 ? t('alk.m.left', { time: mmss(left) }) : t('alk.m.expired'),
          note: lead.bookedAt && lead.bookedUntil ? t('alk.m.bookingRange', { from: tashkentClock(Date.parse(lead.bookedAt)), to: until, minutes: Math.round((Date.parse(lead.bookedUntil) - Date.parse(lead.bookedAt)) / 60_000) }) : null,
        },
        { label: t('alk.m.attempts'), value: attemptsValue, note: t('alk.m.attemptsRule') },
        autoClose,
      ];
      break;
    }
    case 'CALLBACK': {
      const due = lead.nextAttemptAt ? Date.parse(lead.nextAttemptAt) : now;
      title = due > now ? t('alk.now.CALLBACK', { time: tashkentClock(due), operator: operator ?? '—' }) : t('alk.now.CALLBACKdue');
      metrics = [
        { label: t('alk.m.result'), value: lastAttempt ? outcomeBadge(lastAttempt.outcome, t).label : '—', note: lastAttempt ? [lastAttempt.comment, shortClock(lastAttempt.at), lastAttempt.durationSeconds ? mmss(lastAttempt.durationSeconds) : null].filter(Boolean).join(' · ') : null },
        { label: t('alk.m.attempts'), value: attemptsValue, note: t('alk.m.attemptsRule') },
        { label: t('alk.m.late'), value: t('alk.m.lateValue', { time: tashkentClock(due + 15 * 60_000) }) },
        autoClose,
      ];
      break;
    }
    case 'CONFIRMED': {
      const confirmer = lastAttempt?.outcome === 'CONFIRMED' ? lastAttempt : null;
      title = t('alk.now.CONFIRMED');
      metrics = [
        { label: t('alk.m.confirmedBy'), value: confirmer ? `${confirmer.operatorName} · ${tashkentClock(Date.parse(confirmer.at))}` : operator ?? '—' },
        { label: t('alk.m.order'), value: lead.order ? <span className={styles.metricOrder}><Link to={orderHref(lead.order.id)}>{lead.order.id}</Link><StatusBadge family="order" code={lead.order.status} /></span> : '—' },
        { label: t('alk.m.address'), value: lead.address ? `${lead.address.districtName} · ${t(`opw.whereDeliver.${lead.address.whereDeliver}`)}` : '—' },
        { label: t('alk.m.total'), value: lead.order ? t('al.sum', { amount: formatMoney(lead.order.totalAmount) }) : lead.price ? t('al.sum', { amount: formatMoney(lead.price.totalAmount) }) : '—' },
      ];
      break;
    }
    case 'REJECTED': {
      const days = lead.rejectedAt ? Math.floor((now - Date.parse(lead.rejectedAt)) / 86_400_000) : 0;
      title = reopenOpen ? t('alk.now.REJECTED') : t('alk.now.REJECTEDold', { days });
      metrics = [
        {
          label: t('alk.m.reason'),
          // Sabab: backend kodi, bo'lmasa tarixdagi yozuv («Kerak emas») yoki urinish izohi.
          value: lead.rejectReason ? `«${t(`opw.reject.${lead.rejectReason}`)}»` : [...lead.history].reverse().find((entry) => entry.toStatus === 'REJECTED')?.note ?? lastAttempt?.comment ?? '—',
        },
        { label: t('alk.m.who'), value: closer ? `${closer.name} · ${relativeDay(closer.at, t, now)}` : '—' },
        {
          label: t('alk.m.reopenUntil'),
          value: lead.rejectedAt ? (reopenOpen ? t('alk.m.reopenUntilValue', { date: tashkentDateTime(Date.parse(lead.rejectedAt) + REOPEN_DAYS * 86_400_000) }) : t('alk.m.reopenExpired')) : '—',
          note: admin ? null : t('alk.m.reopenAdmin'),
        },
        { label: t('alk.m.attempts'), value: attemptsValue },
      ];
      break;
    }
    case 'INVALID':
      title = t('alk.now.INVALID');
      metrics = [{ label: t('alk.m.who'), value: closerValue }, { label: t('alk.m.attempts'), value: attemptsValue }, { label: t('alk.m.seller'), value: t('alk.m.sellerInvalid') }, arrived];
      break;
    case 'MERGED': {
      const main = lead.mergedInto;
      title = t('alk.now.MERGED', { id: main?.id ?? '—' });
      metrics = [
        { label: t('alk.m.main'), value: main ? <Link to={leadHref(main.id)}>{main.id}</Link> : '—', note: main ? [relativeDay(main.createdAt, t, now), main.streamCode].filter(Boolean).join(' · ') : null },
        { label: t('alk.m.owner'), value: main?.affiliateName ?? '—' },
        { label: t('alk.m.who'), value: closerValue },
        arrived,
      ];
      break;
    }
    case 'NO_CONTACT': {
      const log = lead.attemptLog ?? [];
      const closed = lead.closedBy?.at ?? log.at(-1)?.at ?? null;
      title = t('alk.now.NO_CONTACT', { count: lead.attemptsCount, date: closed ? shortDate(closed) : '—' });
      metrics = [
        { label: t('alk.m.attempts'), value: log.length ? `${attemptsValue} · ${shortDate(log[0].at)}–${shortDate(log.at(-1)?.at ?? log[0].at)}` : attemptsValue },
        { label: t('alk.m.closed'), value: closed ? tashkentDateTime(closed) : '—' },
        { label: t('alk.m.again'), value: t('alk.m.againValue') },
        arrived,
      ];
      break;
    }
    case 'NEW':
    default: {
      const minutes = Math.max(1, Math.round((now - Date.parse(lead.createdAt)) / 60_000));
      title = lead.queuePosition ? t('alk.now.NEW', { position: lead.queuePosition, minutes }) : t('alk.now.NEWnoPos', { minutes });
      metrics = [
        { label: t('alk.m.arrived'), value: relativeDay(lead.createdAt, t, now), note: t('alk.m.waiting', { minutes }) },
        { label: t('alk.m.attempts'), value: attemptsValue, note: t('alk.m.attemptsRule') },
        { label: t('alk.m.operator'), value: t('alk.m.queueOperator') },
        autoClose,
      ];
    }
  }

  // ── Lid yo'li: ariza → bron → urinish → natija → buyurtma ──
  const open = lead.status === 'NEW' || lead.status === 'BOOKED' || lead.status === 'CALLBACK';
  const bookedStep = lead.history.find((entry) => entry.toStatus === 'BOOKED');
  const attemptNo = lead.attemptsCount + (lead.status === 'BOOKED' ? 1 : 0);
  const steps: Step[] = [
    { label: t('alk.step.arrived'), sub: t('alk.step.arrivedSub', { time: shortClock(lead.createdAt), stream: lead.stream?.code ?? '—' }), state: 'done' },
    {
      label: t('alk.step.booking'),
      sub: bookedStep ? `${shortClock(bookedStep.at)} · ${bookedStep.actor}` : lead.queuePosition ? t('alk.step.queue', { position: lead.queuePosition }) : t('alk.step.queueNo'),
      state: lead.status === 'NEW' ? 'current' : 'done',
    },
    {
      label: lead.status === 'BOOKED' ? t('alk.step.attempt', { n: attemptNo }) : t('alk.step.attempts'),
      sub: lead.status === 'BOOKED'
        ? callSeconds !== null ? t('alk.step.inCall', { time: mmss(callSeconds) }) : t('alk.step.waitingCall')
        : lead.attemptsCount ? t('alk.step.attemptsCount', { count: lead.attemptsCount }) : null,
      state: lead.status === 'NEW' ? 'todo' : lead.status === 'BOOKED' ? 'current' : 'done',
    },
    {
      label: t('alk.step.result'),
      sub: lead.status === 'BOOKED' && lead.bookedUntil ? t('alk.step.resultUntil', { time: tashkentClock(Date.parse(lead.bookedUntil)) })
        : lead.status === 'CALLBACK' && lead.nextAttemptAt ? t('alk.step.nextCall', { time: tashkentClock(Date.parse(lead.nextAttemptAt)) })
          : !open ? t(`status.lead.${lead.status}`) : null,
      state: open ? (lead.status === 'CALLBACK' ? 'current' : 'todo') : 'done',
    },
    {
      label: t('alk.step.order'),
      sub: lead.order ? lead.order.id : open ? t('alk.step.orderWill') : t('alk.step.orderNone'),
      state: lead.order ? 'done' : 'todo',
    },
  ];

  // ── Amallar: o'tkazish — admin va nazoratchi; bronni bo'shatish va qayta ochish — faqat admin ──
  const buttons: ReactNode[] = [];
  const button = (key: string, icon: ReactNode, label: string, onClick: () => void, disabled = false) => (
    <button key={key} type="button" className={styles.secondary} onClick={onClick} disabled={disabled}>{icon}{label}</button>
  );
  if (open) buttons.push(button('transfer', <ArrowRightLeft aria-hidden />, t('alk.a.transfer'), () => onAction('transfer')));
  if (lead.status === 'BOOKED' && admin) buttons.push(button('release', <LockOpen aria-hidden />, t('alk.a.release'), () => onAction('release')));
  if (lead.status === 'CONFIRMED' && lead.order) {
    buttons.push(<Link key="order" to={orderHref(lead.order.id)} className={styles.secondary}><ExternalLink aria-hidden />{t('alk.a.openOrder')}</Link>);
  }
  if ((lead.status === 'CONFIRMED' || lead.status === 'INVALID') && recording) buttons.push(button('listen', <Headphones aria-hidden />, t('alk.a.recording'), () => onAction('listen')));
  if (lead.status === 'REJECTED' && admin) buttons.push(button('reopen', <RotateCcw aria-hidden />, t('alk.a.reopen'), () => onAction('reopen'), !reopenOpen));
  if (lead.status === 'MERGED' && lead.mergedInto) buttons.push(<Link key="main" to={leadHref(lead.mergedInto.id)} className={styles.secondary}><ExternalLink aria-hidden />{t('alk.a.openMain')}</Link>);
  if (lead.status === 'NO_CONTACT') buttons.push(button('attempts', <History aria-hidden />, t('alk.a.attempts'), () => onAction('attempts')));

  const menuItems = [
    ...(admin && lead.status === 'BOOKED' ? [{ key: 'release', icon: <LockOpen aria-hidden />, label: t('alk.a.release') }] : []),
    ...(recording ? [{ key: 'listen', icon: <Headphones aria-hidden />, label: t('alk.a.listen') }] : []),
    ...(admin ? [{ key: 'reopen', icon: <RotateCcw aria-hidden />, label: t('alk.a.reopen'), disabled: !reopenOpen, title: reopenOpen ? undefined : t('alk.a.reopenHint') }] : []),
    ...(lead.attemptLog?.length ? [{ key: 'attempts', icon: <History aria-hidden />, label: t('alk.a.attempts') }] : []),
  ];

  const status = (
    <span className={styles.statusLine}>
      <StatusBadge family="lead" code={lead.status} />
      {lead.reopened ? <Badge tone="neutral" icon={RotateCcw}>{t('alk.reopened', { time: tashkentClock(Date.parse(lead.reopened.at)) })}</Badge> : null}
    </span>
  );
  const subline = (
    <p className={styles.nowSub}>
      {rich(t('alk.sub', { name: lead.customerName, product: lead.product.name, affiliate: lead.affiliateName ?? lead.stream?.affiliateName ?? '—', date: tashkentDateTime(lead.createdAt) }), { stream: <strong>{lead.stream?.code ?? '—'}</strong> })}
    </p>
  );

  return (
    <section className={styles.now} aria-labelledby="lead-now" data-testid="lead-now">
      {phone ? (
        <>
          <div className={styles.nowPhoneTop}>
            {status}
            {menuItems.length ? (
              <button type="button" className={styles.iconButtonOutline} aria-label={t('al.rowActions', { id: lead.id })} onClick={() => onAction('sheet')}>
                <Ellipsis aria-hidden />
              </button>
            ) : null}
          </div>
          <h2 id="lead-now" className={styles.nowTitle}>{title}</h2>
          {subline}
        </>
      ) : (
        <div className={styles.nowHead}>
          <div className={styles.nowTitleRow}>
            {status}
            <h2 id="lead-now" className={styles.nowTitle}>{title}</h2>
          </div>
          <div className={styles.nowSubRow}>
            {subline}
            <div className={styles.nowActions}>
              {buttons}
              {menuItems.length ? (
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  rootClassName={rowMenu.root}
                  menu={{ items: menuItems, onClick: ({ key }) => window.setTimeout(() => onAction(key as LeadAction)) }}
                >
                  <button type="button" className={styles.iconButtonOutline} aria-label={t('alk.a.more')}>
                    <Ellipsis aria-hidden />
                  </button>
                </Dropdown>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ol className={styles.path} aria-label={t('alk.path')}>
        {steps.map((step, index) => (
          <li key={index} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className={styles.pathMark}>
              <span className={styles.pathDot}>{step.state === 'done' ? <Check aria-hidden /> : phone ? null : index + 1}</span>
              {index < steps.length - 1 ? <span className={styles.pathLine} data-done={step.state === 'done' || undefined} /> : null}
            </span>
            <span className={styles.pathText}>
              <span>{step.label}</span>
              {step.sub ? <span>{step.sub}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <dl className={styles.metrics}>
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            {metric.note ? <dd>{metric.note}</dd> : null}
          </div>
        ))}
      </dl>

      {lead.status === 'REJECTED' && admin && !reopenOpen ? <p className={styles.hint}><Info aria-hidden />{t('alk.a.reopenOld')}</p> : null}
      {!admin ? <p className={styles.hint}><Lock aria-hidden />{t('alk.supNote')}</p> : null}
    </section>
  );
}

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «Onlayn · 13:15 dan». */
function operatorState(operator: NonNullable<AdminLeadCard['operator']>, t: T) {
  const label = t(operator.state === 'ONLINE' ? 'operator.online' : operator.state === 'BREAK' ? 'operator.break' : 'operator.offline');
  return operator.since ? t('alk.m.operatorState', { state: label, time: tashkentClock(Date.parse(operator.since)) }) : label;
}

const shortClock = (value: string) => tashkentClock(Date.parse(value));
/** «13.01». */
const shortDate = (value: string) => tashkentDay(value).slice(0, 5);
