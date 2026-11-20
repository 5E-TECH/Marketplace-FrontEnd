import { Skeleton } from 'antd';
import { Bell, CalendarClock, Clock, Headset } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OperatorLead } from '../../features/operator/api/operatorApi';
import { useOperatorLeadsQuery } from '../../features/operator/api/operatorQueries';
import { clock, dayLabel, durationLabel, outcomeLabel } from '../../features/operator/lib/leadFormat';
import { REMINDER_MINUTES } from '../../features/operator/lib/leadRules';
import { useNow } from '../../features/operator/lib/useNow';
import { notificationPermission } from '../../features/operator/ui/useCallbackReminders';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { addDays, tashkentDate } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import styles from './OperatorCallbacksPage.module.css';
import { Badge } from '../../shared/ui/Badge/Badge';

type Scheduled = OperatorLead & { callbackAt: string };
const MINUTE = 60_000;
const WEEKDAYS: readonly TranslationKey[] = ['opw.weekday.0', 'opw.weekday.1', 'opw.weekday.2', 'opw.weekday.3', 'opw.weekday.4', 'opw.weekday.5', 'opw.weekday.6'];

/**
 * «Rejalashtirilgan qo'ng'iroqlar» (operator-rejalashtirilgan): eng yaqin qo'ng'iroq kartasi, qoidalar
 * va kunlar bo'yicha jadval. Lid vaqtida «Keyingi lid» F2 orqali beriladi (4, 7, 8-qoidalar).
 */
