import { ImageUp as InboxOutlined } from 'lucide-react';
import { App, Modal, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useEffect, useState } from 'react';

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp';

interface ImageUploadProps {
  value?: UploadFile[];
  onChange?: (files: UploadFile[]) => void;
  maxCount?: number;
  maxSizeMb?: number;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  maxCount = 5,
  maxSizeMb = 5,
  disabled = false,
}: ImageUploadProps) {
  const { message } = App.useApp();
  const [internalFiles, setInternalFiles] = useState<UploadFile[]>([]);
  const [preview, setPreview] = useState<{
    name: string;
    url: string;
    objectUrl: boolean;
  } | null>(null);
  const files = value ?? internalFiles;

  useEffect(
    () => () => {
      if (preview?.objectUrl) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!DEFAULT_ACCEPT.split(',').includes(file.type)) {
      void message.error('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      void message.error(`Rasm hajmi ${maxSizeMb} MB dan oshmasligi kerak`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const closePreview = () => setPreview(null);

  return (
    <>
      <Upload.Dragger
        multiple
        disabled={disabled}
        accept={DEFAULT_ACCEPT}
        fileList={files}
        maxCount={maxCount}
        beforeUpload={beforeUpload}
        onPreview={(file) => {
          const directUrl = file.url ?? file.thumbUrl;
          if (directUrl) {
            setPreview({ name: file.name, url: directUrl, objectUrl: false });
          } else if (file.originFileObj) {
            setPreview({
              name: file.name,
              url: URL.createObjectURL(file.originFileObj),
              objectUrl: true,
            });
          }
        }}
        onChange={({ fileList }) => {
          const nextFiles = fileList.slice(-maxCount);
          if (value === undefined) setInternalFiles(nextFiles);
          onChange?.(nextFiles);
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p>Rasmlarni shu yerga tashlang yoki tanlang</p>
        <p className="ant-upload-hint">
          JPG, PNG yoki WEBP · maksimum {maxSizeMb} MB · {maxCount} tagacha
        </p>
      </Upload.Dragger>
      <Modal
        open={Boolean(preview)}
        title={preview?.name}
        footer={null}
        onCancel={closePreview}
        destroyOnHidden
      >
        {preview ? (
          <img
            src={preview.url}
            alt={`${preview.name} ko‘rinishi`}
            style={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        ) : null}
      </Modal>
    </>
  );
}
