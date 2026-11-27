import { KeyRound, TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { CopyButton } from '../../../shared/ui/CopyButton/CopyButton';
import { Dialog, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import styles from './staffUi.module.css';

/**
 * Vaqtinchalik parol — bir marta (D4 «Vaqtinchalik parolni menga ko'rsatish»; xodim qo'shilganda SMS ketmagan bo'lsa —
 * backend parolni javobda bir marta qaytaradi, fe-15 §4). Oyna yopilgach parol hech qayerda saqlanmaydi.
 */
export function TemporaryPasswordDialog({ name, code, password, noSms, onClose }: { name: string; code: string; password: string; noSms: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      title={t('staff.tempPw.title')}
      description={t('staff.tempPw.sub', { name, code })}
      icon={<KeyRound />}
      width={440}
      onClose={onClose}
      testId="staff-temp-password"
      footer={<DialogPrimary onClick={onClose} shortcut={false}>{t('staff.tempPw.done')}</DialogPrimary>}
    >
      {noSms ? <p className={styles.noteWarning}><TriangleAlert aria-hidden /><span>{t('staff.tempPw.noSms')}</span></p> : null}
      <div className={styles.secret}>
        <span className={styles.secretLabel}>{t('staff.tempPw.label')}</span>
        <code data-testid="staff-temp-password-value">{password}</code>
        <CopyButton text={password} ariaLabel={t('staff.tempPw.copy')} successMessage={t('staff.tempPw.copied')} />
      </div>
      <p className={styles.dialogText}>{t('staff.tempPw.text')}</p>
    </Dialog>
  );
}
