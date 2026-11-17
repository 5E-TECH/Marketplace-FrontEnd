import { App } from 'antd';
import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import type { OperatorState } from '../api/operatorApi';
import { DEFAULT_MAX_BOOKINGS, useOperatorLeadsQuery, useOperatorStateMutation, useOperatorStateQuery } from '../api/operatorQueries';
import styles from './OperatorStatusBar.module.css';

const STATES: ReadonlyArray<{ value: OperatorState; label: 'operator.online' | 'operator.break' | 'operator.offline' }> = [
  { value: 'ONLINE', label: 'operator.online' },
  { value: 'BREAK', label: 'operator.break' },
  { value: 'OFFLINE', label: 'operator.offline' },
];

/** Yuqori qator, `h1` dan keyin: «Holat: Onlayn | Tanaffus | Oflayn» (operator-karkas). */
export function OperatorStateSwitch() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const current = useOperatorStateQuery().data?.state ?? 'OFFLINE';
  const mutation = useOperatorStateMutation();
  const shown = mutation.isPending ? mutation.variables : current;

  const select = (state: OperatorState) => {
    if (state === current || mutation.isPending) return;
    mutation.mutate(state, {
      onError: (error) => void message.error(`${t('operator.stateFailed')}: ${getApiErrorMessage(error)}`),
    });
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
    </div>
  );
}

/** Yuqori qator o'ng tomoni: «Bronlarim: 1/5» va «14:37 Toshkent». */
export function OperatorBookingsClock() {
  const { t } = useTranslation();
  const leads = useOperatorLeadsQuery();
  const state = useOperatorStateQuery().data;
  const booked = leads.data?.filter((lead) => lead.status === 'BOOKED').length ?? state?.activeBookings ?? 0;
  const max = state?.maxBookings ?? DEFAULT_MAX_BOOKINGS;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={styles.meta}>
      <span>{t('operator.bookings')} <strong data-testid="operator-bookings">{booked}/{max}</strong></span>
      <time dateTime={new Date(now).toISOString()}><strong>{tashkentClock(now)}</strong> {t('operator.clock')}</time>
    </div>
  );
}
