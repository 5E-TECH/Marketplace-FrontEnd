import { App } from 'antd';
import { ArrowRightLeft, ChevronDown, CircleAlert, Info, Lock, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { initials } from '../../../shared/lib/initials';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { useNow } from '../../../shared/lib/useNow';
import { RadioDot } from '../../../shared/ui/CheckBox/CheckBox';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useTransferLeadsMutation, useTransferOperatorsQuery } from '../api/adminLeadsQueries';
import { isScheduledCall } from '../lib/leadRows';
import type { AdminLeadListItem, OperatorActivity, TransferOperator } from '../model/adminLeadTypes';
import styles from './LeadDialogs.module.css';

type TransferLead = Pick<AdminLeadListItem, 'id' | 'customerName' | 'productName' | 'streamCode' | 'status' | 'operatorId' | 'operatorName' | 'callbackAt' | 'createdAt' | 'queuePosition'> & {
  /** Lid kartasidan: bron tugash vaqti va operator suhbati («bron 08:18 qoldi · suhbat 01:12»). */
  bookedUntil?: string | null;
  callStartedAt?: string | null;
};

interface TransferDialogProps {
  leads: readonly TransferLead[];
  onClose: () => void;
  /** O'tkazilganlar (tanlovdan olib tashlash uchun). */
  onDone?: (moved: string[]) => void;
  /** Bitta lid ham operatorlar kartochkalari bilan (admin-lid-karta «O'tkazish — lid bronda»). */
  cards?: boolean;
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const since = (value: string | null | undefined, now: number) => (value ? Math.max(0, Math.floor((now - Date.parse(value)) / 1000)) : 0);

/**
 * «Boshqa operatorga o'tkazish» (admin-lidlar, admin-lid-karta; BE-42): faqat onlayn operatorga. Bir nechta lid —
 * operatorlar kartochkalari (bronlar, rejalashtirilgan, hozir nima qilyapti) va «O'tkazilgandan keyin»; bitta lid —
 * tanlov ro'yxati. Lid operator broniga tushadi (chegara 5); vaqti kelmagan qo'ng'iroq bronga kirmaydi.
 */
export function TransferDialog({ leads, onClose, onDone, cards = false }: TransferDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const commentId = useId();
  const selectId = useId();
  const errorId = useId();
  const operatorsQuery = useTransferOperatorsQuery(true);
  const transfer = useTransferLeadsMutation();
  const [operatorId, setOperatorId] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const many = leads.length > 1 || cards;
  const scheduled = leads.filter((lead) => isScheduledCall(lead, now));
  const bookingCount = leads.length - scheduled.length;
  const owners = new Set(leads.map((lead) => lead.operatorId ?? ''));
  const owner = owners.size === 1 && leads[0].operatorId ? leads[0].operatorName : null;
  const inCall = leads.length === 1 && leads[0].status === 'BOOKED' && leads[0].callStartedAt ? leads[0].operatorName : null;
  // Bron egalari: o'tkazilsa ularning bronlari kamayadi («Dilnoza R. — bronlar 1/5 → 0/5»).
  const sources = [...new Set(leads.filter((lead) => lead.status === 'BOOKED' && lead.operatorId).map((lead) => lead.operatorId ?? ''))]
    .map((id) => ({ operator: (operatorsQuery.data ?? []).find((item) => item.id === id), count: leads.filter((lead) => lead.status === 'BOOKED' && lead.operatorId === id).length }))
    .filter((item): item is { operator: TransferOperator; count: number } => Boolean(item.operator));

  // Hamma lid allaqachon shu operatorda bo'lsa — ro'yxatda chiqmaydi; ko'p bronli tepada emas, kamroq yuklangan tepada.
  const operators = (operatorsQuery.data ?? [])
    .filter((item) => !(owners.size === 1 && owners.has(item.id)))
    .sort((a, b) => a.activeBookings - b.activeBookings || a.name.localeCompare(b.name, 'uz'));
  const online = operators.filter((item) => item.state === 'ONLINE');
  const onBreak = operators.filter((item) => item.state === 'BREAK').map((item) => item.name);
  const offline = operators.filter((item) => item.state === 'OFFLINE').map((item) => item.name);
  const full = (item: TransferOperator) => bookingCount > 0 && item.activeBookings + bookingCount > item.maxBookings;
  const selected = online.find((item) => item.id === operatorId) ?? null;
  const missing = touched && !selected;

  const activity = (value: OperatorActivity | null) => {
    if (!value) return t('al.act.IDLE');
    const seconds = value.since ? Math.max(0, Math.floor((now - Date.parse(value.since)) / 1000)) : 0;
    const label = t(`al.act.${value.kind}`, { time: clock(seconds) });
    return value.leadId ? `${label} · ${value.leadId}` : label;
  };

  const leadState = (lead: TransferLead) => {
    if (lead.status === 'CALLBACK' && lead.callbackAt) return isScheduledCall(lead, now) ? t('al.tr.callAt', { time: tashkentClock(Date.parse(lead.callbackAt)) }) : t('al.tr.callDue');
    if (lead.status === 'BOOKED' && lead.bookedUntil) {
      const left = t('al.tr.bookedLeft', { left: clock(Math.max(0, Math.floor((Date.parse(lead.bookedUntil) - now) / 1000))) });
      return lead.callStartedAt ? `${left} · ${t('al.tr.callFor', { time: clock(since(lead.callStartedAt, now)) })}` : left;
    }
    if (lead.status === 'BOOKED' && lead.operatorName) return t('al.tr.booked', { operator: lead.operatorName });
    const minutes = Math.max(1, Math.round((now - Date.parse(lead.createdAt)) / 60_000));
    return lead.queuePosition ? t('al.tr.queue', { position: lead.queuePosition, minutes }) : t('al.tr.queueNew', { minutes });
  };

  const unavailable = onBreak.length && offline.length
    ? t('al.tr.offBreakOffline', { onBreak: onBreak.join(', '), offline: offline.join(', ') })
    : onBreak.length ? t('al.tr.offBreak', { onBreak: onBreak.join(', ') }) : offline.length ? t('al.tr.offOffline', { offline: offline.join(', ') }) : null;

  const submit = () => {
    setTouched(true);
    if (!selected || full(selected) || transfer.isPending) return;
    transfer.mutate({ ids: leads.map((lead) => lead.id), operatorId: selected.id, reason: comment.trim() || undefined }, {
      onSuccess: ({ moved, failed }) => {
        const placement = phone ? 'top' : 'bottomRight';
        if (moved.length) {
          const kept = moved.some((id) => scheduled.some((lead) => lead.id === id));
          notification.success({
            title: moved.length > 1 ? t('al.tr.doneMany', { count: moved.length }) : t('al.tr.doneOne', { id: moved[0] }),
            description: t(kept ? 'al.tr.doneTextKept' : 'al.tr.doneText', { ids: moved.join(', '), operator: selected.name }),
            placement,
            duration: 5,
          });
        }
        if (failed.length) {
          notification.error({ title: t('al.tr.partial', { count: failed.length }), description: `${failed.map((item) => item.id).join(', ')}: ${getApiErrorMessage(failed[0].error)}`, placement });
        }
        onDone?.(moved);
        if (!failed.length) onClose();
      },
      onError: (error) => notification.error({ title: t('al.tr.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  const single = leads.length === 1;
  const description = single && cards && owner
    ? t('al.tr.descOwner', { name: leads[0].customerName, product: leads[0].productName, operator: owner })
    : !single ? (owner && scheduled.length === leads.length ? t('al.tr.descScheduled', { operator: owner }) : t('al.tr.descMany'))
      : t('al.tr.descOne', { name: leads[0].customerName, product: leads[0].productName, stream: leads[0].streamCode ?? '—' });
  const times = scheduled.map((lead) => tashkentClock(Date.parse(lead.callbackAt ?? '')));
  const joinedTimes = times.length > 1 ? t('al.tr.and', { a: times.slice(0, -1).join(', '), b: times.at(-1) ?? '' }) : times[0] ?? '';

  return (
    <Dialog
      open
      title={single ? t(cards ? 'al.tr.titleCard' : 'al.tr.titleOne', { id: leads[0].id }) : t('al.tr.titleMany', { count: leads.length })}
      description={description}
      icon={<ArrowRightLeft />}
      width={many ? 520 : 480}
      locked={transfer.isPending}
      onClose={onClose}
      testId="transfer-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={transfer.isPending}>{t('al.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={transfer.isPending} savingLabel={t('al.tr.saving')} shortcut={false} icon={<ArrowRightLeft />} disabled={Boolean(selected && full(selected))}>
            {many && selected ? t('al.tr.submitTo', { name: selected.name }) : t('al.tr.submit')}
          </DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
      <div className={styles.leads}>
        <ul>
          {leads.map((lead) => (
            <li key={lead.id}>
              <span className={styles.leadName}><span className={styles.leadId}>{lead.id}</span><span>{lead.customerName}</span></span>
              <span className={styles.leadState}>{leadState(lead)}</span>
            </li>
          ))}
        </ul>
      </div>

      {inCall ? (
        <div className={styles.note} role="note">
          <TriangleAlert aria-hidden />
          <div>
            <p>{t('al.tr.inCallTitle', { operator: inCall })}</p>
            <p>{t('al.tr.inCallText', { operator: inCall })}</p>
          </div>
        </div>
      ) : null}

      {many ? (
        <fieldset className={styles.fieldset} aria-describedby={missing ? errorId : undefined}>
          <legend>{t('al.tr.to')} <span className={styles.required} aria-hidden>*</span></legend>
          {online.length ? (
            <div className={styles.operators}>
              {online.map((item) => {
                const disabled = full(item);
                return (
                  <label key={item.id} className={styles.operator} data-selected={item.id === operatorId || undefined} data-disabled={disabled || undefined}>
                    <RadioDot name="transfer-operator" value={item.id} checked={item.id === operatorId} disabled={disabled} onChange={() => setOperatorId(item.id)} />
                    <span className={styles.avatar} aria-hidden>{initials(item.name)}</span>
                    <span className={styles.operatorText}>
                      <span className={styles.operatorName}>{item.name}</span>
                      <span className={styles.operatorMeta}>{disabled ? t('al.tr.full') : activity(item.activity)}</span>
                    </span>
                    <span className={styles.load}>
                      <span>{t('al.tr.bookings', { count: item.activeBookings, max: item.maxBookings })}</span>
                      {item.scheduledCalls !== null ? <span>{t('al.tr.scheduled', { count: item.scheduledCalls })}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : operatorsQuery.isPending ? <span className={styles.skeleton} aria-busy="true" /> : <p className={styles.hint}><Lock aria-hidden />{t('al.tr.noOnline')}</p>}
          {missing ? <p id={errorId} className={styles.error}><CircleAlert aria-hidden />{t('al.tr.pickError')}</p> : null}
        </fieldset>
      ) : (
        <div>
          <div className={styles.labelRow}>
            <label htmlFor={selectId}>{t('al.tr.newOperator')} <span className={styles.required} aria-hidden>*</span></label>
          </div>
          <span className={styles.select} data-invalid={missing || undefined}>
            <select id={selectId} value={operatorId} required aria-invalid={missing || undefined} aria-describedby={missing ? errorId : undefined} onChange={(event) => setOperatorId(event.target.value)}>
              <option value="">{t('al.tr.pick')}</option>
              {online.map((item) => {
                const bookings = t('al.tr.bookings', { count: item.activeBookings, max: item.maxBookings });
                return <option key={item.id} value={item.id} disabled={full(item)}>{t(full(item) ? 'al.tr.optionFull' : 'al.tr.option', { name: item.name, bookings })}</option>;
              })}
            </select>
            <ChevronDown aria-hidden />
          </span>
          {missing ? <p id={errorId} className={styles.error}><CircleAlert aria-hidden />{t('al.tr.pickError')}</p> : null}
        </div>
      )}

      {many && unavailable ? <p className={styles.hint}><Lock aria-hidden />{unavailable}</p> : null}
      {!many ? <p className={styles.hint}><Info aria-hidden />{t('al.tr.oneNote', { max: selected?.maxBookings ?? online[0]?.maxBookings ?? 5 })}</p> : null}

      {many && selected ? (
        <div className={styles.after}>
          <p>{t('al.tr.after')}</p>
          <dl>
            {scheduled.length && selected.scheduledCalls !== null ? (
              <div><dt>{selected.name}</dt><dd>{t('al.tr.afterScheduled', { from: selected.scheduledCalls, to: selected.scheduledCalls + scheduled.length })}</dd></div>
            ) : null}
            {bookingCount ? (
              <div><dt>{selected.name}</dt><dd>{t('al.tr.bookingsMove', { from: selected.activeBookings, to: selected.activeBookings + bookingCount, max: selected.maxBookings })}</dd></div>
            ) : (
              <div><dt>{t('al.tr.afterBookings')}</dt><dd>{t('al.tr.bookingsSame', { count: selected.activeBookings, max: selected.maxBookings })}</dd></div>
            )}
            {sources.map(({ operator, count }) => (
              <div key={operator.id}><dt>{operator.name}</dt><dd>{t('al.tr.bookingsMove', { from: operator.activeBookings, to: Math.max(0, operator.activeBookings - count), max: operator.maxBookings })}</dd></div>
            ))}
            {scheduled.length ? <div><dt>{t('al.tr.callTime')}</dt><dd>{t('al.tr.callTimeKept', { times: joinedTimes })}</dd></div> : null}
          </dl>
        </div>
      ) : null}

      <div>
        <div className={styles.labelRow}>
          <label htmlFor={commentId}>{t('al.comment')}</label>
          <span>{t('al.optional')}</span>
        </div>
        <textarea id={commentId} className={styles.textarea} value={comment} maxLength={500} placeholder={many && !single ? t('al.tr.commentPlaceholder') : undefined} onChange={(event) => setComment(event.target.value)} />
      </div>
      </div>
    </Dialog>
  );
}
