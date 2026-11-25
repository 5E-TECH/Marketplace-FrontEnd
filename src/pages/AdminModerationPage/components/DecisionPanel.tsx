import { CircleCheck, CircleMinus, CircleX, Clock, Info, RefreshCw } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { appliesTo, MODERATION_RULES, REJECT_REASON_MAX, SYSTEM_CHECKS, systemBlocked } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import { decisionProgress, emptyDecision, type DecisionState } from '../model/decision';
import type { AdminProduct } from '../../../features/adminProducts/model/adminProductTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../AdminModerationPage.module.css';

interface DecisionPanelProps {
  product: AdminProduct;
  state: DecisionState;
  onChange: (state: DecisionState) => void;
  onApprove: () => void;
  onReject: () => void;
  /** Boshqa admin qaror qilgan yoki mahsulot navbatda emas — hammasi o'chiq (8.1). */
  conflict: boolean;
  onReloadQueue: () => void;
  /** Telefonda tugmalar pastki panelda. */
  phone: boolean;
}

/** «Qaror — mahsulotni admin tasdiqlaydi» (admin-moderatsiya): tekshiruv, tizim tekshiruvi, sabab, tugmalar. */
export function DecisionPanel({ product, state, onChange, onApprove, onReject, conflict, onReloadQueue, phone }: DecisionPanelProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const progress = decisionProgress(product, state);
  const blocked = systemBlocked(product);
  const shop = product.shop?.name || t('moderation.field.shop');

  return (
    <div className={styles.decisionBody}>
      {conflict ? (
        <div className={styles.conflict} role="status">
          <Info aria-hidden />
          <div>
            <p className={styles.conflictTitle}>{t('moderation.conflictTitle')}</p>
            <p>{t('moderation.conflictText')}</p>
            <button type="button" className={styles.smallButton} onClick={onReloadQueue}>
              <RefreshCw aria-hidden />
              {t('moderation.reloadQueue')}
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className={styles.blockTitle}>{t('moderation.check')} <span>{t('moderation.checkHint')}</span></h3>
        <p className={styles.checkText}>{t('moderation.checkText')}</p>
        <div className={styles.rules}>
          {MODERATION_RULES.map((rule) =>
            appliesTo(rule, product) ? (
              <label key={rule.key} className={styles.rule}>
                <span className={styles.box}>
                  <input
                    type="checkbox"
                    checked={Boolean(state.checks[rule.key])}
                    disabled={conflict}
                    onChange={(event) => onChange({ ...state, checks: { ...state.checks, [rule.key]: event.target.checked } })}
                  />
                  <svg viewBox="0 0 14 14" aria-hidden><path d="M3 7.2 5.8 10 11 4" /></svg>
                </span>
                <span className={styles.ruleText}>
                  <span>{t(rule.title)}</span>
                  <span>{t(rule.hint)}</span>
                </span>
              </label>
            ) : (
              <div key={rule.key} className={styles.rule} data-na>
                <CircleMinus aria-hidden />
                <span className={styles.ruleText}>
                  <span>{t(rule.title)}</span>
                  <span>{rule.naHint ? t(rule.naHint) : null}</span>
                </span>
              </div>
            ),
          )}
        </div>
        <p className={styles.progress} data-complete={progress.complete || undefined} aria-live="polite">
          {progress.complete ? <CircleCheck aria-hidden /> : <Clock aria-hidden />}
          {t('moderation.progress', { total: progress.total, done: progress.done })}
        </p>
      </div>

      <div>
        <p className={styles.systemTitle}>{t('moderation.system')}</p>
        <ul className={styles.system}>
          {SYSTEM_CHECKS.map((check) => {
            const passes = check.passes(product);
            return (
              <li key={check.key} data-fail={passes ? undefined : true}>
                {passes ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
                <span>
                  {t(passes ? check.ok : check.fail)}
                  {!passes && check.key === 'fiscal' ? <Link to={`/admin/products/${encodeURIComponent(product.id)}`} className={styles.systemLink}>{t('moderation.system.fiscalLink')}</Link> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className={styles.reasonHead}>
          <label htmlFor={reasonId}>{t('moderation.reason')}</label>
          <span>{t('moderation.reasonRequired')}</span>
        </div>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={state.reason}
          maxLength={REJECT_REASON_MAX}
          disabled={conflict}
          placeholder={t('moderation.reasonPlaceholder')}
          onChange={(event) => onChange({ ...state, reason: event.target.value })}
        />
        <p className={styles.reasonHint}>{t('moderation.reasonVisible', { shop })}</p>
      </div>

      <div className={styles.decide}>
        {phone ? null : (
          <div className={styles.actions}>
            <button type="button" className={styles.approve} disabled={conflict || !progress.complete || blocked} onClick={onApprove} aria-keyshortcuts="Control+Enter" aria-describedby={blocked ? `${reasonId}-blocked` : undefined}>
              {t('moderation.approve')}
              <kbd>Ctrl+Enter</kbd>
            </button>
            <button type="button" className={styles.reject} disabled={conflict} onClick={onReject}>{t('moderation.reject')}</button>
            <button type="button" className={styles.cancel} disabled={conflict} onClick={() => onChange(emptyDecision())}>{t('moderation.cancel')}</button>
          </div>
        )}
        {blocked && !conflict ? <p className={styles.blocked} id={`${reasonId}-blocked`}><CircleX aria-hidden />{t('moderation.systemBlocked')}</p> : null}
        <ul className={styles.notes}>
          <li><Info aria-hidden />{t('moderation.afterApprove')}</li>
          <li><Info aria-hidden />{t('moderation.afterApproveCatalog')}</li>
        </ul>
      </div>
    </div>
  );
}
