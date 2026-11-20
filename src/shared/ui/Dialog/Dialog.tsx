import { Info, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { SheetModal } from '../SheetModal/SheetModal';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon: ReactNode;
  tone?: 'action' | 'danger' | 'warning' | 'neutral';
  width?: number;
  /** Saqlanmoqda — yopilmaydi (operator-natija 15). */
  locked?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
}

/**
 * Oyna (komponentlar-E §32; operator-natija, sotuvchi-offer oynalari): ikonka doirasi, sarlavha, izoh
 * va yopish; pastda chiziq va tugmalar. Desktopda markazda, telefonda pastdan varaq.
 */
export function Dialog({ open, title, description, icon, tone = 'action', width = 480, locked = false, onClose, footer, children, testId }: DialogProps) {
  const { t } = useTranslation();
  return (
    <SheetModal
      open={open}
      onCancel={locked ? undefined : onClose}
      closable={false}
      mask={{ closable: !locked }}
      keyboard={!locked}
      footer={null}
      title={title}
      width={width}
      destroyOnHidden
      rootClassName={styles.root}
    >
      <div className={styles.dialog} data-testid={testId}>
        <div className={styles.head}>
          <span className={styles.icon} data-tone={tone} aria-hidden>{icon}</span>
          <div className={styles.headText}>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className={styles.close} aria-label={t('dialog.close')} title={t('dialog.close')} onClick={onClose} disabled={locked}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </SheetModal>
  );
}

export function DialogHint({ children }: { children: ReactNode }) {
  return <span className={styles.footerHint}><Info size={14} aria-hidden />{children}</span>;
}

export function DialogCancel({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

/** Asosiy tugma: «Saqlanmoqda…» aylanuvchi ikonka bilan; yoqilganda Ctrl+Enter belgisi. */
export function DialogPrimary({ onClick, disabled, saving, savingLabel, icon, shortcut = true, children }: {
  onClick: () => void;
  disabled?: boolean;
  saving?: boolean;
  savingLabel?: string;
  icon?: ReactNode;
  shortcut?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles.primary}`}
      onClick={onClick}
      disabled={disabled || saving}
      aria-busy={saving || undefined}
      aria-keyshortcuts={shortcut ? 'Control+Enter' : undefined}
    >
      {saving ? <LoaderCircle className={styles.spin} aria-hidden /> : icon}
      {saving ? savingLabel : children}
      {shortcut && !saving && !disabled ? <kbd className={styles.kbd}>Ctrl+Enter</kbd> : null}
    </button>
  );
}
