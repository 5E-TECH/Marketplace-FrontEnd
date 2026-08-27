import { Modal } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText ?? t('common.confirm')}
      cancelText={cancelText ?? t('common.cancel')}
      okButtonProps={{ danger, loading }}
      closable={!loading}
      maskClosable={!loading}
      keyboard={!loading}
      onOk={() => void onConfirm()}
      onCancel={onCancel}
      destroyOnHidden
    >
      {description}
    </Modal>
  );
}
