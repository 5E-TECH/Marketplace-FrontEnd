import { App } from 'antd';
import { Check, CircleCheck, CircleX, Image as ImageIcon, Play, Trash2, TriangleAlert, Upload, Video, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { requestCreativeUpload, uploadCreativeFile } from '../api/adminProductsApi';
import { useConfirmCreativeMutation, useDeleteCreativeMutation } from '../api/adminProductsQueries';
import { CREATIVE_LIMITS } from '../lib/creativeLimits';
import { creativeLabel } from '../lib/productFormat';
import type { AdminProduct, Creative, CreativeType } from '../model/adminProductTypes';
import styles from './CreativeDialogs.module.css';

const AD_RULES = ['moderation.rule.cure', 'moderation.rule.reviews', 'moderation.rule.discount'] as const;

type UploadState =
  | { kind: 'idle' }
  | { kind: 'invalid'; file: File; message: string }
  | { kind: 'uploading'; file: File; percent: number }
  | { kind: 'uploaded'; file: File; objectKey: string }
  | { kind: 'failed'; file: File; message: string };

/**
 * «Kreativ yuklash» (admin-offer 3): turi, fayl (imzolangan POST bilan to'g'ridan-to'g'ri omborga, foiz bilan),
 * reklama qoidalari tekshiruvi; «Kutubxonaga qo'shish» — yuklangan faylni kreativ qilib tasdiqlash (BE-08).
 */
export function CreativeUploadDialog({ product, creatives, onClose }: { product: AdminProduct; creatives: readonly Creative[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const inputId = useId();
  const confirm = useConfirmCreativeMutation();
  const [type, setType] = useState<CreativeType>('VIDEO');
  const [state, setState] = useState<UploadState>({ kind: 'idle' });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const rules = [...AD_RULES, ...(product.isBad ? ['upload.badRequired' as const] : [])];
  const allChecked = rules.every((rule) => checks[rule]);
  const videos = creatives.filter((item) => item.type === 'VIDEO').length;

  useEffect(() => () => abort.current?.abort(), []);

  const start = async (file: File) => {
    const limit = CREATIVE_LIMITS[type];
    if (!limit.mimes.includes(file.type)) {
      setState({ kind: 'invalid', file, message: t('upload.badType') });
      return;
    }
    if (file.size > limit.maxMb * 1024 * 1024) {
      setState({ kind: 'invalid', file, message: t('upload.tooBig', { limit: `${limit.maxMb} MB` }) });
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ kind: 'uploading', file, percent: 0 });
    try {
      const policy = await requestCreativeUpload(product.id, { type, contentType: file.type, size: file.size });
      await uploadCreativeFile(policy, file, (percent) => setState({ kind: 'uploading', file, percent }), controller.signal);
      setState({ kind: 'uploaded', file, objectKey: policy.objectKey });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({ kind: 'failed', file, message: getApiErrorMessage(error) || t('upload.failed') });
    }
  };

  const add = () => {
    if (state.kind !== 'uploaded' || !allChecked) return;
    confirm.mutate({ productId: product.id, objectKey: state.objectKey }, {
      onSuccess: () => {
        notification.success({ title: t('upload.added'), placement: 'bottomRight', duration: 4 });
        onClose();
      },
      onError: (error) => setState({ kind: 'failed', file: state.file, message: getApiErrorMessage(error) }),
    });
  };

  const clear = () => {
    abort.current?.abort();
    setState({ kind: 'idle' });
  };

  const fileRow = state.kind === 'idle' ? null : (
    <div className={styles.fileRow} data-state={state.kind}>
      <span className={styles.fileIcon} aria-hidden>{type === 'VIDEO' ? <Video /> : <ImageIcon />}</span>
      <span className={styles.fileMain}>
        <span className={styles.fileName}>
          <span>{state.file.name}</span>
          <span>{(state.file.size / 1024 / 1024).toFixed(1)} MB</span>
        </span>
        {state.kind === 'uploading' ? (
          <span className={styles.progressLine}>
            <span className={styles.progressTrack} role="progressbar" aria-label={t('upload.uploading', { name: state.file.name })} aria-valuenow={state.percent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${state.percent}%` }} />
            </span>
            <span>{t('upload.progress', { percent: state.percent })}</span>
          </span>
        ) : (
          <span className={styles.fileStatus} role="status">
            {state.kind === 'uploaded' ? <><CircleCheck aria-hidden />{t('upload.done')}</> : <><CircleX aria-hidden />{state.message}</>}
          </span>
        )}
      </span>
      <button type="button" className={styles.fileRemove} onClick={clear} disabled={confirm.isPending} aria-label={t(state.kind === 'uploading' ? 'upload.stop' : 'upload.remove', { name: state.file.name })} title={t(state.kind === 'uploading' ? 'upload.stop' : 'upload.remove', { name: state.file.name })}>
        {state.kind === 'uploading' ? <X aria-hidden /> : <Trash2 aria-hidden />}
      </button>
    </div>
  );

  return (
    <Dialog
      open
      title={t('upload.title')}
      description={t('upload.subtitle', { name: product.name, videos, images: creatives.length - videos })}
      icon={<Upload />}
      width={560}
      locked={confirm.isPending}
      onClose={onClose}
      testId="upload-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={confirm.isPending}>{t('moderation.cancel')}</DialogCancel>
          <DialogPrimary onClick={add} disabled={state.kind !== 'uploaded' || !allChecked} saving={confirm.isPending} savingLabel={t('moderation.saving')} shortcut={false}>
            {t('upload.add')}
          </DialogPrimary>
        </>
      )}
    >
      <div>
        <p className={styles.label}>{t('upload.type')}</p>
        <div className={styles.segment} role="radiogroup" aria-label={t('upload.type')}>
          {(['VIDEO', 'IMAGE'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              disabled={state.kind === 'uploading'}
              onClick={() => { setType(value); setState({ kind: 'idle' }); }}
            >
              {value === 'VIDEO' ? <Video aria-hidden /> : <ImageIcon aria-hidden />}
              {t(value === 'VIDEO' ? 'upload.video' : 'upload.image')}
            </button>
          ))}
        </div>
      </div>
      <label
        htmlFor={inputId}
        className={styles.drop}
        data-dragging={dragging || undefined}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void start(file);
        }}
      >
        <span className={styles.dropIcon} aria-hidden><Upload /></span>
        <span>{t('upload.drop')} <strong>{t('upload.choose')}</strong></span>
        <span className={styles.limits}>{t(`upload.limits.${type}` as TranslationKey)}</span>
        <input
          id={inputId}
          type="file"
          accept={CREATIVE_LIMITS[type].accept}
          className={styles.visuallyHidden}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void start(file);
          }}
        />
      </label>
      {fileRow}
      <div className={styles.rulesBox}>
        <fieldset className={styles.rules}>
          <legend>{t('upload.rules')}</legend>
          {rules.map((rule) => (
            <label key={rule} className={styles.rule}>
              <span className={styles.checkBox}>
                <input type="checkbox" checked={Boolean(checks[rule])} onChange={(event) => setChecks({ ...checks, [rule]: event.target.checked })} />
                {checks[rule] ? <Check aria-hidden /> : null}
              </span>
              <span>{t(rule)}</span>
            </label>
          ))}
          {product.isBad ? null : <p className={styles.hint}>{t('upload.badNote')}</p>}
        </fieldset>
      </div>
      <p className={styles.note}>{t('upload.after')}</p>
    </Dialog>
  );
}

/**
 * «Kreativni o'chirasizmi?» (admin-offer 3): kreativ, tasdiqlangan vaqti va holati; yagona video bo'lsa — offer
 * sotuvchilarga yopilishi haqida ogohlantirish. Sabab majburiy (taklif: `DELETE` tanasida, audit uchun).
 */
export function DeleteCreativeDialog({ product, creative, creatives, onClose }: { product: AdminProduct; creative: Creative; creatives: readonly Creative[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const reasonId = useId();
  const remove = useDeleteCreativeMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const lastVideo = creative.type === 'VIDEO' && creatives.filter((item) => item.type === 'VIDEO').length === 1;
  const label = creativeLabel(creative, creatives, t);
  const submit = () => {
    setTouched(true);
    if (!reason.trim() || remove.isPending) return;
    remove.mutate({ productId: product.id, creativeId: creative.id, reason: reason.trim() }, {
      onSuccess: () => {
        notification.success({ title: t('delete.done'), placement: 'bottomRight', duration: 4 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('stop.error'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
    });
  };
  return (
    <Dialog
      open
      title={t('delete.title')}
      description={t('delete.subtitle', { name: product.name, creative: label })}
      icon={<Trash2 />}
      tone="danger"
      locked={remove.isPending}
      onClose={onClose}
      testId="delete-creative-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={remove.isPending}>{t('moderation.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} icon={<Trash2 aria-hidden />} saving={remove.isPending} savingLabel={t('moderation.saving')} shortcut={false} danger>{t('delete.confirm')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.creativeFacts}>
        <span className={styles.creativeThumb} aria-hidden>
          {creative.type === 'VIDEO' ? <Play /> : <ImageIcon />}
          {creative.type === 'IMAGE' ? <SafeImage src={creative.url} alt="" /> : null}
        </span>
        <dl>
          <div><dt>{t('delete.creative')}</dt><dd>{label}</dd></div>
          <div><dt>{t('delete.added')}</dt><dd>{tashkentDateTime(creative.createdAt)}</dd></div>
          <div><dt>{t('delete.state')}</dt><dd>{t(lastVideo ? 'delete.stateLastVideo' : 'delete.stateInLibrary')}</dd></div>
        </dl>
      </div>
      {lastVideo ? (
        <div className={styles.warning} role="note">
          <TriangleAlert aria-hidden />
          <div>
            <p>{t('delete.lastVideoTitle')}</p>
            <p>{t('delete.lastVideo')}</p>
          </div>
        </div>
      ) : null}
      <div>
        <label htmlFor={reasonId} className={styles.label}>{t('delete.reason')} <span className={styles.required} aria-hidden>*</span></label>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={500}
          aria-invalid={(touched && !reason.trim()) || undefined}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className={styles.hint}>{t('delete.reasonHint')}</p>
      </div>
    </Dialog>
  );
}
