import { App } from 'antd';
import { Check, CircleCheck, CircleX, Image as ImageIcon, ImagePlus, Trash2, Upload, Video, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../../shared/ui/Dialog/Dialog';
import { requestCreativeUpload, uploadCreativeFile, uploadProductMedia } from '../../api/adminProductsApi';
import { useConfirmCreativeMutation, useSetMainImageMutation } from '../../api/adminProductsQueries';
import { checkMediaFile, MEDIA_ACCEPT } from '../../lib/creativeLimits';
import type { AdminProduct, CreativeType } from '../../model/adminProductTypes';
import dialogStyles from '../CreativeDialogs.module.css';

export interface AddedMedia {
  url: string;
  type: CreativeType;
}

type Item =
  | { id: string; file: File; status: 'invalid'; message: string }
  | { id: string; file: File; type: CreativeType; status: 'uploading'; percent: number }
  | { id: string; file: File; type: CreativeType; status: 'uploaded'; url: string | null; objectKey: string | null }
  | { id: string; file: File; type: CreativeType; status: 'failed'; message: string };

interface Props {
  /** `null` — yangi mahsulot: fayl taklif §9 `POST /admin/products/media` ga, URL formaga qo'shiladi. */
  product: AdminProduct | null;
  productName: string;
  counts: { videos: number; images: number };
  /** Kataklardagi «Qo'shish» bilan tanlangan fayllar — oyna ochilishi bilan yuklana boshlaydi. */
  initialFiles?: readonly File[];
  /** Yangi mahsulot: yuklangan fayllar formaga. */
  onAdded?: (media: AddedMedia[], makeMain: boolean) => void;
  onClose: () => void;
}

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return `media-${sequence}`;
};

/**
 * «Rasm va video qo'shish» (admin-mahsulot-karta.holatlar 4; Ph7): bir nechta fayl, har biri — yuklanmoqda (foiz,
 * to'xtatish), yuklandi, noto'g'ri tur, katta hajm. Saqlangan mahsulotda — BE-08 kreativ (imzolangan POST + tasdiq),
 * «Yuklangan rasmni asosiy qilish» — BE-07 PATCH `imageUrl`. Telefonda sudrash yo'q — «Fayl tanlash».
 */
