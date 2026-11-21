import { useQueryClient } from '@tanstack/react-query';
import { App, Skeleton } from 'antd';
import { ArrowRight, ChevronRight, CircleX, Coffee, Headset, Inbox, Power, Timer } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { OperatorLead } from '../../features/operator/api/operatorApi';
import {
  DEFAULT_MAX_BOOKINGS,
  operatorKeys,
  useConfirmOrderMutation,
  useLeadCardQuery,
  useOperatorAttemptsQuery,
  useOperatorLeadsQuery,
  useOperatorStateMutation,
  useOperatorStateQuery,
  useOperatorStatsQuery,
  useQueueSummaryQuery,
  useSubmitLeadResultMutation,
  useTakeNextLeadMutation,
} from '../../features/operator/api/operatorQueries';
import { clock, durationLabel, outcomeLabel, rejectLabel, statusLabel } from '../../features/operator/lib/leadFormat';
import { isNoAnswer } from '../../features/operator/lib/leadRules';
import { useNow } from '../../shared/lib/useNow';
import type { LeadResultAccepted, LeadResultInput, LeadStatus, OperatorAttemptItem } from '../../features/operator/model/operatorTypes';
import { getApiErrorCode, getApiErrorMessage, getApiRequestId } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDate, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { ActiveLead } from './ActiveLead';
import { HelpDialog } from './HelpDialog';
import { QueueColumn } from './QueueColumn';
import type { OrderDraft } from './ResultPanel';
import { confirmBlocked, RESULT_TILES, type DialogChoice, type ResultChoice } from './resultChoices';
import styles from './OperatorWorkspace.module.css';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';

