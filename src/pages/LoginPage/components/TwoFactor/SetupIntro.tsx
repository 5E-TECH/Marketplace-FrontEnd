import { Button } from 'antd';
import { ArrowRight, Info } from 'lucide-react';
import { ROLE_LABEL_KEYS } from '../../../../features/auth/lib/roleLabels';
import type { TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import authStyles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import { IdentityCard } from './IdentityCard';
import styles from './TwoFactor.module.css';

/**
 * «Avval ilovani ulang» (umumiy-2fa.holatlar 4): 2FA hali ulanmagan — birinchi kirish yoki superadmin tiklagan.
 * «Ilovani ulash» — umumiy-2fa-ulash (QR, kalit, kod).
 */
export function SetupIntro({ challenge, onStart, onOtherAccount }: { challenge: TwoFactorChallenge; onStart: () => void; onOtherAccount: () => void }) {
  const { t } = useTranslation();
  const role = challenge.user ? t(ROLE_LABEL_KEYS[challenge.user.role]) : t('tfa.setupIntroRoleFallback');
  return (
    <div className={authStyles.form} data-testid="tfa-setup-intro">
      <IdentityCard challenge={challenge} actionLabel={t('tfa.otherAccount')} onAction={onOtherAccount} />
      <div className={styles.heading}>
        <h1 id="tfa-title" className={authStyles.title}>{t('tfa.setupIntroTitle')}</h1>
        <p className={styles.lead}>{t('tfa.setupIntroText', { role })}</p>
      </div>
      <div className={styles.infoNote} role="note">
        <Info aria-hidden />
        <div>
          <p className={styles.noteTitle}>{t('tfa.setupBeforeTitle')}</p>
          <p className={styles.noteText}>{t('tfa.setupBeforeText')}</p>
        </div>
      </div>
      <Button className={authStyles.submit} type="primary" block icon={<ArrowRight size={18} aria-hidden />} iconPlacement="end" onClick={onStart}>{t('tfa.setupStart')}</Button>
      <p className={styles.plain}>
        <button type="button" className={styles.textButton} onClick={onOtherAccount}>{t('tfa.signOut')}</button>
      </p>
    </div>
  );
}
