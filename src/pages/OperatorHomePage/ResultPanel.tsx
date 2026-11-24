import { Check, ChevronRight, CircleAlert, Lock, MessageSquareText } from 'lucide-react';
import type { ReactNode } from 'react';
import { clock, dayLabel, dayOffset } from '../../features/operator/lib/leadFormat';
import { closesAsNoContact, isNoAnswer, MAX_ATTEMPTS, nextRetryAt, noContactDeadline } from '../../features/operator/lib/leadRules';
import { useNow } from '../../shared/lib/useNow';
import type { LeadCard } from '../../features/operator/model/operatorTypes';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../shared/lib/tashkentTime';
import { confirmBlocked, RESULT_TILES, type NoAnswerOutcome, type ResultChoice } from './resultChoices';
import styles from './OperatorWorkspace.module.css';

export interface NoAnswerDraft {
  outcome: NoAnswerOutcome;
  comment: string;
}

interface ResultPanelProps {
  card: LeadCard;
  selected: 'CONFIRMED' | 'NO_ANSWER' | null;
  noAnswer: NoAnswerDraft;
  busy: boolean;
  /** «Buyurtma tasdiqlandi» tanlanganda — buyurtma formasi (FE-09). */
  orderForm: ReactNode;
  /** Buyurtma yaratilgach — butun panel o'rnida «Buyurtma yaratildi» (20-kadr). */
  done: ReactNode;
  onChoose: (choice: ResultChoice) => void;
  onNoAnswerChange: (patch: Partial<NoAnswerDraft>) => void;
}

const NO_ANSWER: readonly NoAnswerOutcome[] = ['NO_ANSWER', 'BUSY', 'PHONE_OFF'];
const MINUTE = 60_000;

