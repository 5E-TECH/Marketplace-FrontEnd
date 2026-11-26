import { Download, KeyRound } from 'lucide-react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../../shared/ui/Dialog/Dialog';
import styles from './TwoFactor.module.css';

/**
 * «Kodlarni saqladingizmi?» (umumiy-2fa-ulash.holatlar 3, 7): belgisiz «Panelga o'tish» bosilganda. Telefonda varaq,
 * «Saqladim, davom etish» → «Saqladim» (360 px da yarim kenglikka sig'adi).
 */
export function SaveCodesDialog({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  return (
    <Dialog
      open
      title={t('tfa.saveDialogTitle')}
      description={t('tfa.saveDialogSubtitle')}
      icon={<KeyRound />}
      tone="warning"
      width={440}
      onClose={onBack}
      testId="tfa-save-dialog"
      footer={(
        <>
          <DialogCancel onClick={onBack}>{t('common.back')}</DialogCancel>
          <DialogPrimary onClick={onConfirm} shortcut={false}>{t(phone ? 'tfa.savedShort' : 'tfa.savedContinue')}</DialogPrimary>
        </>
      )}
    >
      <p className={styles.dialogText}>{t('tfa.saveDialogText')}</p>
      <div className={styles.infoNote} role="note">
        <Download aria-hidden />
        <div>
          <p className={styles.noteTitle}>{t('tfa.saveDialogNoteTitle')}</p>
          <p className={styles.noteText}>{t('tfa.saveDialogNoteText')}</p>
        </div>
      </div>
    </Dialog>
  );
}
