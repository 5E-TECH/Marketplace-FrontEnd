import { CircleCheck } from 'lucide-react';
import { ROLE_LABEL_KEYS } from '../../../../features/auth/lib/roleLabels';
import type { TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { initials } from '../../../../shared/lib/initials';
import { shortPersonName } from '../../../../shared/lib/personName';
import { formatUzPhone } from '../../../../shared/lib/phone';
import styles from './TwoFactor.module.css';

/**
 * Kim kirayapti (umumiy-2fa, umumiy-2fa-ulash): «Nodira K. · Admin», «Parol tekshirildi», o'ngda «Boshqa hisob» yoki
 * «Chiqish». Ism va rol — taklif (fe-27 §2); kelmasa telefon raqami.
 */
export function IdentityCard({ challenge, actionLabel, onAction }: { challenge: TwoFactorChallenge; actionLabel: string; onAction: () => void }) {
  const { t } = useTranslation();
  const name = challenge.user ? shortPersonName(challenge.user.name) : formatUzPhone(challenge.phone);
  return (
    <div className={styles.identity} data-testid="tfa-identity">
      <span className={styles.avatar} aria-hidden>{challenge.user ? initials(challenge.user.name) : '••'}</span>
      <span className={styles.identityText}>
        <span className={styles.identityName}>
          {name}
          {challenge.user ? <span> · {t(ROLE_LABEL_KEYS[challenge.user.role])}</span> : null}
        </span>
        <span className={styles.checked}><CircleCheck aria-hidden />{t('tfa.passwordChecked')}</span>
      </span>
      <button type="button" className={styles.textButton} onClick={onAction}>{actionLabel}</button>
    </div>
  );
}
