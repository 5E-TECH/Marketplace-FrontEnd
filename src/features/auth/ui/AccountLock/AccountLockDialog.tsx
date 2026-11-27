import { useQueryClient } from '@tanstack/react-query';
import { Ban, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../../app/store/hooks';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../../shared/lib/personName';
import { SheetModal } from '../../../../shared/ui/SheetModal/SheetModal';
import { ACCOUNT_BLOCKED_PATH, isSellerLock, type AccountLock } from '../../lib/accountLock';
import { lockDecision, lockHeldText, lockReasonLine } from '../../lib/accountLockView';
import { loggedOut } from '../../model/authSlice';
import sessionStyles from '../SessionExpiredDialog/SessionExpiredDialog.module.css';
import styles from './AccountLock.module.css';

/**
 * «Hisobingiz bloklandi» (umumiy-sessiya 6, 14): sahifa ochiq turganda keyingi so'rov 401 — majburiy oyna ustida.
 * × va fonga bosish yo'q; «Chiqish» — login sahifasi, «Batafsil» — karkassiz sahifa (sabab, pul, murojaat).
 */
export function AccountLockDialog({ lock }: { lock: AccountLock }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const seller = isSellerLock(lock);
  const title = t(lock.kind === 'INACTIVE' ? 'lock.dialog.inactiveTitle' : 'lock.dialog.blockedTitle');
  const held = lockHeldText(lock, t);
  const rows = [
    { key: 'reason', label: t('lock.reason'), value: lockReasonLine(lock) },
    { key: 'pages', label: t('lock.pages'), value: seller && lock.seller?.pagesStopped ? t('lock.pagesStopped') : null },
    { key: 'held', label: t('lock.held'), value: held },
    { key: 'supervisor', label: t('lock.supervisor'), value: seller || !lock.supervisorName ? null : shortPersonName(lock.supervisorName) },
  ].filter((row): row is { key: string; label: string; value: string } => Boolean(row.value));
  const note = seller ? (lock.basis ? t('lock.note', { basis: lock.basis }) : null) : t('lock.noteStaff');

  const signOut = () => {
    queryClient.clear();
    dispatch(loggedOut({ manual: true }));
  };

  return (
    <SheetModal
      open
      width={440}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      title={title}
      rootClassName={`${sessionStyles.root} ${styles.dialogRoot}`}
      aria-describedby="account-lock-when"
    >
      <div className={sessionStyles.dialog} data-testid="account-lock-dialog">
        <div className={sessionStyles.head}>
          <span className={`${sessionStyles.icon} ${styles.dangerIcon}`} aria-hidden><Ban /></span>
          <div className={sessionStyles.headText}>
            <h3>{title}</h3>
            <p id="account-lock-when">{lockDecision(lock, t)}</p>
          </div>
        </div>
        {rows.length ? (
          <dl className={styles.dialogFacts}>
            {rows.map((row) => (
              <div key={row.key}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {note ? <p className={styles.note}>{note}</p> : null}
        <div className={sessionStyles.actions}>
          <button type="button" className={`${sessionStyles.button} ${sessionStyles.secondary}`} onClick={signOut}>
            <LogOut aria-hidden />
            {t('lock.signOut')}
          </button>
          <button type="button" className={`${sessionStyles.button} ${sessionStyles.primary}`} onClick={() => void navigate(ACCOUNT_BLOCKED_PATH)}>
            {t('lock.details')}
          </button>
        </div>
      </div>
    </SheetModal>
  );
}
