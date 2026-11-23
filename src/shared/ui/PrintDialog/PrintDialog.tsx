import { Button } from 'antd';
import { Download, Info, Printer } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getApiErrorMessage } from '../../api/apiError';
import { saveBlob, type FetchedFile } from '../../api/download';
import { useTranslation } from '../../i18n/useTranslation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Dialog } from '../Dialog/Dialog';
import styles from './PrintDialog.module.css';

interface PrintDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Hujjatni serverdan olib keladi (yorliq, akt) yoki brauzerda yasaydi. */
  load: () => Promise<FetchedFile>;
  /** O'ngdagi ma'lumot: «Buyurtma — L-1233 · Zarina». */
  facts?: readonly (readonly [string, ReactNode])[];
  /** Ko'k izoh (masalan, qayta chop etish qoidasi). */
  note?: { title: string; text: ReactNode } | null;
  /** Qayta chop etish — tugma matni boshqa. */
  reprint?: boolean;
  /** Oldindan ko'rish ostidagi izoh: o'lcham, format. */
  previewCaption?: ReactNode;
  onClose: () => void;
  /** Chop etish oynasi ochildi yoki PDF yuklab olindi — hujjat qo'lda (masalan, «Qadoqlandi» ochiladi). */
  onDone?: () => void;
  testId?: string;
}

type State = { status: 'loading' } | { status: 'ready'; file: FetchedFile; url: string } | { status: 'error'; message: string };

/**
 * Chop etish oynasi (umumiy-chop-etish, komponentlar-E §26). Kerak bo'lganda chiziladi (`{open ? <PrintDialog/> : null}`):
 * hujjat har ochilishda qayta olinadi. Brauzerda printer ro'yxati yo'q: «Chop etish» tizimning
 * chop etish oynasini ochadi — printer va nusxa o'sha yerda (dizayn: «Ofis kompyuterida…»). Telefonda — faqat PDF.
 */
export function PrintDialog({ open, title, description, load, facts = [], note = null, reprint = false, previewCaption, onClose, onDone, testId }: PrintDialogProps) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<State>({ status: 'loading' });
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (!open) return undefined;
    let url: string | null = null;
    let alive = true;
    loader.current()
      .then((file) => {
        url = URL.createObjectURL(file.blob);
        if (alive) setState({ status: 'ready', file, url });
      })
      .catch((error: unknown) => {
        if (alive) setState({ status: 'error', message: getApiErrorMessage(error) });
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open]);

  const ready = state.status === 'ready' ? state : null;
  const download = () => {
    if (!ready) return;
    saveBlob(ready.file.blob, ready.file.fileName);
    onDone?.();
  };
  const print = () => {
    const view = frame.current?.contentWindow;
    if (!view) return;
    view.focus();
    view.print();
    onDone?.();
  };

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      icon={<Printer size={20} />}
      tone="neutral"
      width={760}
      onClose={onClose}
      testId={testId}
      footer={(
        <>
          {phone ? <Button size="large" onClick={onClose}>{t('print.close')}</Button> : null}
          <Button size="large" icon={<Download size={16} />} disabled={!ready} onClick={download}>{t('print.pdf')}</Button>
          {phone ? null : (
            <Button size="large" type="primary" icon={<Printer size={16} />} disabled={!ready} onClick={print}>
              {t(reprint ? 'print.reprint' : 'print.print')}
            </Button>
          )}
        </>
      )}
    >
      <div className={styles.layout}>
        <div className={styles.preview}>
          {ready ? <iframe ref={frame} src={`${ready.url}#toolbar=0&navpanes=0&view=FitH`} title={t('print.preview', { name: title })} data-testid="print-preview" />
            : <div className={styles.placeholder} data-tone={state.status === 'error' ? 'danger' : undefined} role={state.status === 'error' ? 'alert' : 'status'}>
              {state.status === 'error' ? state.message : t('print.loading')}
            </div>}
          {previewCaption ? <span>{previewCaption}</span> : null}
        </div>
        <div className={styles.side}>
          {facts.length ? (
            <dl className={styles.facts}>
              {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          ) : null}
          {note ? (
            <div className={styles.note} role="note">
              <Info aria-hidden />
              <div><strong>{note.title}</strong><p>{note.text}</p></div>
            </div>
          ) : null}
          <p className={styles.hint}>{t(phone ? 'print.phoneHint' : 'print.systemHint')}</p>
        </div>
      </div>
    </Dialog>
  );
}
