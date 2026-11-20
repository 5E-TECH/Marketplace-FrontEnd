import { ArrowRight, Calendar, CalendarClock, Check, CircleX, Clock, GitMerge, PhoneOff, TriangleAlert } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { clock, dayLabel, rejectLabel, statusLabel } from '../../features/operator/lib/leadFormat';
import { CALLBACK_GRACE_MINUTES, clampToCallWindow, duplicateCandidate, REMINDER_MINUTES, tashkentMoment, tashkentParts } from '../../features/operator/lib/leadRules';
import { useNow } from '../../features/operator/lib/useNow';
import type { LeadCard, LeadRejectReason, LeadResultInput } from '../../features/operator/model/operatorTypes';
import { DialogCancel, DialogHint, DialogPrimary, OperatorDialog } from '../../features/operator/ui/OperatorDialog';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { addDays } from '../../shared/lib/tashkentTime';
import type { DialogChoice } from './resultChoices';
import styles from './ResultDialog.module.css';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';

type DateChoice = 'today' | 'tomorrow' | 'other';

const REJECT_REASONS: readonly LeadRejectReason[] = ['TOO_EXPENSIVE', 'NOT_NEEDED', 'BOUGHT_ELSEWHERE', 'OTHER'];
const MINUTE = 60_000;
const WEEKDAYS: readonly TranslationKey[] = ['opw.weekday.0', 'opw.weekday.1', 'opw.weekday.2', 'opw.weekday.3', 'opw.weekday.4', 'opw.weekday.5', 'opw.weekday.6'];

const META: Record<DialogChoice, { title: TranslationKey; text: TranslationKey; save: TranslationKey; target: LeadCard['status']; tone: 'action' | 'danger' | 'neutral' }> = {
  CALL_LATER: { title: 'opw.later.title', text: 'opw.later.text', save: 'opw.schedule', target: 'CALLBACK', tone: 'action' },
  THINKING: { title: 'opw.thinking.title', text: 'opw.thinking.text', save: 'opw.schedule', target: 'CALLBACK', tone: 'action' },
  REJECTED: { title: 'opw.reject.title', text: 'opw.reject.text', save: 'opw.rejectSave', target: 'REJECTED', tone: 'danger' },
  INVALID: { title: 'opw.invalid.title', text: 'opw.invalid.text', save: 'opw.invalidSave', target: 'INVALID', tone: 'neutral' },
  DUPLICATE: { title: 'opw.duplicate.title', text: 'opw.duplicate.text', save: 'opw.duplicateSave', target: 'MERGED', tone: 'neutral' },
};

const ICONS: Record<DialogChoice, typeof CalendarClock> = {
  CALL_LATER: CalendarClock,
  THINKING: CalendarClock,
  REJECTED: CircleX,
  INVALID: PhoneOff,
  DUPLICATE: GitMerge,
};

interface ResultDialogProps {
  card: LeadCard;
  choice: DialogChoice | null;
  saving: boolean;
  error: string | null;
  onSubmit: (input: LeadResultInput) => void;
  onClose: () => void;
}

/** Natija oynalari (operator-natija 1): har natija o'z oynasida saqlanadi. */
export function ResultDialog({ card, choice, saving, error, onSubmit, onClose }: ResultDialogProps) {
  const { t } = useTranslation();
  if (!choice) return null;
  const meta = META[choice];
  const Icon = ICONS[choice];
  return (
    <OperatorDialog
      open
      title={t(meta.title)}
      description={t(meta.text)}
      icon={<Icon />}
      tone={meta.tone}
      locked={saving}
      onClose={onClose}
      testId="result-dialog"
    >
      <DialogBody key={choice} card={card} choice={choice} saving={saving} error={error} onSubmit={onSubmit} onClose={onClose} />
    </OperatorDialog>
  );
}

