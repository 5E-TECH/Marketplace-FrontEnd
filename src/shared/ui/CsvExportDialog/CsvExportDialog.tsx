import { App } from 'antd';
import { CircleAlert, Download, FileSpreadsheet, Shield } from 'lucide-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../../api/apiError';
import { rich } from '../../i18n/richText';
import { useTranslation } from '../../i18n/useTranslation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { CheckBox, RadioDot } from '../CheckBox/CheckBox';
import { Dialog, DialogCancel, DialogPrimary } from '../Dialog/Dialog';
import styles from './CsvExportDialog.module.css';

export type CsvPhoneMode = 'LAST4' | 'FULL';

interface CsvExportDialogProps<C extends string> {
  /** «Lidlarni CSV faylga yuklab olish». */
  title: string;
  /** Joriy filtrlar matni: «Simsiz quloqchinlar · 08.01–14.01.2027 · hamma holat». */
  summary: string;
  /** Qatorlar soni birligi bilan: «240 ta lid», «102 ta buyurtma». */
  countLabel: string;
  columns: ReadonlyArray<{ key: C; label: string }>;
  defaultColumns: readonly C[];
  /** Telefon ustuni kaliti — tanlansa «Telefon raqami faylda» savoli chiqadi. */
  phoneColumn?: C;
  /** «****6619» — oxirgi 4 raqam namunasi. */
  phoneExample: string;
  fileName: string;
  /** Eksportni boshlaydi (fon ishi); javobda qator soni. */
  onExport: (input: { columns: C[]; phone: CsvPhoneMode }) => Promise<{ rows: number }>;
  onClose: () => void;
  testId?: string;
}

/**
 * CSV eksport oynasi (admin-lidlar, admin-buyurtmalar; faqat admin): joriy filtrlar, ustunlar, telefon raqami
 * ko'rinishi; fayl fon ishida tayyorlanadi va bildirishnoma keladi, eksport audit jurnaliga yoziladi.
 */
export function CsvExportDialog<C extends string>({ title, summary, countLabel, columns, defaultColumns, phoneColumn, phoneExample, fileName, onExport, onClose, testId }: CsvExportDialogProps<C>) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [picked, setPicked] = useState<ReadonlySet<C>>(() => new Set(defaultColumns));
  const [phoneMode, setPhoneMode] = useState<CsvPhoneMode>('LAST4');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const empty = picked.size === 0;

  const toggle = (column: C, checked: boolean) => {
    const next = new Set(picked);
    if (checked) next.add(column);
    else next.delete(column);
    setPicked(next);
  };

  const submit = async () => {
    setTouched(true);
    if (empty || pending) return;
    setPending(true);
    try {
      const { rows } = await onExport({ columns: columns.map((column) => column.key).filter((key) => picked.has(key)), phone: phoneMode });
      notification.info({ title: t('csv.done'), description: t('csv.doneText', { count: rows }), placement: phone ? 'top' : 'bottomRight', duration: 6 });
      onClose();
    } catch (error) {
      notification.error({ title: t('csv.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      title={title}
      description={t('csv.desc')}
      icon={<Download />}
      locked={pending}
      onClose={onClose}
      testId={testId}
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={pending}>{t('csv.cancel')}</DialogCancel>
          <DialogPrimary onClick={() => void submit()} saving={pending} savingLabel={t('csv.saving')} shortcut={false} icon={<Download />} disabled={touched && empty}>
            {t('csv.submit')}
          </DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.box}>
          <p>{rich(t('csv.current', { count: countLabel }), { filters: <strong>{summary}</strong> })}</p>
        </div>
        <fieldset className={styles.fieldset}>
          <legend>{t('csv.columns')}</legend>
          <div className={styles.columns}>
            {columns.map((column) => (
              <label key={column.key} className={styles.option}>
                <CheckBox checked={picked.has(column.key)} onChange={(event) => toggle(column.key, event.target.checked)} />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
          {touched && empty ? <p className={styles.error}><CircleAlert aria-hidden />{t('csv.columnsError')}</p> : null}
        </fieldset>
        {!phoneColumn || picked.has(phoneColumn) ? (
          <fieldset className={styles.fieldset}>
            <legend>{t('csv.phone')}</legend>
            <div className={styles.radios}>
              <label className={styles.option}>
                <RadioDot name="csv-phone" checked={phoneMode === 'LAST4'} onChange={() => setPhoneMode('LAST4')} />
                <span>{rich(t('csv.phoneLast4'), { example: <strong>{phoneExample}</strong> })}</span>
              </label>
              <label className={styles.option}>
                <RadioDot name="csv-phone" checked={phoneMode === 'FULL'} onChange={() => setPhoneMode('FULL')} />
                <span>{t('csv.phoneFull')}</span>
              </label>
            </div>
          </fieldset>
        ) : null}
        <p className={styles.hint}><Shield aria-hidden />{t('csv.audit')}</p>
        <p className={styles.hint}><FileSpreadsheet aria-hidden />{t('csv.file', { name: fileName })}</p>
      </div>
    </Dialog>
  );
}