/** «Natija va buyurtma» paneli (operator-lid-kartasi, operator-natija): plitkalar, buyurtma formasi yoki keyingi urinish. */
export function ResultPanel({ card, selected, noAnswer, busy, orderForm, done, onChoose, onNoAnswerChange }: ResultPanelProps) {
  const { t } = useTranslation();
  const blocked = confirmBlocked(card);

  if (done) {
    return (
      <section className={`${styles.panel} ${styles.result}`} aria-label={t('opw.resultLabel')} id="lead-result">
        {done}
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.result}`} aria-label={t('opw.resultLabel')} id="lead-result">
      <div className={styles.resultTop}>
        <h2 id="lead-result-title" className={styles.panelTitle}>{t('opw.result')}</h2>
        <div className={styles.tiles} role="radiogroup" aria-labelledby="lead-result-title">
          {RESULT_TILES.map(({ choice, key }) => {
            const checked = selected === choice;
            const locked = choice === 'CONFIRMED' && Boolean(blocked);
            const disabled = busy || locked || (selected === 'NO_ANSWER' && choice !== 'NO_ANSWER');
            const label = choice === 'NO_ANSWER' ? t('opw.noAnswerTile') : t(`opw.outcome.${choice}` as TranslationKey);
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={checked}
                className={choice === 'NO_ANSWER' ? `${styles.tile} ${styles.tileWide}` : styles.tile}
                data-choice={choice}
                data-locked={locked || undefined}
                aria-keyshortcuts={`Alt+${key}`}
                disabled={disabled}
                title={locked && blocked ? t(blocked) : undefined}
                onClick={() => onChoose(choice)}
              >
                {locked ? <Lock aria-hidden /> : checked ? <Check aria-hidden /> : null}
                <span>{label}</span>
                {locked ? <span className={styles.tileLockNote}>{t('opw.lockStock')}</span> : null}
                {choice === 'NO_ANSWER' && checked ? <span className={styles.tileTag}>{t('opw.noAnswerTag', { outcome: t(`opw.outcome.${noAnswer.outcome}` as TranslationKey) })}</span> : null}
                <kbd className={styles.kbd}>{key}</kbd>
              </button>
            );
          })}
        </div>
        <p className={styles.note}>{selected === 'NO_ANSWER' ? t('opw.noAnswerHint') : t('opw.resultHint')}</p>
      </div>

      <div className={styles.divider} />

      {selected === 'NO_ANSWER' ? (
        <NextAttemptPanel card={card} draft={noAnswer} onChange={onNoAnswerChange} />
      ) : selected === 'CONFIRMED' && !blocked ? (
        orderForm
      ) : (
        <div className={styles.lower}>
          <div className={styles.orderHead}>
            <h2 className={styles.panelTitle}>{t('opw.orderTitle')}</h2>
            <p className={styles.note}>{blocked ? t('opw.orderOpenHint') : t('opw.orderHint')}</p>
          </div>
          {blocked ? (
            <div className={styles.lockedBox}>
              <Lock size={20} aria-hidden />
              <div>
                <strong>{t('opw.orderLocked')}</strong>
                <p>{t('opw.orderLockedStock')}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** «Keyingi urinish — avtomatik» (operator-natija 2): operator javobsiz natijani tanlaydi (TEL-4 keyin). */
function NextAttemptPanel({ card, draft, onChange }: { card: LeadCard; draft: NoAnswerDraft; onChange: (patch: Partial<NoAnswerDraft>) => void }) {
  const { t } = useTranslation();
  const now = useNow();
  const failed = card.attempts.filter((attempt) => isNoAnswer(attempt.outcome)).length + 1;
  const closes = closesAsNoContact(failed, Date.parse(card.createdAt), now);
  const deadline = tashkentDateTime(noContactDeadline(Date.parse(card.createdAt)));
  const next = nextRetryAt(failed, now);
  const raw = failed <= 3 ? now + [15, 60, 180][failed - 1] * MINUTE : next;
  const offset = dayOffset(next, now);
  const step = Math.min(failed, 5);
  const shown = Math.min(failed, MAX_ATTEMPTS);
  const smsKey = failed < 2 ? 'smsNotYet' : failed === 2 ? 'smsNow' : 'smsOnce';

  return (
    <div className={`${styles.lower} ${styles.lowerOpen}`} data-testid="next-attempt">
      <h2 className={styles.panelTitle}>{t('opw.nextAttemptTitle')} <span>{t('opw.nextAttemptAuto')}</span></h2>
      <div className={styles.field}>
        <span className={styles.fieldLabel} id="no-answer-outcome">{t('opw.noAnswerWhich')}</span>
        <div className={styles.segmented} data-count="3" role="radiogroup" aria-labelledby="no-answer-outcome">
          {NO_ANSWER.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={draft.outcome === value} className={styles.segment} onClick={() => onChange({ outcome: value })}>
              {t(`opw.outcome.${value}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>
      {closes ? (
        <div className={styles.notice} data-tone="warning">
          <CircleAlert aria-hidden />
          <div><strong>{t('opw.lastAttempt')}</strong><p>{t('opw.lastAttemptText')}</p></div>
        </div>
      ) : (
        <div className={styles.retryBox}>
          <span>{t('opw.nextAttemptText')}</span>
          <span className={styles.retryTime}>{clock(next)}</span>
          <span>
            {offset === 0 ? t('opw.todayLower') : `${t('opw.tomorrowLower')}, ${dayLabel(next)}`} · {raw !== next ? t('opw.afterShifted', { time: clock(raw) }) : t(`opw.after.${Math.min(failed, 4)}` as TranslationKey)}
          </span>
        </div>
      )}
      <div>
        <div className={styles.attemptCount}>
          <span>{t('opw.attemptOf', { n: shown })}</span>
          <span>{t('opw.attemptDeadline', { date: deadline })}</span>
        </div>
        <div className={styles.progress} aria-hidden>
          {Array.from({ length: MAX_ATTEMPTS }, (_, index) => <span key={index} data-done={index < shown || undefined} />)}
        </div>
      </div>
      <p className={styles.note}>{t('opw.attemptRule')}</p>
      {!closes ? (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('opw.schedulePlan')}</span>
          <ol className={styles.plan}>
            {[1, 2, 3, 4, 5].map((index) => (
              <li key={index} aria-current={index === step || undefined}>
                <span>{t(`opw.plan.${index}` as TranslationKey)}</span>
                {index < 5 ? <ChevronRight size={14} aria-hidden /> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className={styles.smsBox}>
        <MessageSquareText size={16} aria-hidden />
        <div><strong>{t(`opw.${smsKey}.title` as TranslationKey)}</strong><span>{t(`opw.${smsKey}.text` as TranslationKey)}</span></div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor="no-answer-comment">{t('opw.comment')}</label>
          <span>{t('opw.optional')}</span>
        </span>
        <textarea id="no-answer-comment" className={styles.textarea} value={draft.comment} maxLength={500} onChange={(event) => onChange({ comment: event.target.value })} />
      </div>
    </div>
  );
}
