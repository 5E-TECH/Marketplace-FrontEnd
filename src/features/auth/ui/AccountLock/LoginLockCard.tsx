import { Ban } from 'lucide-react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../../shared/lib/personName';
import type { AccountLock } from '../../lib/accountLock';
import { lockAccountLine, lockDate } from '../../lib/accountLockView';
import styles from './AccountLock.module.css';

/**
 * Xodim kirishda: parol to'g'ri, hisob bloklangan yoki nofaol (umumiy-kirish 12). Backend tafsilot bermasa
 * (hozir faqat «Hisobingiz bloklangan» matni) — «Hisob» qatorida kiritilgan raqam, qolgan qatorlar yo'q.
 */
export function LoginLockCard({ lock }: { lock: AccountLock }) {
  const { t } = useTranslation();
  const inactive = lock.kind === 'INACTIVE';
  const date = lockDate(lock);
  const rows = [
    { key: 'account', label: t('lock.account'), value: lockAccountLine(lock, t, false) },
    { key: 'at', label: t(inactive ? 'lock.inactiveAt' : 'lock.blockedAt'), value: date },
    { key: 'reason', label: t('lock.reason'), value: inactive ? lock.reason : null },
    { key: 'ask', label: t('lock.login.ask'), value: lock.supervisorName ? t('lock.login.askSupervisor', { name: shortPersonName(lock.supervisorName) }) : null },
  ].filter((row): row is { key: string; label: string; value: string } => Boolean(row.value));
  return (
    <div className={styles.loginCard} role="alert" data-testid="login-lock">
      <div className={styles.loginHead}>
        <span className={styles.loginIcon} aria-hidden><Ban /></span>
        <div>
          <p className={styles.loginTitle}>{t(inactive ? 'lock.login.inactiveTitle' : 'lock.login.blockedTitle')}</p>
          <p className={styles.loginText}>{t(inactive ? 'lock.login.inactiveText' : 'lock.login.blockedText')}</p>
        </div>
      </div>
      <dl className={styles.loginFacts}>
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
