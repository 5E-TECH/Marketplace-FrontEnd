import { App } from 'antd';
import { Coffee, Power } from 'lucide-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import type { OperatorState } from '../api/operatorApi';
import { DEFAULT_MAX_BOOKINGS, useOperatorLeadsQuery, useOperatorStateMutation, useOperatorStateQuery } from '../api/operatorQueries';
import { useNow } from '../lib/useNow';
import { DialogCancel, DialogPrimary, Dialog } from '../../../shared/ui/Dialog/Dialog';
import { useCallbackReminders } from './useCallbackReminders';
import styles from './OperatorStatusBar.module.css';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';

const STATES: ReadonlyArray<{ value: OperatorState; label: 'operator.online' | 'operator.break' | 'operator.offline' }> = [
  { value: 'ONLINE', label: 'operator.online' },
  { value: 'BREAK', label: 'operator.break' },
  { value: 'OFFLINE', label: 'operator.offline' },
];

/**
 * Yuqori qator, `h1` dan keyin: «Holat: Onlayn | Tanaffus | Oflayn» (operator-karkas).
 * Bron bor bo'lsa tanaffus va oflayn oldidan oyna: bronlar navbatga qaytadi (3-bo'lim);
 * bron yo'q bo'lsa — oynasiz, toast.
 */
export function OperatorStateSwitch() {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const current = useOperatorStateQuery().data?.state ?? 'OFFLINE';
  const mine = useOperatorLeadsQuery().data ?? [];
  const bookings = mine.filter((lead) => lead.status === 'BOOKED');
  const callbacks = mine.filter((lead) => lead.status === 'CALLBACK' && lead.callbackAt).sort((a, b) => (a.callbackAt ?? '').localeCompare(b.callbackAt ?? ''));
  const mutation = useOperatorStateMutation();
  const [confirming, setConfirming] = useState<OperatorState | null>(null);
  const shown = mutation.isPending ? mutation.variables : current;

  const apply = (state: OperatorState) => {
    mutation.mutate(state, {
      onSuccess: () => {
        setConfirming(null);
        if (state === 'BREAK' && !bookings.length) {
          notification.info({ title: t('opw.breakStarted', { time: tashkentClock() }), description: t('opw.breakStartedText'), placement: 'bottomRight', duration: 6 });
        }
      },
      onError: (error) => void message.error(`${t('operator.stateFailed')}: ${getApiErrorMessage(error)}`),
    });
  };

  const select = (state: OperatorState) => {
    if (state === current || mutation.isPending) return;
    if (state !== 'ONLINE' && bookings.length) {
      setConfirming(state);
      return;
    }
    apply(state);
  };

  return (
    <div className={styles.state}>
      <span id="operator-state-label" className={styles.stateLabel}>{t('operator.stateLabel')}</span>
      <div role="radiogroup" aria-labelledby="operator-state-label" className={styles.segments}>
        {STATES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={shown === value}
            className={styles.segment}
            data-state={value}
            onClick={() => select(value)}
          >
            <span className={styles.dot} aria-hidden />
            {t(label)}
          </button>
        ))}
      </div>
      <Dialog
        open={confirming !== null}
        title={confirming === 'OFFLINE' ? t('opw.offlineConfirmTitle') : t('opw.breakConfirmTitle')}
        description={confirming === 'OFFLINE' ? t('opw.offlineConfirmText') : t('opw.breakConfirmText')}
        icon={confirming === 'OFFLINE' ? <Power /> : <Coffee />}
        tone="warning"
        locked={mutation.isPending}
        onClose={() => setConfirming(null)}
        footer={(
          <>
            <DialogCancel onClick={() => setConfirming(null)} disabled={mutation.isPending}>{t('opw.cancel')}</DialogCancel>
            <DialogPrimary onClick={() => confirming && apply(confirming)} saving={mutation.isPending} savingLabel={t('opw.saving')} icon={confirming === 'OFFLINE' ? <Power /> : <Coffee />} shortcut={false}>
              {confirming === 'OFFLINE' ? t('opw.offlineGo') : t('opw.breakGo')}
            </DialogPrimary>
          </>
        )}
      >
        <div className={styles.confirmBlock}>
          <strong>{t('opw.breakReturns', { count: bookings.length })}</strong>
          <ul className={styles.confirmList}>
            {bookings.map((lead) => (
              <li key={lead.id}>
                <span><b>{lead.customerName} · {lead.id}</b><small>{lead.productName}</small></span>
                <StatusBadge family="lead" code={lead.status} titlePrefix={t('opw.statusTitle')} />
              </li>
            ))}
          </ul>
          <p className={styles.confirmNote}>{t('opw.breakReturnsText')}</p>
        </div>
        {callbacks.length ? (
          <div className={styles.confirmBlock}>
            <strong>{t('opw.breakCallbacksStay')}</strong>
            <ul className={styles.confirmCallbacks}>
              {callbacks.map((lead) => (
                <li key={lead.id}><span><b>{tashkentClock(Date.parse(lead.callbackAt ?? ''))}</b> · {lead.customerName}</span><span>{lead.productName}</span></li>
              ))}
            </ul>
            <p className={styles.confirmNote}>{t('opw.breakCallbacksRule')}</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

/** Yuqori qator o'ng tomoni: «Bronlarim: 1/5» va «14:37 Toshkent». Eslatmalar ham shu yerda — har sahifada. */
export function OperatorBookingsClock() {
  const { t } = useTranslation();
  const leads = useOperatorLeadsQuery();
  const state = useOperatorStateQuery().data;
  const booked = leads.data?.filter((lead) => lead.status === 'BOOKED').length ?? state?.activeBookings ?? 0;
  const max = state?.maxBookings ?? DEFAULT_MAX_BOOKINGS;
  const now = useNow();
  useCallbackReminders(leads.data, now);

  return (
    <div className={styles.meta}>
      <span>{t('operator.bookings')} <strong data-testid="operator-bookings">{booked}/{max}</strong></span>
      <time dateTime={new Date(now).toISOString()}><strong>{tashkentClock(now)}</strong> {t('operator.clock')}</time>
    </div>
  );
}
