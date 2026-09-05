import { App } from 'antd';
import { getAuthErrorMessage } from '../../../auth/lib/getAuthErrorMessage';
import { useDeleteAdminUserMutation } from '../../api/adminUserQueries';
import type { AdminUser } from '../../model/adminUserTypes';
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog/ConfirmDialog';

interface AdminUserDeleteDialogProps {
  open: boolean;
  user: AdminUser | null;
  onCancel: () => void;
  onDeleted?: (user: AdminUser) => void;
}

export function AdminUserDeleteDialog({
  open,
  user,
  onCancel,
  onDeleted,
}: AdminUserDeleteDialogProps) {
  const { message } = App.useApp();
  const deleteMutation = useDeleteAdminUserMutation();

  const remove = () => {
    if (!user) return;
    deleteMutation.mutate(user.id, {
      onSuccess: () => {
        void message.success('Foydalanuvchi o‘chirildi');
        onDeleted?.(user);
        onCancel();
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title="Foydalanuvchi o‘chirilsinmi?"
      description={
        <>
          <strong>{user?.name || user?.phone || 'Tanlangan foydalanuvchi'}</strong>{' '}
          akkaunti o‘chiriladi. Bu amalni ortga qaytarib bo‘lmaydi.
        </>
      }
      confirmText="O‘chirish"
      danger
      loading={deleteMutation.isPending}
      onCancel={onCancel}
      onConfirm={remove}
    />
  );
}
