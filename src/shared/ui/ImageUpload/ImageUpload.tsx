import { Eye, GripVertical, ImagePlus, Star, Trash2, UploadCloud } from 'lucide-react';
import { App, Modal, Progress, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useEffect, useRef, useState } from 'react';
import styles from './ImageUpload.module.css';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_ACCEPT = [...ACCEPTED_TYPES].join(',');

interface ImageUploadProps {
  value?: UploadFile[];
  onChange?: (files: UploadFile[]) => void;
  coverUid?: string;
  onCoverChange?: (uid: string | null) => void;
  maxCount?: number;
  maxSizeMb?: number;
  disabled?: boolean;
  compact?: boolean;
  uploadFile?: (file: File, onProgress: (percent: number) => void) => Promise<string>;
}

export function ImageUpload({
  value,
  onChange,
  coverUid,
  onCoverChange,
  maxCount = 8,
  maxSizeMb = 5,
  disabled = false,
  compact = false,
  uploadFile,
}: ImageUploadProps) {
  const { message } = App.useApp();
  const [internalFiles, setInternalFiles] = useState<UploadFile[]>([]);
  const [internalCoverUid, setInternalCoverUid] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadFile | null>(null);
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const files = value ?? internalFiles;
  const filesRef = useRef(files);
  const activeCoverUid = coverUid ?? internalCoverUid ?? files[0]?.uid ?? null;

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const commitFiles = (nextFiles: UploadFile[]) => {
    filesRef.current = nextFiles;
    if (value === undefined) setInternalFiles(nextFiles);
    onChange?.(nextFiles);
  };

  const setCover = (uid: string | null) => {
    if (coverUid === undefined) setInternalCoverUid(uid);
    onCoverChange?.(uid);
  };

  const updateFile = (uid: string, patch: Partial<UploadFile>) => {
    commitFiles(
      filesRef.current.map((file) => (file.uid === uid ? { ...file, ...patch } : file)),
    );
  };

  const processImage = (file: UploadFile) => {
    if (!file.originFileObj) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateFile(file.uid, {
        ...(!uploadFile ? { status: 'done' as const, percent: 100 } : {}),
        thumbUrl: typeof reader.result === 'string' ? reader.result : undefined,
      });
    };
    reader.onerror = () => {
      updateFile(file.uid, { status: 'error', percent: 0 });
      void message.error(`${file.name} rasmini o‘qib bo‘lmadi`);
    };
    reader.readAsDataURL(file.originFileObj);

    if (uploadFile) {
      void uploadFile(file.originFileObj, (percent) => {
        updateFile(file.uid, { status: 'uploading', percent });
      })
        .then((url) => updateFile(file.uid, { status: 'done', percent: 100, url }))
        .catch(() => {
          updateFile(file.uid, { status: 'error', percent: 0 });
          void message.error(`${file.name} rasmini serverga yuklab bo‘lmadi`);
        });
    }
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      void message.error('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      void message.error(`Rasm hajmi ${maxSizeMb} MB dan oshmasligi kerak`);
      return Upload.LIST_IGNORE;
    }
    if (filesRef.current.length >= maxCount) {
      void message.warning(`Maksimum ${maxCount} ta rasm yuklash mumkin`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const removeFile = (uid: string) => {
    const nextFiles = filesRef.current.filter((file) => file.uid !== uid);
    commitFiles(nextFiles);
    if (activeCoverUid === uid) setCover(nextFiles[0]?.uid ?? null);
  };

  const reorderFiles = (targetUid: string) => {
    if (!draggedUid || draggedUid === targetUid) return;
    const nextFiles = [...filesRef.current];
    const fromIndex = nextFiles.findIndex((file) => file.uid === draggedUid);
    const toIndex = nextFiles.findIndex((file) => file.uid === targetUid);
    if (fromIndex < 0 || toIndex < 0) return;
    const [movedFile] = nextFiles.splice(fromIndex, 1);
    if (!movedFile) return;
    nextFiles.splice(toIndex, 0, movedFile);
    commitFiles(nextFiles);
    setDraggedUid(null);
  };

  return (
    <section
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      aria-label="Mahsulot rasmlari yuklash"
    >
      <Upload.Dragger
        multiple
        disabled={disabled}
        accept={DEFAULT_ACCEPT}
        fileList={files}
        maxCount={maxCount}
        beforeUpload={beforeUpload}
        showUploadList={{ showPreviewIcon: false, showRemoveIcon: false }}
        onChange={({ fileList }) => {
          const knownUids = new Set(filesRef.current.map((file) => file.uid));
          const nextFiles = fileList.slice(0, maxCount).map((file) =>
            knownUids.has(file.uid)
              ? filesRef.current.find((current) => current.uid === file.uid) ?? file
              : { ...file, status: 'uploading' as const, percent: 1 },
          );
          commitFiles(nextFiles);
          nextFiles
            .filter((file) => !knownUids.has(file.uid))
            .forEach(processImage);
        }}
        itemRender={(_originNode, file) => {
          const isCover = file.uid === activeCoverUid;
          const imageUrl = file.thumbUrl ?? file.url;
          return (
            <article
              className={`${styles.imageCard} ${isCover ? styles.coverCard : ''}`}
              draggable={!disabled}
              onDragStart={() => setDraggedUid(file.uid)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderFiles(file.uid)}
              onDragEnd={() => setDraggedUid(null)}
            >
              <button
                type="button"
                className={styles.previewButton}
                title={file.name}
                disabled={!imageUrl}
                onClick={() => setPreviewFile(file)}
              >
                {imageUrl ? <img src={imageUrl} alt={file.name} /> : <ImagePlus />}
                <span className={styles.previewIcon}><Eye /></span>
              </button>
              {file.status === 'uploading' ? (
                <div className={styles.progress} aria-label={`${file.name} yuklanmoqda`}>
                  <Progress percent={Math.round(file.percent ?? 0)} size="small" />
                </div>
              ) : null}
              <div className={styles.cardTop}>
                <span className={styles.dragHandle} title="Tartibni o‘zgartirish"><GripVertical /></span>
                {isCover ? <span className={styles.coverBadge}><Star /> Asosiy</span> : null}
              </div>
              <div className={styles.cardActions}>
                <button type="button" disabled={disabled || isCover} onClick={() => setCover(file.uid)}>
                  <Star /> {isCover ? 'Asosiy rasm' : 'Asosiy qilish'}
                </button>
                <button type="button" aria-label={`${file.name} rasmini o‘chirish`} disabled={disabled} onClick={() => removeFile(file.uid)}>
                  <Trash2 />
                </button>
              </div>
            </article>
          );
        }}
      >
        <div className={styles.dropIcon}><UploadCloud /></div>
        <p className={styles.dropTitle}>Rasmlarni shu yerga tashlang</p>
        <p className={styles.dropHint}>yoki kompyuterdan tanlash uchun bosing</p>
        <span className={styles.rules}>JPG, PNG, WEBP · {maxSizeMb} MB gacha · maksimum {maxCount} ta</span>
      </Upload.Dragger>

      {files.length > 1 ? (
        <p className={styles.sortHint}><GripVertical /> Rasmlarni tortib tartibini o‘zgartiring. Birinchi rasm avtomatik asosiy bo‘ladi.</p>
      ) : null}

      <Modal
        open={Boolean(previewFile)}
        title={previewFile?.name}
        footer={null}
        onCancel={() => setPreviewFile(null)}
        destroyOnHidden
      >
        {previewFile?.thumbUrl || previewFile?.url ? (
          <img
            src={previewFile.thumbUrl ?? previewFile.url}
            alt={`${previewFile.name} ko‘rinishi`}
            className={styles.previewImage}
          />
        ) : null}
      </Modal>
    </section>
  );
}
