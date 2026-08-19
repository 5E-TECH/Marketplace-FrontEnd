import { MapPin } from 'lucide-react';
import { Form, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { WarehousePayload } from '../model/warehouseTypes';
import { FormModal } from '../../../shared/ui/FormModal/FormModal';
import { TextControl } from '../../../shared/ui/FormControls/FormControls';

export type WarehouseFormValues = Omit<WarehousePayload, 'isDefault'> & {
  isDefault?: boolean;
};

interface WarehouseFormModalProps {
  open: boolean;
  loading: boolean;
  makeDefaultInitially: boolean;
  form: FormInstance<WarehouseFormValues>;
  onCancel: () => void;
  onSubmit: (values: WarehouseFormValues) => void;
}

export function WarehouseFormModal({
  open,
  loading,
  makeDefaultInitially,
  form,
  onCancel,
  onSubmit,
}: WarehouseFormModalProps) {
  return (
    <FormModal
      title="Yangi ombor"
      open={open}
      form={form}
      initialValues={{ isDefault: makeDefaultInitially }}
      submitText="Qo‘shish"
      loading={loading}
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      <Form.Item label="Ombor nomi" name="name" rules={[{ required: true, whitespace: true, message: 'Ombor nomini kiriting' }, { max: 120 }]}>
        <TextControl prefix={<MapPin size={16} />} placeholder="Masalan, Asosiy ombor" maxLength={120} />
      </Form.Item>
      <Form.Item label="Viloyat ID" name="regionId" rules={[{ max: 40 }]}>
        <TextControl placeholder="Masalan, 12" maxLength={40} />
      </Form.Item>
      <Form.Item label="Tuman ID" name="districtId" rules={[{ max: 40 }]}>
        <TextControl placeholder="Masalan, 140" maxLength={40} />
      </Form.Item>
      <Form.Item label="Manzil" name="address" rules={[{ max: 240 }]}>
        <TextControl placeholder="Toshkent shahri, Chilonzor tumani" maxLength={240} />
      </Form.Item>
      <Form.Item label="Asosiy ombor" name="isDefault" valuePropName="checked">
        <Switch checkedChildren="Ha" unCheckedChildren="Yo‘q" />
      </Form.Item>
    </FormModal>
  );
}
