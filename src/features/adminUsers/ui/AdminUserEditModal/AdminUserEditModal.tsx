import { App, Form } from 'antd';
import { useEffect } from 'react';
import { getApiFieldErrors, getAuthErrorMessage } from '../../../auth/lib/getAuthErrorMessage';
import { useUpdateAdminUserMutation } from '../../api/adminUserQueries';
import { ADMIN_USER_ROLE_OPTIONS } from '../../model/adminUserOptions';
import type { AdminUser, AdminUserRole } from '../../model/adminUserTypes';
import { FormModal } from '../../../../shared/ui/FormModal/FormModal';
import { SelectControl, TextControl } from '../../../../shared/ui/FormControls/FormControls';

interface AdminUserEditValues {
  name: string;
  phone: string;
  email?: string;
  role: AdminUserRole;
}

interface AdminUserEditModalProps {
  open: boolean;
  user: AdminUser | null;
  onCancel: () => void;
  onSaved?: () => void;
}

const editableFields = new Set<keyof AdminUserEditValues>(['name', 'phone', 'email', 'role']);

export function AdminUserEditModal({ open, user, onCancel, onSaved }: AdminUserEditModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<AdminUserEditValues>();
  const updateMutation = useUpdateAdminUserMutation();

  useEffect(() => {
    if (!open || !user) return;
    form.setFieldsValue({
      name: user.name,
      phone: user.phone,
      email: user.email ?? undefined,
      role: user.role,
    });
  }, [form, open, user]);

  const submit = (values: AdminUserEditValues) => {
    if (!user) return;
    updateMutation.mutate(
      {
        id: user.id,
        name: values.name.trim(),
        phone: values.phone.replace(/\s/g, ''),
        ...(values.email?.trim() ? { email: values.email.trim() } : {}),
        role: values.role,
      },
      {
        onSuccess: () => {
          void message.success('Foydalanuvchi ma’lumotlari yangilandi');
          onSaved?.();
          onCancel();
        },
        onError: (error) => {
          const fieldErrors = getApiFieldErrors(error).filter(({ name }) =>
            editableFields.has(name as keyof AdminUserEditValues),
          );
          if (fieldErrors.length) {
            form.setFields(
              fieldErrors.map(({ name, errors }) => ({
                name: [name as keyof AdminUserEditValues],
                errors,
              })),
            );
          }
          void message.error(getAuthErrorMessage(error));
        },
      },
    );
  };

  return (
    <FormModal<AdminUserEditValues>
      open={open}
      title="Foydalanuvchini tahrirlash"
      form={form}
      submitText="O‘zgarishlarni saqlash"
      loading={updateMutation.isPending}
      onCancel={onCancel}
      onSubmit={submit}
    >
      <Form.Item
        label="To‘liq ism"
        name="name"
        rules={[
          { required: true, whitespace: true, message: 'Foydalanuvchi ismini kiriting' },
          { min: 2, message: 'Ism kamida 2 ta belgidan iborat bo‘lsin' },
          { max: 255, message: 'Ism 255 belgidan oshmasligi kerak' },
        ]}
      >
        <TextControl autoComplete="name" maxLength={255} />
      </Form.Item>

      <Form.Item
        label="Telefon raqami"
        name="phone"
        rules={[
          { required: true, message: 'Telefon raqamini kiriting' },
          { pattern: /^\+998\d{9}$/, message: '+998901234567 formatida kiriting' },
        ]}
      >
        <TextControl autoComplete="tel" maxLength={13} />
      </Form.Item>

      <Form.Item
        label="Email"
        name="email"
        rules={[
          { type: 'email', message: 'Email manzilini to‘g‘ri kiriting' },
          { max: 255, message: 'Email 255 belgidan oshmasligi kerak' },
        ]}
      >
        <TextControl autoComplete="email" maxLength={255} />
      </Form.Item>

      <Form.Item
        label="Foydalanuvchi roli"
        name="role"
        rules={[{ required: true, message: 'Rolni tanlang' }]}
      >
        <SelectControl options={ADMIN_USER_ROLE_OPTIONS} />
      </Form.Item>
    </FormModal>
  );
}
