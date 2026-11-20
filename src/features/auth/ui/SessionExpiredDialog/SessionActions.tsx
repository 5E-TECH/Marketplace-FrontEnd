import { LoaderCircle, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import styles from './SessionExpiredDialog.module.css';

/** Oyna osti (umumiy-sessiya): chiziq ustida o'ngda «Chiqish» (ikonka bilan) va asosiy amal. */
export function SessionActions({ onSignOut, children }: { onSignOut: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={styles.actions}>
      <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onSignOut}>
        <LogOut aria-hidden />
        {t('session.logout')}
      </button>
      {children}
    </div>
  );
}

export function SessionPrimary({ submit = false, busy = false, onClick, children }: {
  submit?: boolean;
  busy?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      className={`${styles.button} ${styles.primary}`}
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
    >
      {busy ? <LoaderCircle className={styles.spin} aria-hidden /> : null}
      {children}
    </button>
  );
}
