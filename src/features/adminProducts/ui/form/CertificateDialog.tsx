import { App } from 'antd';
import { CircleCheck, CircleX, FileCheck, FileText, Lock, Trash2, Upload } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../../shared/ui/Dialog/Dialog';
import { useUploadCertificateMutation } from '../../api/adminProductsQueries';
import type { AdminProduct } from '../../model/adminProductTypes';
import dialogStyles from '../CreativeDialogs.module.css';

/** Taklif §10: PDF yoki skan (JPG, PNG), 10 MB gacha — TZ da turi va hajmi yo'q, server ham tekshiradi. */
const CERTIFICATE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const CERTIFICATE_MAX_MB = 10;

/**
 * «Sertifikat qo'shish» (admin-mahsulot-karta.holatlar 4, Ph10): bitta yopiq fayl va izoh. Admin moderatsiyada ko'radi,
 * sotuvchiga ko'rinmaydi. Yangi fayl eskisining o'rniga yoziladi.
 */
export function CertificateDialog({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const inputId = useId();
  const noteId = useId();
  const upload = useUploadCertificateMutation();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const problem = file
    ? !CERTIFICATE_TYPES.includes(file.type) ? t('upload.badType') : file.size > CERTIFICATE_MAX_MB * 1024 * 1024 ? t('upload.tooBig', { limit: `${CERTIFICATE_MAX_MB} MB` }) : null
    : null;

  const save = () => {
    if (!file || problem) return;
    upload.mutate({ id: product.id, file, note }, {
      onSuccess: () => {
        notification.success({ title: t('apf.certDialog.saved', { name: file.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('apf.certDialog.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    setFile(event.dataTransfer.files[0] ?? null);
  };

  return (
    <Dialog
      open
      title={t('apf.cert.add')}
      description={product.name}
      icon={<FileCheck />}
      tone="neutral"
      locked={upload.isPending}
      onClose={onClose}
      testId="certificate-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={upload.isPending}>{t('apf.footer.cancel')}</DialogCancel>
          <DialogPrimary onClick={save} disabled={!file || Boolean(problem)} saving={upload.isPending} savingLabel={t('apf.footer.saving')} shortcut={false}>
            {t('apf.footer.save')}
          </DialogPrimary>
        </>
      )}
    >
      <div className={dialogStyles.dropWrap}>
        {phone ? (
          <label htmlFor={inputId} className={dialogStyles.pickButton}><Upload aria-hidden />{t('apf.mediaDialog.pick')}</label>
        ) : (
          <label
            htmlFor={inputId}
            className={dialogStyles.drop}
            data-dragging={dragging || undefined}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className={dialogStyles.dropIcon} aria-hidden><Upload /></span>
            <span>{t('upload.drop')} <strong>{t('upload.choose')}</strong></span>
            <span className={dialogStyles.limits}>{t('apf.certDialog.limits')}</span>
          </label>
        )}
        <input
          id={inputId}
          type="file"
          accept={CERTIFICATE_TYPES.join(',')}
          className={dialogStyles.visuallyHidden}
          aria-label={t('apf.mediaDialog.pick')}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
      </div>
      {phone ? <span className={dialogStyles.limits}>{t('apf.certDialog.limits')}</span> : null}

      {file ? (
        <ul className={dialogStyles.fileList}>
          <li className={dialogStyles.fileRow} data-state={problem ? 'invalid' : 'uploaded'}>
            <span className={dialogStyles.fileIcon} aria-hidden><FileText /></span>
            <span className={dialogStyles.fileMain}>
              <span className={dialogStyles.fileName}>
                <span className={dialogStyles.lockName}>{file.name}<Lock aria-hidden /><span className={dialogStyles.visuallyHidden}>{t('apf.certDialog.private')}</span></span>
              </span>
              <span className={dialogStyles.fileStatus} role="status">
                {problem ? <><CircleX aria-hidden />{problem}</> : <><CircleCheck aria-hidden />{t('apf.certDialog.ready')}</>}
              </span>
            </span>
            <button type="button" className={dialogStyles.fileRemove} onClick={() => setFile(null)} disabled={upload.isPending} aria-label={t('upload.remove', { name: file.name })} title={t('upload.remove', { name: file.name })}>
              <Trash2 aria-hidden />
            </button>
          </li>
        </ul>
      ) : null}

      <div className={dialogStyles.field}>
        <label htmlFor={noteId} className={dialogStyles.label}>{t('apf.certDialog.note')}</label>
        <input id={noteId} className={dialogStyles.input} value={note} placeholder={t('apf.certDialog.notePlaceholder')} maxLength={200} onChange={(event) => setNote(event.target.value)} />
      </div>
      <p className={dialogStyles.note}>{t('apf.certDialog.text')} <span>{t('whs.tbd')}</span></p>
    </Dialog>
  );
}