function DialogBody({ card, choice, saving, error, onSubmit, onClose }: ResultDialogProps & { choice: DialogChoice }) {
  const { t } = useTranslation();
  const now = useNow();
  const [dateChoice, setDateChoice] = useState<DateChoice | null>(null);
  const [otherDate, setOtherDate] = useState('');
  const [time, setTime] = useState('');
  const [touched, setTouched] = useState(false);
  const [reason, setReason] = useState<LeadRejectReason | null>(null);
  const [comment, setComment] = useState('');

  const meta = META[choice];
  const today = tashkentParts(now).date;
  const date = dateChoice === 'today' ? today : dateChoice === 'tomorrow' ? addDays(today, 1) : dateChoice === 'other' ? otherDate : '';
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const moment = date && timeValid ? tashkentMoment(date, time) : null;
  const scheduled = moment === null ? null : clampToCallWindow(moment);
  const shifted = scheduled !== null && moment !== null && scheduled !== moment;
  const past = scheduled !== null && scheduled <= now;
  const trimmed = comment.trim();
  const candidate = choice === 'DUPLICATE' ? duplicateCandidate(card) : null;
  const scheduling = choice === 'CALL_LATER' || choice === 'THINKING';

  let invalidHint: TranslationKey | null = null;
  if (choice === 'CALL_LATER') {
    if (!date || !timeValid) invalidHint = 'opw.dateTimeRequired';
    else if (past) invalidHint = 'opw.callbackPast';
  } else if (choice === 'THINKING') {
    if ((date && !timeValid) || (!date && time)) invalidHint = 'opw.dateTimeRequired';
    else if (past) invalidHint = 'opw.callbackPast';
  } else if (choice === 'REJECTED') {
    if (!reason) invalidHint = 'opw.rejectReasonRequired';
    else if (reason === 'OTHER' && !trimmed) invalidHint = 'opw.rejectOtherRequired';
  } else if (choice === 'DUPLICATE' && !candidate) {
    invalidHint = 'opw.duplicateNone';
  }
  const canSave = !invalidHint && !saving;

  const submit = () => {
    setTouched(true);
    if (!canSave) return;
    const base = trimmed ? { comment: trimmed } : {};
    if (scheduling) onSubmit({ outcome: choice, ...base, ...(scheduled !== null ? { callbackAt: new Date(scheduled).toISOString() } : {}) });
    else if (choice === 'REJECTED' && reason) onSubmit({ outcome: 'REJECTED', rejectReason: reason, ...base });
    else if (choice === 'DUPLICATE' && candidate) onSubmit({ outcome: 'DUPLICATE', duplicateOfLeadId: candidate.id, ...base });
    else if (choice === 'INVALID') onSubmit({ outcome: 'INVALID', ...base });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  const onTime = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  };

  const weekday = (value: number) => t(WEEKDAYS[new Date(value + 5 * 3_600_000).getUTCDay()]);
  const dateText = date ? `${dayLabel(Date.parse(`${date}T12:00:00+05:00`))}, ${weekday(Date.parse(`${date}T12:00:00+05:00`))}` : null;
  const timeMissing = touched && Boolean(date) && !timeValid && (choice === 'CALL_LATER' || Boolean(date));
  const commentRequired = choice === 'REJECTED' && reason === 'OTHER';

  return (
    <div onKeyDown={onKeyDown} className={styles.body}>
      <div className={styles.lead}>
        <span className={styles.leadName}>
          <span>{card.customerName} · <span>{card.id}</span></span>
          <span>{card.product.name} · {t('opw.requestAt')} {clock(card.createdAt)}</span>
        </span>
        <span className={styles.flow}>
          <StatusBadge family="lead" code={card.status} titlePrefix={t('opw.statusTitle')} />
          <ArrowRight size={16} aria-hidden />
          <StatusBadge family="lead" code={meta.target} titlePrefix={t('opw.statusTitle')} />
        </span>
      </div>

      {error ? (
        <div className={styles.box} data-tone="danger" role="alert">
          <CircleX aria-hidden />
          <div><strong>{t('opw.saveFailed')}</strong><p>{t('opw.saveFailedText')}</p></div>
        </div>
      ) : null}

      {scheduling ? (
        <>
          <div className={styles.dateTime}>
            <div>
              <div className={styles.labelRow}>
                <span className={styles.label} id="callback-date">{t('opw.callbackDate')} {choice === 'CALL_LATER' ? <span>*</span> : null}</span>
                {choice === 'THINKING' ? <span>{t('opw.optional')}</span> : null}
              </div>
              <div className={styles.segmented} role="radiogroup" aria-labelledby="callback-date">
                <button type="button" role="radio" aria-checked={dateChoice === 'today'} className={styles.segment} onClick={() => setDateChoice('today')}>{t('opw.today')}</button>
                <button type="button" role="radio" aria-checked={dateChoice === 'tomorrow'} className={styles.segment} onClick={() => setDateChoice('tomorrow')}>{t('opw.tomorrow')}</button>
                <button type="button" role="radio" aria-checked={dateChoice === 'other'} className={`${styles.segment} ${styles.calendar}`} aria-label={t('opw.otherDate')} title={t('opw.otherDate')} onClick={() => setDateChoice('other')}>
                  <Calendar size={18} aria-hidden />
                </button>
              </div>
              {dateChoice === 'other' ? (
                <input type="date" className={`${styles.textarea} ${styles.dateInput}`} aria-label={t('opw.otherDate')} value={otherDate} min={addDays(today, 2)} onChange={(event) => setOtherDate(event.target.value)} />
              ) : null}
            </div>
            <div>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="callback-time">{t('opw.callbackTime')} {choice === 'CALL_LATER' ? <span>*</span> : null}</label>
                {choice === 'THINKING' ? <span>{t('opw.optional')}</span> : null}
              </div>
              <div className={styles.timeWrap}>
                <Clock size={18} aria-hidden />
                <input
                  id="callback-time"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={t('opw.timePlaceholder')}
                  value={time}
                  aria-invalid={timeMissing || undefined}
                  onChange={(event) => onTime(event.target.value)}
                />
              </div>
              {timeMissing ? <p className={styles.fieldError}><CircleX size={14} aria-hidden />{t('opw.timeRequired')}</p> : null}
            </div>
          </div>
          <p className={styles.note}>{t('opw.callWindow')}</p>
          {shifted && scheduled !== null ? (
            <div className={styles.box} data-tone="warning">
              <TriangleAlert aria-hidden />
              <div><strong>{t('opw.outsideTitle', { time })}</strong><p>{t('opw.outsideText')}</p></div>
            </div>
          ) : null}
          {date || choice === 'CALL_LATER' ? (
            <div className={styles.summary} data-testid="callback-summary">
              <p>{t('opw.callbackAt')}</p>
              <p className={styles.summaryBig}>
                {scheduled !== null
                  ? `${dayLabel(scheduled)}, ${weekday(scheduled)} · ${clock(scheduled)}`
                  : `${dateText ?? t('opw.dateQuestion')} · ${t('opw.timeQuestion')}`}
              </p>
              {scheduled !== null && !past ? (
                <>
                  <p className={styles.summaryText}>{t('opw.callbackStays')}</p>
                  <p className={styles.summaryText}>{t('opw.callbackReminder', { reminder: clock(scheduled - REMINDER_MINUTES * MINUTE), grace: clock(scheduled + CALLBACK_GRACE_MINUTES * MINUTE) })}</p>
                </>
              ) : null}
            </div>
          ) : (
            <div className={styles.summary}>
              <p>{t('opw.thinkingNoTimeTitle')}</p>
              <p className={styles.summaryBig}>{dayLabel(Date.parse(`${addDays(today, 1)}T12:00:00+05:00`))}</p>
              <p className={styles.summaryText}>{t('opw.thinkingNoTime')}</p>
            </div>
          )}
        </>
      ) : null}

      {choice === 'REJECTED' ? (
        <div>
          <div className={styles.labelRow}><span className={styles.label} id="reject-reason">{t('opw.rejectReason')} <span>*</span></span></div>
          <div className={styles.options} role="radiogroup" aria-labelledby="reject-reason">
            {REJECT_REASONS.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={reason === value} className={styles.option} onClick={() => setReason(value)}>
                {reason === value ? <Check size={18} aria-hidden /> : null}
                {rejectLabel(value, t)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {choice === 'INVALID' ? (
        <div className={styles.summary}>
          <p>{t('opw.invalidAfter')}</p>
          <p className={styles.summaryBig}>{t('opw.invalidClosed')}</p>
          <p className={styles.summaryText}>{t('opw.invalidNote')}</p>
        </div>
      ) : null}

      {choice === 'DUPLICATE' ? (
        candidate ? (
          <>
            <div>
              <div className={styles.labelRow}><span className={styles.label}>{t('opw.duplicateOf')}</span><span>{t('opw.duplicateRule')}</span></div>
              <div className={styles.candidate} data-testid="duplicate-candidate">
                <Check size={18} aria-hidden />
                <div>
                  <strong>{t('opw.duplicateLead', { id: candidate.id, date: dayLabel(candidate.createdAt) })}</strong>
                  <span>{candidate.productName}</span>
                </div>
                <StatusBadge family="lead" code={candidate.status} titlePrefix={t('opw.statusTitle')} />
              </div>
            </div>
            <div className={styles.summary}>
              <p>{t('opw.invalidAfter')}</p>
              <p className={styles.summaryBig}>{card.id} → {candidate.id}</p>
              <p className={styles.summaryText}>{t('opw.duplicateNote')}</p>
            </div>
          </>
        ) : (
          <div>
            <div className={styles.labelRow}><span className={styles.label}>{t('opw.duplicateOf')}</span></div>
            <div className={styles.box} data-tone="warning" role="status">
              <TriangleAlert aria-hidden />
              <div>
                <strong>{t('opw.duplicateNone')}</strong>
                {card.previousLeads[0] ? (
                  <p>{t('opw.duplicateOther', { date: dayLabel(card.previousLeads[0].createdAt), product: card.previousLeads[0].productName, status: statusLabel(card.previousLeads[0].status, t) })}</p>
                ) : <p>{t('opw.duplicateNoneText')}</p>}
              </div>
            </div>
          </div>
        )
      ) : null}

      {choice !== 'DUPLICATE' || candidate ? (
        <div>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="result-comment">{t('opw.comment')} {commentRequired ? <span>*</span> : null}</label>
            <span>{commentRequired ? t('opw.rejectOtherRequired') : t('opw.optional')}</span>
          </div>
          <textarea
            id="result-comment"
            className={styles.textarea}
            value={comment}
            maxLength={500}
            placeholder={choice === 'REJECTED' ? t('opw.rejectPlaceholder') : choice === 'INVALID' ? t('opw.invalidPlaceholder') : t('opw.laterPlaceholder')}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>
      ) : null}
      {choice === 'REJECTED' ? <p className={styles.noteFlat}>{t('opw.rejectNote')}</p> : null}

      <div className={styles.footer}>
        {invalidHint && !saving ? <span data-testid="save-hint" className={styles.hintSlot}><DialogHint>{t(invalidHint)}</DialogHint></span> : null}
        <DialogCancel onClick={onClose} disabled={saving}>{t('opw.cancel')}</DialogCancel>
        <DialogPrimary onClick={submit} disabled={!canSave} saving={saving} savingLabel={t('opw.saving')}>
          {error ? t('opw.retry') : t(meta.save)}
        </DialogPrimary>
      </div>
    </div>
  );
}
