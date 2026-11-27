import { ShieldAlert, Smartphone } from 'lucide-react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../../shared/ui/Dialog/Dialog';
import styles from './LostPhoneDialog.module.css';

/**
 * «Telefoningiz yo'qoldimi?» (umumiy-2fa.holatlar 5–6): zaxira kod yoki superadmin tiklaydi (FE-15 «2FA ni tiklash»).
 * Telefonda varaq va bitta tugma — «Yopish» o'rnini × va pastga surish egallaydi.
 */
export function LostPhoneDialog({ onClose, onUseRecovery }: { onClose: () => void; onUseRecovery: () => void }) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  return (
    <Dialog
      open
      title={t('tfa.lostTitle')}
      description={t('tfa.lostSubtitle')}
      icon={<Smartphone />}
      tone="warning"
      width={440}
      onClose={onClose}
      testId="tfa-lost-dialog"
      footer={(
        <>
          {phone ? null : <DialogCancel onClick={onClose}>{t('tfa.close')}</DialogCancel>}
          <DialogPrimary onClick={onUseRecovery} shortcut={false}>{t('tfa.useRecovery')}</DialogPrimary>
        </>
      )}
    >
      <ol className={styles.steps}>
        <li>
          <span className={styles.stepNumber} aria-hidden>1</span>
          <div>
            <p className={styles.stepTitle}>{t('tfa.lostStep1')}</p>
            <p className={styles.stepText}>{t('tfa.lostStep1Text')}</p>
          </div>
        </li>
        <li>
          <span className={styles.stepNumber} aria-hidden>2</span>
          <div>
            <p className={styles.stepTitle}>{t('tfa.lostStep2')}</p>
            <p className={styles.stepText}>{t('tfa.lostStep2Text')}</p>
          </div>
        </li>
      </ol>
      <div className={styles.warnNote} role="note">
        <ShieldAlert aria-hidden />
        <div>
          <p className={styles.noteTitle}>{t('tfa.lostWarnTitle')}</p>
          <p className={styles.noteText}>{t('tfa.lostWarnText')} <span className={styles.tbd}>{t('tfa.tbdDecision')}</span></p>
        </div>
      </div>
    </Dialog>
  );
}