export default function OperatorCallbacksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const now = useNow();
  const leads = useOperatorLeadsQuery();
  const [permission, setPermission] = useState(notificationPermission);

  if (leads.isError && !leads.data) {
    return <LoadError error={leads.error} onRetry={() => void leads.refetch()} lastSuccessAt={leads.dataUpdatedAt} />;
  }
  if (!leads.data) {
    return <section className={styles.card} aria-busy="true"><Skeleton active paragraph={{ rows: 6 }} /></section>;
  }

  const scheduled = leads.data
    .filter((lead): lead is Scheduled => lead.status === 'CALLBACK' && Boolean(lead.callbackAt))
    .sort((a, b) => a.callbackAt.localeCompare(b.callbackAt));
  const today = tashkentDate(now);
  const tomorrow = addDays(today, 1);
  const days = [...new Set(scheduled.map((lead) => tashkentDate(Date.parse(lead.callbackAt))))];
  const todayCount = scheduled.filter((lead) => tashkentDate(Date.parse(lead.callbackAt)) === today).length;
  const next = scheduled[0];
  const goWorkspace = () => void navigate('/operator');
  const weekday = (value: number) => t(WEEKDAYS[new Date(value + 5 * 3_600_000).getUTCDay()]);

  const enable = () => {
    if (permission !== 'default') return;
    void window.Notification.requestPermission().then(setPermission);
  };

  const stateOf = (lead: Scheduled) => {
    const at = Date.parse(lead.callbackAt);
    if (now >= at + MINUTE) return { tone: 'danger', main: t('opc.late', { minutes: Math.floor((now - at) / MINUTE) }), sub: null };
    if (now >= at) return { tone: 'warning', main: t('opc.dueNow'), sub: null };
    if (tashkentDate(at) === today) return { tone: undefined, main: t('opc.in', { time: durationLabel(at - now, t) }), sub: t('opc.reminderAt', { time: clock(at - REMINDER_MINUTES * MINUTE) }) };
    return { tone: undefined, main: t('opc.stateWaiting'), sub: null };
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        {next ? <NextCall lead={next} now={now} onGo={goWorkspace} /> : (
          <section className={`${styles.card} ${styles.next}`} aria-labelledby="callbacks-empty-title">
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden><CalendarClock /></span>
              <h2 id="callbacks-empty-title">{t('opc.emptyTitle')}</h2>
              <p>{t('opc.emptyText')}</p>
              <button type="button" className={styles.primary} onClick={goWorkspace}><Headset size={18} aria-hidden />{t('opc.goWorkspace')}</button>
            </div>
          </section>
        )}

        <section className={`${styles.card} ${styles.rulesCard}`} aria-labelledby="callbacks-rules-title">
          <h2 id="callbacks-rules-title">{t('opc.rules')}</h2>
          <dl className={styles.facts}>
            <dt>{t('opc.ruleReminder')}</dt><dd><strong>{t('opc.ruleReminderStrong')}</strong> {t('opc.ruleReminderRest')}</dd>
            <dt>{t('opc.ruleLate')}</dt><dd><strong>{t('opc.ruleLateStrong')}</strong> {t('opc.ruleLateRest')}</dd>
            <dt>{t('opc.ruleWindow')}</dt><dd><strong>09:00–21:00</strong>{t('opc.ruleWindowRest')}</dd>
            <dt>{t('opc.ruleBookings')}</dt><dd>{t('opc.ruleBookingsValue')}</dd>
            <dt>{t('opc.ruleNoTime')}</dt><dd>{t('opc.ruleNoTimeValue')}</dd>
          </dl>
          {permission === 'unsupported' ? null : (
            <p className={styles.notify}>
              <Bell size={18} aria-hidden />
              <span>
                <span className={styles.notifyTitle}><span className={styles.dot} data-state={permission} />{permission === 'granted' ? t('opc.notifyOn') : permission === 'denied' ? t('opc.notifyBlocked') : t('opc.notifyOff')}</span>
                <br />
                {permission === 'granted' ? t('opc.notifyOnText') : permission === 'denied' ? t('opc.notifyBlockedText') : t('opc.notifyOffText')}
              </span>
              {permission === 'default' ? <button type="button" className={styles.secondary} onClick={enable}>{t('opc.notifyEnable')}</button> : null}
            </p>
          )}
        </section>
      </div>

      {scheduled.length ? (
        <section className={styles.card} aria-labelledby="callbacks-list-title">
          <div className={styles.listHead}>
            <h2 id="callbacks-list-title">{t('opc.listTitle', { count: scheduled.length, today: todayCount })}</h2>
            <p>{t('opc.listText')}</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>{t('opc.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('opc.colTime')}</th>
                  <th scope="col">{t('opc.colCustomer')}</th>
                  <th scope="col">{t('opc.colProduct')}</th>
                  <th scope="col">{t('opc.colReason')}</th>
                  <th scope="col">{t('opc.colState')}</th>
                </tr>
              </thead>
              {days.map((day) => {
                const rows = scheduled.filter((lead) => tashkentDate(Date.parse(lead.callbackAt)) === day);
                const noon = Date.parse(`${day}T12:00:00+05:00`);
                const name = day === today ? t('opc.dayTodayName') : day === tomorrow ? t('opc.dayTomorrowName') : weekday(noon);
                return (
                  <tbody key={day}>
                    <tr className={styles.dayRow}>
                      <th colSpan={5} scope="rowgroup">{name} <span>· {dayLabel(noon)}{day === today || day === tomorrow ? `, ${weekday(noon)}` : ''} · {t('opc.dayCount', { count: rows.length })}</span></th>
                    </tr>
                    {rows.map((lead) => {
                      const state = stateOf(lead);
                      return (
                        <tr key={lead.id} data-next={lead.id === next?.id || undefined}>
                          <td><span className={styles.pill}>{clock(lead.callbackAt)}</span></td>
                          <td><span className={styles.stack}><span className={styles.strong}>{lead.customerName}</span><span>{lead.id}</span></span></td>
                          <td>{lead.productName}</td>
                          <td>
                            <span className={styles.stack}>
                              <span>{lead.lastOutcome ? outcomeLabel(lead.lastOutcome, t) : '—'}</span>
                              {lead.lastComment ? <span>«{lead.lastComment}»</span> : null}
                            </span>
                          </td>
                          <td>
                            <span className={styles.stack}>
                              <span className={styles.stateNear} data-tone={state.tone}>{state.main}</span>
                              {state.sub ? <span>{state.sub}</span> : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function NextCall({ lead, now, onGo }: { lead: Scheduled; now: number; onGo: () => void }) {
  const { t } = useTranslation();
  const at = Date.parse(lead.callbackAt);
  const late = now >= at + MINUTE;
  const due = now >= at && !late;
  const tomorrow = tashkentDate(at) !== tashkentDate(now);

  return (
    <section className={`${styles.card} ${styles.next}`} aria-labelledby="callbacks-next-title" data-testid="next-callback">
      <div className={styles.nextBody}>
        <div className={styles.nextTime}>
          <h2 id="callbacks-next-title">{tomorrow ? t('opc.nextTomorrowShort') : t('opc.next')}</h2>
          <span className={styles.bigTime}>{clock(at)}</span>
          <Badge tone={late ? 'danger' : due ? 'warning' : 'neutral'} icon={Clock}>
            {late ? t('opc.late', { minutes: Math.floor((now - at) / MINUTE) }) : due ? t('opc.dueNow') : tomorrow ? dayLabel(at) : t('opc.in', { time: durationLabel(at - now, t) })}
          </Badge>
        </div>
        <div className={styles.nextInfo}>
          <p>{lead.customerName} <span>· {lead.id}</span></p>
          <dl className={styles.facts}>
            <dt>{t('opw.product')}</dt><dd>{lead.productName}</dd>
            {lead.lastOutcome ? (
              <><dt>{t('opc.reason')}</dt><dd>{outcomeLabel(lead.lastOutcome, t)}{lead.lastAttemptAt ? <span className={styles.muted}> · {t('opc.talkAt', { time: clock(lead.lastAttemptAt) })}</span> : null}</dd></>
            ) : null}
            {lead.lastComment ? <><dt>{t('opw.comment')}</dt><dd>«{lead.lastComment}»</dd></> : null}
            <dt>{t('opc.reminderLabel')}</dt><dd><strong>{clock(at - REMINDER_MINUTES * MINUTE)}</strong> {t('opc.reminderBefore')}</dd>
          </dl>
        </div>
      </div>
      <div className={styles.nextFoot}>
        <p>{t('opc.firstInQueueBefore', { time: clock(at) })} <kbd className={styles.kbd}>F2</kbd> {t('opc.firstInQueueAfter')}</p>
        <button type="button" className={styles.primary} onClick={onGo}><Headset size={18} aria-hidden />{t('opc.goWorkspace')}</button>
      </div>
    </section>
  );
}