export function ProductMediaDialog({ product, productName, counts, initialFiles, onAdded, onClose }: Props) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const inputId = useId();
  const confirm = useConfirmCreativeMutation();
  const setMain = useSetMainImageMutation();
  const [items, setItems] = useState<Item[]>([]);
  const [makeMain, setMakeMain] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const started = useRef(false);

  const update = (id: string, next: Item) => setItems((current) => current.map((item) => (item.id === id ? next : item)));

  const upload = async (id: string, file: File, type: CreativeType) => {
    const controller = new AbortController();
    controllers.current.set(id, controller);
    const progress = (percent: number) => update(id, { id, file, type, status: 'uploading', percent });
    try {
      if (product) {
        const policy = await requestCreativeUpload(product.id, { type, contentType: file.type, size: file.size });
        await uploadCreativeFile(policy, file, progress, controller.signal);
        update(id, { id, file, type, status: 'uploaded', url: null, objectKey: policy.objectKey });
      } else {
        const media = await uploadProductMedia(file, progress, controller.signal);
        update(id, { id, file, type, status: 'uploaded', url: media.url, objectKey: null });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      update(id, { id, file, type, status: 'failed', message: getApiErrorMessage(error) || t('upload.failed') });
    } finally {
      controllers.current.delete(id);
    }
  };

  const addFiles = (files: readonly File[]) => {
    const fresh: Item[] = files.map((file) => {
      const check = checkMediaFile(file);
      const id = nextId();
      if (!check.ok) return { id, file, status: 'invalid', message: check.reason === 'type' ? t('upload.badType') : t('upload.tooBig', { limit: `${check.limitMb} MB` }) };
      return { id, file, type: check.type, status: 'uploading', percent: 0 };
    });
    setItems((current) => [...current, ...fresh]);
    fresh.forEach((item) => {
      if (item.status === 'uploading') void upload(item.id, item.file, item.type);
    });
  };

  // Kataklardan tanlangan fayllar — bir marta (StrictMode da effekt ikki marta ishlaydi).
  useEffect(() => {
    if (started.current || !initialFiles?.length) return;
    started.current = true;
    addFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat ochilganda
  }, []);

  const remove = (id: string) => {
    controllers.current.get(id)?.abort();
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const close = () => {
    controllers.current.forEach((controller) => controller.abort());
    onClose();
  };

  const uploaded = items.filter((item): item is Extract<Item, { status: 'uploaded' }> => item.status === 'uploaded');
  const busy = items.some((item) => item.status === 'uploading');
  const hasImage = uploaded.some((item) => item.type === 'IMAGE');

  const add = async () => {
    if (!uploaded.length || busy || saving) return;
    if (!product) {
      onAdded?.(uploaded.map((item) => ({ url: item.url ?? '', type: item.type })), makeMain && hasImage);
      onClose();
      return;
    }
    setSaving(true);
    try {
      const created = [];
      // Har biri tasdiqlangach ro'yxatdan olinadi: biri yiqilsa, qayta «Qo'shish» faqat qolganlarini yuboradi (dublikatsiz).
      for (const item of uploaded) {
        created.push(await confirm.mutateAsync({ productId: product.id, objectKey: item.objectKey ?? '' }));
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }
      const image = created.find((creative) => creative.type === 'IMAGE');
      if (makeMain && image) await setMain.mutateAsync({ id: product.id, url: image.url, images: product.images });
      notification.success({ title: t('apf.mediaDialog.added', { count: created.length }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
      onClose();
    } catch (error) {
      notification.error({ title: t('upload.failed'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
    } finally {
      setSaving(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Dialog
      open
      title={t('apf.media.add')}
      description={t('apf.mediaDialog.subtitle', { name: productName, videos: counts.videos, images: counts.images })}
      icon={<ImagePlus />}
      tone="neutral"
      width={560}
      locked={saving}
      onClose={close}
      testId="media-dialog"
      footer={(
        <>
          <DialogCancel onClick={close} disabled={saving}>{t('apf.footer.cancel')}</DialogCancel>
          <DialogPrimary onClick={() => void add()} disabled={!uploaded.length || busy} saving={saving} savingLabel={t('apf.footer.saving')} shortcut={false}>
            {t('apf.media.addShort')}
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
            <span className={dialogStyles.limits}>{t('apf.mediaDialog.limits')}</span>
          </label>
        )}
        <input
          id={inputId}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          className={dialogStyles.visuallyHidden}
          aria-label={t('apf.mediaDialog.pick')}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>
      {phone ? <span className={dialogStyles.limits}>{t('apf.mediaDialog.limits')}</span> : null}

      {items.length ? (
        <ul className={dialogStyles.fileList}>
          {items.map((item) => (
            <li key={item.id} className={dialogStyles.fileRow} data-state={item.status}>
              <span className={dialogStyles.fileIcon} aria-hidden>{item.status !== 'invalid' && item.type === 'VIDEO' ? <Video /> : <ImageIcon />}</span>
              <span className={dialogStyles.fileMain}>
                <span className={dialogStyles.fileName}>
                  <span>{item.file.name}</span>
                  {item.status === 'uploading' ? <span>{t('apf.mediaDialog.size', { size: (item.file.size / 1024 / 1024).toFixed(1) })}</span> : null}
                </span>
                {item.status === 'uploading' ? (
                  <span className={dialogStyles.progressLine}>
                    <span className={dialogStyles.progressTrack} role="progressbar" aria-label={t('upload.uploading', { name: item.file.name })} aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${item.percent}%` }} />
                    </span>
                    <span>{t('upload.progress', { percent: item.percent })}</span>
                  </span>
                ) : (
                  <span className={dialogStyles.fileStatus} role="status">
                    {item.status === 'uploaded' ? <><CircleCheck aria-hidden />{t('upload.done')}</> : <><CircleX aria-hidden />{item.message}</>}
                  </span>
                )}
              </span>
              <button
                type="button"
                className={dialogStyles.fileRemove}
                onClick={() => remove(item.id)}
                disabled={saving}
                aria-label={item.status === 'uploading' ? t('upload.stop') : t('upload.remove', { name: item.file.name })}
                title={item.status === 'uploading' ? t('upload.stop') : t('upload.remove', { name: item.file.name })}
              >
                {item.status === 'uploaded' ? <Trash2 aria-hidden /> : <X aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hasImage ? (
        <label className={dialogStyles.rule}>
          <span className={dialogStyles.checkBox}>
            <input type="checkbox" checked={makeMain} onChange={(event) => setMakeMain(event.target.checked)} />
            {makeMain ? <Check aria-hidden /> : null}
          </span>
          {t('apf.mediaDialog.makeMain')}
        </label>
      ) : null}
      <p className={dialogStyles.note}>{t('apf.mediaDialog.note')}</p>
    </Dialog>
  );
}
