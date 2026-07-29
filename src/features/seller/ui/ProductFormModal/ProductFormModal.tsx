import { DeleteOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Upload,
  message,
} from 'antd';
import type { Product } from '../../model/sellerTypes';

type ProductFormValues = Omit<Product, 'id' | 'status'>;

interface ProductFormModalProps {
  open: boolean;
  product: Product | null;
  onCancel: () => void;
  onSave: (values: ProductFormValues) => void;
}

export function ProductFormModal({
  open,
  product,
  onCancel,
  onSave,
}: ProductFormModalProps) {
  const [form] = Form.useForm<ProductFormValues>();

  return (
    <Modal
      title={product ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
      open={open}
      okText="Saqlash"
      cancelText="Bekor"
      destroyOnHidden
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          if (product) {
            form.setFieldsValue(product);
          } else {
            form.resetFields();
          }
        }
      }}
      onCancel={onCancel}
      onOk={() => void form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{ variants: [] }}
        onFinish={(values) => {
          onSave(values);
          form.resetFields();
        }}
      >
        <Form.Item
          label="Mahsulot nomi"
          name="name"
          rules={[{ required: true, message: 'Mahsulot nomini kiriting' }]}
        >
          <Input placeholder="Masalan, Simsiz quloqchin" />
        </Form.Item>
        <Form.Item
          label="SKU"
          name="sku"
          rules={[{ required: true, message: 'SKU kiriting' }]}
        >
          <Input placeholder="PRD-001" />
        </Form.Item>
        <Form.Item
          label="Kategoriya"
          name="category"
          rules={[{ required: true, message: 'Kategoriyani tanlang' }]}
        >
          <Select
            placeholder="Tanlang"
            options={['Elektronika', 'Aksessuarlar', 'Uy-ro‘zg‘or'].map(
              (value) => ({ label: value, value }),
            )}
          />
        </Form.Item>
        <Form.Item
          label="Narxi"
          name="price"
          rules={[{ required: true, message: 'Narxni kiriting' }]}
        >
          <InputNumber min={0} addonAfter="so‘m" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="Boshlang‘ich qoldiq"
          name="stock"
          rules={[{ required: true, message: 'Qoldiqni kiriting' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Divider>Variantlar</Divider>
        <Form.List name="variants">
          {(fields, { add, remove }) => (
            <Flex vertical gap={12}>
              {fields.map((field) => (
                <Flex key={field.key} gap={8} align="flex-start" wrap>
                  <Form.Item
                    {...field}
                    name={[field.name, 'name']}
                    rules={[{ required: true, message: 'Variant nomi' }]}
                    style={{ flex: 1, minWidth: 130 }}
                  >
                    <Input placeholder="Rang / o‘lcham" />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, 'sku']}
                    rules={[{ required: true, message: 'SKU kiriting' }]}
                    style={{ flex: 1, minWidth: 110 }}
                  >
                    <Input placeholder="SKU" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'price']} style={{ width: 120 }}>
                    <InputNumber min={0} placeholder="Narx" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'stock']} style={{ width: 90 }}>
                    <InputNumber min={0} placeholder="Qoldiq" />
                  </Form.Item>
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    aria-label="Variantni o‘chirish"
                    onClick={() => remove(field.name)}
                  />
                </Flex>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                Variant qo‘shish
              </Button>
            </Flex>
          )}
        </Form.List>
        <Form.Item label="Mahsulot rasmlari" extra="JPG, PNG yoki WEBP · maksimum 5 MB">
          <Upload.Dragger
            multiple
            accept="image/jpeg,image/png,image/webp"
            beforeUpload={(file) => {
              if (file.size > 5 * 1024 * 1024) {
                void message.error('Rasm hajmi 5 MB dan oshmasligi kerak');
                return Upload.LIST_IGNORE;
              }
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>Rasmlarni shu yerga tashlang yoki tanlang</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