/** Ochiq lid sahifadan chiqib qaytganda ham ochiq turadi — natijasiz yopilmaydi. */
const ACTIVE_KEY = 'elchi.operator.activeLead';
const readActive = () => {
  try { return window.sessionStorage.getItem(ACTIVE_KEY); } catch { return null; }
};
const storeActive = (id: string | null) => {
  try {
    if (id) window.sessionStorage.setItem(ACTIVE_KEY, id);
    else window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch { /* xususiy oyna — faqat xotirada */ }
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** «Bugungi urinishlarim» — natija ustuni: urinish natijasi qaysi holatga olib kelgan. */
const ATTEMPT_STATUS: Record<OperatorAttemptItem['outcome'], LeadStatus> = {
  CONFIRMED: 'CONFIRMED', REJECTED: 'REJECTED', INVALID: 'INVALID', DUPLICATE: 'MERGED',
  CALL_LATER: 'CALLBACK', THINKING: 'CALLBACK', NO_ANSWER: 'CALLBACK', BUSY: 'CALLBACK', PHONE_OFF: 'CALLBACK',
};

/**
 * Operator «Ish joyi» (FE-08; operator-bosh, operator-lid-kartasi, operator-natija): navbat paneli,
 * lid kartasi va «Natija va buyurtma», pastda summa qatori. «Keyingi lid» javobi kartani darhol
 * ochadi (OPR-2: 1 soniyada); natijasiz lid yopilmaydi.
 */
export default function OperatorHomePage() {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const queryClient = useQueryClient();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const today = tashkentDate(now);

  const stateQuery = useOperatorStateQuery();
  const stateMutation = useOperatorStateMutation();
  const leads = useOperatorLeadsQuery();
  const queue = useQueueSummaryQuery();
  const stats = useOperatorStatsQuery(today, today);
  const attempts = useOperatorAttemptsQuery(today, today);
  const takeNext = useTakeNextLeadMutation();
  const submitResult = useSubmitLeadResultMutation();
  const confirmOrder = useConfirmOrderMutation();

  // `since` — tanlangan vaqt: undan oldingi ro'yxat javobi «lid yo'q» deb hisoblanmaydi.
  const [active, setActive] = useState<{ id: string | null; since: number }>(() => ({ id: readActive(), since: 0 }));
  const activeId = active.id;
  const [selected, setSelected] = useState<'CONFIRMED' | 'NO_ANSWER' | null>(null);
  const [dialog, setDialog] = useState<DialogChoice | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<{ at: number; requestId: string | null } | null>(null);
  const warned = useRef<string | null>(null);
  const expired = useRef<string | null>(null);
  const primaryRef = useRef<(() => void) | null>(null);

  const card = useLeadCardQuery(activeId);
  const bookedLeftRaw = card.data?.id === activeId && card.data?.bookedUntil ? Date.parse(card.data.bookedUntil) - now : null;
  // Lid endi bu operatorda emas: bron tugagan, server 404 qaytargan yoki ro'yxatdan chiqqan (boshqa tab).
  const gone = Boolean(activeId) && (
    (card.isError && getApiErrorCode(card.error) === 'NOT_FOUND')
    || (bookedLeftRaw !== null && bookedLeftRaw <= 0)
    || (leads.data !== undefined && leads.dataUpdatedAt >= active.since && !leads.data.some((lead) => lead.id === activeId))
  );
  const activeCard = activeId && !gone && card.data?.id === activeId ? card.data : null;
  const state = stateQuery.data?.state ?? 'OFFLINE';
  const max = stateQuery.data?.maxBookings ?? DEFAULT_MAX_BOOKINGS;
  const mine = leads.data ?? [];
  const bookings = mine.filter((lead) => lead.status === 'BOOKED').sort((a, b) => (a.bookedUntil ?? '').localeCompare(b.bookedUntil ?? ''));
  const callbacks = mine
    .filter((lead): lead is OperatorLead & { callbackAt: string } => lead.status === 'CALLBACK' && Boolean(lead.callbackAt))
    .sort((a, b) => a.callbackAt.localeCompare(b.callbackAt));
  const saving = submitResult.isPending || confirmOrder.isPending;

  const resetConfirm = confirmOrder.reset;
  const setActiveId = useCallback((id: string | null) => {
    storeActive(id);
    setActive({ id, since: Date.now() });
    setSelected(null);
    setDialog(null);
    setProductOpen(false);
    setResultError(null);
    resetConfirm();
  }, [resetConfirm]);

  // Ochiq lid yo'qoldi: bron tugadi yoki lid boshqa joyda yopildi — karta yopiladi, bir marta xabar.
  const goneLead = gone && card.data?.id === activeId ? card.data : null;
  useEffect(() => {
    if (!gone || !activeId || expired.current === activeId) return;
    expired.current = activeId;
    storeActive(null);
    void queryClient.invalidateQueries({ queryKey: operatorKeys.leads });
    const label = goneLead ? `${goneLead.id} · ${goneLead.customerName}. ` : '';
    notification.warning({ title: t(bookedLeftRaw !== null && bookedLeftRaw <= 0 ? 'opw.bookingEnded' : 'opw.cardGone'), description: `${label}${t('opw.bookingEndedText')}`, placement: 'bottomRight', duration: 6 });
  }, [activeId, bookedLeftRaw, gone, goneLead, notification, queryClient, t]);

  // Bron tugashiga 1 daqiqa qolganda ogohlantirish (operator-lid-kartasi 1).
  useEffect(() => {
    if (!activeCard || bookedLeftRaw === null || bookedLeftRaw > 60_000 || warned.current === activeCard.id) return;
    warned.current = activeCard.id;
    notification.warning({ title: t('opw.bookingMinuteLeft'), description: t('opw.bookingMinuteLeftText', { lead: `${activeCard.id} · ${activeCard.customerName}` }), placement: 'bottomRight', duration: 6 });
  }, [activeCard, bookedLeftRaw, notification, t]);

  // Sahifani yopish ogohlantirishi (operator-karkas 5): ochiq lid bor bo'lsa brauzer so'raydi.
  useEffect(() => {
    if (!activeCard) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = t('opw.leaveWarning');
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [activeCard, t]);

  const goOnline = () => stateMutation.mutate('ONLINE', { onError: (error) => void message.error(`${t('operator.stateFailed')}: ${getApiErrorMessage(error)}`) });

  const leastLeft = bookings[0];
  let blockedReason: string | null = null;
  if (state === 'OFFLINE') blockedReason = t('opw.reasonOffline');
  else if (state === 'BREAK') blockedReason = t('opw.reasonBreak');
  else if (bookings.length >= max) blockedReason = t('opw.reasonLimit', { max });
  else if (queue.data && queue.data.newLeads + queue.data.dueCallbacks === 0) blockedReason = t('opw.reasonEmpty');

  const requireResultFirst = () => {
    void message.warning(t('opw.reasonFirstResult'));
    document.getElementById('lead-result')?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  };

  const onNext = () => {
    if (takeNext.isPending) return;
    if (activeCard) return requireResultFirst();
    if (blockedReason) return;
    setNextError(null);
    takeNext.mutate(undefined, {
      onSuccess: (lead) => setActiveId(lead.id),
      onError: (error) => {
        const code = getApiErrorCode(error);
        if (code === 'OPERATOR_ON_BREAK' || code === 'OPERATOR_OFFLINE' || code === 'BOOKING_LIMIT_REACHED' || code === 'LEAD_QUEUE_EMPTY') {
          void queryClient.invalidateQueries({ queryKey: operatorKeys.all });
          void message.info(getApiErrorMessage(error));
          return;
        }
        setNextError({ at: Date.now(), requestId: getApiRequestId(error) });
      },
    });
  };

  const onOpen = (id: string) => {
    if (id === activeId) return;
    if (activeCard) return requireResultFirst();
    setActiveId(id);
  };

  const savedToast = (result: LeadResultAccepted, outcome: LeadResultInput['outcome']) => {
    const lead = activeCard ? `${activeCard.id} · ${activeCard.customerName}` : result.leadId;
    let title = t('opw.saved');
    let description: string;
    if (result.status === 'NO_CONTACT') {
      title = t('opw.savedClosed');
      description = t('opw.savedNoContact', { lead });
    } else if (result.status === 'CALLBACK' && result.nextAttemptAt) {
      description = isNoAnswer(outcome)
        ? t('opw.savedRetry', { lead, time: tashkentDateTime(result.nextAttemptAt) })
        : t('opw.savedCallback', { lead, time: tashkentDateTime(result.nextAttemptAt) });
    } else if (result.status === 'CONFIRMED') {
      description = t('opw.savedOrder', { lead, order: '' });
    } else {
      description = t('opw.savedStatus', { lead, status: statusLabel(result.status, t) });
    }
    notification.success({ title, description, placement: 'bottomRight', duration: 4 });
  };

  const onResultError = (error: unknown, inDialog: boolean) => {
    if (getApiErrorCode(error) === 'NOT_FOUND') {
      setActiveId(null);
      void queryClient.invalidateQueries({ queryKey: operatorKeys.leads });
      notification.warning({ title: t('opw.cardGone'), description: t('opw.cardGoneText'), placement: 'bottomRight' });
      return;
    }
    setResultError(getApiErrorMessage(error));
    if (!inDialog) notification.error({ title: t('opw.saveFailed'), description: t('opw.saveFailedText'), placement: 'bottomRight' });
  };

  const onSubmit = (input: LeadResultInput) => {
    if (!activeCard) return;
    setResultError(null);
    const inDialog = dialog !== null;
    submitResult.mutate({ id: activeCard.id, input }, {
      onSuccess: (result) => {
        savedToast(result, input.outcome);
        setActiveId(null);
      },
      onError: (error) => onResultError(error, inDialog),
    });
  };

  const onConfirmOrder = (draft: OrderDraft) => {
    if (!activeCard || confirmBlocked(activeCard)) return;
    setResultError(null);
    confirmOrder.mutate({ card: activeCard, comment: draft.comment, quantity: draft.quantity, whereDeliver: draft.whereDeliver }, {
      onSuccess: (result) => {
        savedToast(result, 'CONFIRMED');
        setActiveId(null);
      },
      onError: (error) => onResultError(error, false),
    });
  };

  const choose = (choice: ResultChoice) => {
    if (!activeCard || saving) return;
    setResultError(null);
    if (choice === 'CONFIRMED') {
      if (!confirmBlocked(activeCard) && selected !== 'NO_ANSWER') setSelected('CONFIRMED');
      return;
    }
    if (choice === 'NO_ANSWER') {
      setSelected((current) => (current === 'NO_ANSWER' ? null : 'NO_ANSWER'));
      return;
    }
    if (selected === 'NO_ANSWER') return;
    setDialog(choice);
  };

  // Tezkor tugmalar (operator-yordam): F2, Alt + 1…7, Ctrl+Enter, «?». Matn yozilayotganda faqat F2 va Ctrl+Enter.
  const modalOpen = dialog !== null || helpOpen;
  const hotkeys = useRef({ onNext, choose, modalOpen });
  useLayoutEffect(() => {
    hotkeys.current = { onNext, choose, modalOpen };
  });
  useEffect(() => {
    if (phone) return;
    const onKey = (event: KeyboardEvent) => {
      if (hotkeys.current.modalOpen || event.defaultPrevented) return;
      if (event.key === 'F2') {
        event.preventDefault();
        hotkeys.current.onNext();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        primaryRef.current?.();
        return;
      }
      if (isTyping(event.target)) return;
      if (event.altKey && /^Digit[1-7]$/.test(event.code)) {
        const tile = RESULT_TILES.find((item) => item.key === Number(event.code.slice(5)));
        if (tile) {
          event.preventDefault();
          hotkeys.current.choose(tile.choice);
        }
      } else if (event.key === '?' && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone]);

  if (phone) {
    // Telefonda ish joyi ochilmaydi (karkas «Faqat kompyuterda»), faqat bugungi statistika.
    return (
      <section className={styles.panel} aria-labelledby="operator-today-title">
        <div className={styles.today}>
          <div className={styles.todayHead}><h2 id="operator-today-title">{t('opw.todayTitle')}</h2></div>
          <dl className={styles.todayList}>
            <div><dt>{t('opw.attempts')}</dt><dd>{stats.data?.attempts ?? '—'}</dd></div>
            <div><dt>{t('opw.confirmed')}</dt><dd>{stats.data?.confirmed ?? '—'}</dd></div>
          </dl>
        </div>
      </section>
    );
  }

  const queueColumn = (
    <QueueColumn
      bookings={bookings}
      callbacks={callbacks}
      max={max}
      activeId={activeCard?.id ?? null}
      queue={queue.data}
      stats={stats.data}
      blockedReason={blockedReason}
      nextPending={takeNext.isPending}
      nextFailed={nextError !== null}
      onNext={onNext}
      onOpen={onOpen}
    />
  );

  if (activeCard) {
    return (
      <>
        <ActiveLead
          key={activeCard.id}
          card={activeCard}
          queue={queueColumn}
          selected={selected}
          dialog={dialog}
          productOpen={productOpen}
          saving={saving}
          error={resultError}
          onChoose={choose}
          onCloseDialog={() => { setDialog(null); setResultError(null); }}
          onProductOpen={setProductOpen}
          onHelp={() => setHelpOpen(true)}
          onSubmit={onSubmit}
          onConfirmOrder={onConfirmOrder}
          primaryRef={primaryRef}
        />
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </>
    );
  }

  const emptyQueue = queue.data !== undefined && queue.data.newLeads + queue.data.dueCallbacks === 0;
  let stateBlock: ReactNode;
  let withAttempts = false;
  if (activeId && card.isPending) {
    stateBlock = <div className={styles.state} aria-busy="true" aria-label={t('opw.cardLoading')}><Skeleton active title paragraph={{ rows: 6 }} /></div>;
  } else if (state === 'OFFLINE') {
    stateBlock = (
      <StateBlock icon={<Power />} title={t('opw.offlineTitle')} text={t('opw.offlineText')}>
        <button type="button" className={styles.primaryButton} disabled={stateMutation.isPending} onClick={goOnline}><Power aria-hidden />{t('opw.goOnline')}</button>
      </StateBlock>
    );
  } else if (state === 'BREAK') {
    const since = stateQuery.data?.since ? Date.parse(stateQuery.data.since) : null;
    stateBlock = (
      <StateBlock
        icon={<Coffee />}
        tone="warning"
        title={since ? t('opw.breakTitleSince', { minutes: Math.max(0, Math.floor((now - since) / 60_000)) }) : t('opw.breakTitle')}
        text={`${since ? `${t('opw.breakSince', { time: clock(since) })} ` : ''}${t('opw.breakText')}`}
      >
        <button type="button" className={styles.primaryButton} disabled={stateMutation.isPending} onClick={goOnline}><Power aria-hidden />{t('opw.backToWork')}</button>
      </StateBlock>
    );
  } else if (bookings.length >= max && leastLeft) {
    const label = `${leastLeft.id} · ${leastLeft.customerName}`;
    stateBlock = (
      <StateBlock
        icon={<Timer />}
        tone="warning"
        title={t('opw.limitTitle', { count: bookings.length })}
        text={t('opw.limitText', { max, lead: label, time: durationLabel(Math.max(0, Date.parse(leastLeft.bookedUntil ?? '') - now), t) })}
      >
        <button type="button" className={styles.primaryButton} onClick={() => onOpen(leastLeft.id)}><ArrowRight aria-hidden />{t('opw.openLead', { lead: label })}</button>
      </StateBlock>
    );
  } else if (emptyQueue) {
    withAttempts = true;
    stateBlock = <StateBlock icon={<Inbox />} title={t('opw.emptyTitle')} text={t('opw.emptyText')} />;
  } else {
    withAttempts = true;
    stateBlock = (
      <StateBlock icon={<Headset />} title={t('opw.idleTitle')} text={<>{t('opw.idleTextBefore')} <kbd className={styles.kbd}>F2</kbd> {t('opw.idleTextAfter')}</>} />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.workspace} data-active="idle">
        {queueColumn}
        <section className={`${styles.panel} ${styles.idle}`} aria-label={t('opw.idleTitle')}>
          {nextError ? (
            <div className={styles.errorBox} role="alert">
              <CircleX aria-hidden />
              <div>
                <strong>{t('opw.nextFailedTitle')}</strong>
                <p>{t('opw.nextFailedText')}</p>
                <small>{t('opw.errorNumber', { code: nextError.requestId ?? '—', time: clock(nextError.at) })}</small>
              </div>
            </div>
          ) : null}
          {stateBlock}
          {withAttempts ? <TodayAttempts items={attempts.data?.items} total={attempts.data?.total} /> : null}
        </section>
      </div>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function StateBlock({ icon, tone, title, text, children }: { icon: ReactNode; tone?: 'warning'; title: string; text: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon} data-tone={tone} aria-hidden>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}

/** «Bugungi urinishlarim · oxirgi 10 tasi, jami N» (operator-bosh). Yozuvlarni tinglash — FE-10. */
function TodayAttempts({ items, total }: { items: OperatorAttemptItem[] | undefined; total: number | undefined }) {
  const { t } = useTranslation();
  if (!items) return null;
  return (
    <>
      <div className={styles.idleDivider} />
      <div className={styles.attemptsSection}>
        <div className={styles.sectionHead}>
          <h2>{t('opw.todayAttempts')} <span>{t('opw.todayAttemptsCount', { total: total ?? items.length })}</span></h2>
          <Link to="/operator/calls" className={styles.textLink}>{t('opw.myCalls')}<ChevronRight size={16} aria-hidden /></Link>
        </div>
        {items.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>{t('opw.todayAttemptsCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('opw.col.time')}</th>
                  <th scope="col">{t('opw.col.lead')}</th>
                  <th scope="col">{t('opw.col.customer')}</th>
                  <th scope="col">{t('opw.col.result')}</th>
                  <th scope="col" className={styles.numeric}>{t('opw.col.talk')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  let detail: string | null = null;
                  if (item.outcome === 'REJECTED' && item.rejectReason) detail = `«${rejectLabel(item.rejectReason, t)}»`;
                  else if ((item.outcome === 'CALL_LATER' || item.outcome === 'THINKING') && item.nextAttemptAt) {
                    const when = tashkentDate(Date.parse(item.nextAttemptAt)) === tashkentDate() ? clock(item.nextAttemptAt) : `${t('opw.tomorrowLower')} ${clock(item.nextAttemptAt)}`;
                    detail = `«${outcomeLabel(item.outcome, t)}» · ${when}`;
                  } else if (isNoAnswer(item.outcome)) detail = `${outcomeLabel(item.outcome, t)}${item.nextAttemptAt ? ` · ${clock(item.nextAttemptAt)}` : ''}`;
                  return (
                    <tr key={`${item.leadId}-${item.at}-${index}`}>
                      <td className={styles.cellTime}>{clock(item.at)}</td>
                      <td className={styles.cellStrong}>{item.leadId}</td>
                      <td><span className={styles.cellStrong}>{item.customerName}</span><span className={styles.cellSub}>{item.productName}</span></td>
                      <td><span className={styles.cellResult}><StatusBadge family="lead" code={ATTEMPT_STATUS[item.outcome]} titlePrefix={t('opw.statusTitle')} />{detail ? <span>{detail}</span> : null}</span></td>
                      <td className={styles.numeric}>{item.durationSeconds != null ? `${String(Math.floor(item.durationSeconds / 60)).padStart(2, '0')}:${String(item.durationSeconds % 60).padStart(2, '0')}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyBox}>{t('opw.todayAttemptsEmpty')}</p>
        )}
      </div>
    </>
  );
}
