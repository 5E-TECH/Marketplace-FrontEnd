import { Modal } from 'antd';
import type { ReactNode } from 'react';

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
  confirmText = 'Tasdiqlash',
  cancelText = 'Bekor',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      cancelText={cancelText}
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
