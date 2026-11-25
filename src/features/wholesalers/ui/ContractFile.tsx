import { CircleCheck, CircleX, FileText, Lock, Trash2, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import type { ContractFileError } from '../lib/wholesalerRules';
import styles from './WholesalerUi.module.css';

const typeLabel = (file: File) => (file.type === 'application/pdf' ? 'PDF' : file.type === 'image/png' ? 'PNG' : 'JPG');

interface ContractFileProps {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Telefonda tashlash yo'q — «Fayl tanlash» tugmasi (holatlar R7). */
  phone: boolean;
  error?: ContractFileError | null;
  label?: string;
}

/**
 * Komissiya shartnomasi skani (admin-optovik-karta: yangi optovik, «Shartnoma yuklash» oynasi, shartnomasiz karta):
 * tashlash maydoni yoki «Fayl tanlash», tanlangandan keyin — fayl qatori (yopiq fayl, o'chirish).
 */
export function ContractFile({ file, onChange, phone, error, label }: ContractFileProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = useId();
  const [dragging, setDragging] = useState(false);
  const pick = (next: File | undefined) => {
    if (next) onChange(next);
  };
  const input = (
    <input
      id={inputId}
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
      className={styles.visuallyHidden}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      onChange={(event) => {
        pick(event.target.files?.[0]);
        event.target.value = '';
      }}
    />
  );
  const errorLine = error ? <p className={styles.error} id={errorId}><CircleX aria-hidden />{t(`whd.file.${error}`)}</p> : null;

  if (file) {
    return (
      <div>
        <div className={styles.fileRow} data-testid="contract-file">
          <span className={styles.fileIcon} aria-hidden><FileText /></span>
          <span className={styles.fileBody}>
            <span className={styles.fileTop}>
              <span className={styles.fileName}>{file.name}</span>
              <Lock aria-hidden />
              <span className={styles.visuallyHidden}>{t('whd.file.private')}</span>
              <span className={styles.fileMeta}>{typeLabel(file)}</span>
            </span>
            {error ? null : <span className={styles.fileState}><CircleCheck aria-hidden />{t('whd.file.ready')}</span>}
          </span>
          <button type="button" className={styles.iconButton} aria-label={t('whd.file.remove', { name: file.name })} title={t('whd.file.remove', { name: file.name })} onClick={() => onChange(null)}>
            <Trash2 aria-hidden />
          </button>
        </div>
        {errorLine}
      </div>
    );
  }

  if (phone) {
    return (
      <div>
        <label htmlFor={inputId} className={styles.pickButton}><Upload aria-hidden />{t('whd.file.pick')}</label>
        {input}
        <p className={styles.hint}>{t('whd.file.limits')}</p>
        {errorLine}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className={styles.drop}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        data-dragging={dragging || undefined}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files[0]);
        }}
      >
        <span className={styles.dropIcon} aria-hidden><Upload /></span>
        <span>{t('whd.file.drop')} <strong>{t('whd.file.choose')}</strong></span>
        <span className={styles.limits}>{t('whd.file.limits')}</span>
      </label>
      {input}
      {errorLine}
    </div>
  );
}
