import {
  DeleteOutlined,
  EditOutlined,
  PictureOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Flex, Select, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { ProductFormModal } from '../../features/seller/ui/ProductFormModal/ProductFormModal';
import { initialProducts } from '../../features/seller/model/sellerData';
import type { Product } from '../../features/seller/model/sellerTypes';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import styles from './ProductsPage.module.css';

export default function ProductsPage() {
  const { message } = App.useApp();
  const [products, setProducts] = useState(initialProducts);
  const [status, setStatus] = useState('ALL');
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) => status === 'ALL' || product.status === status,
      ),
    [products, status],
  );

  const removeProduct = (product: Product) => {
    setProducts((items) => items.filter(({ id }) => id !== product.id));
    setDeletingProduct(null);
    void message.success('Mahsulot o‘chirildi');
  };

  const columns: ColumnsType<Product> = [
    {
      title: '',
      width: 64,
      render: () => <span className={styles.imagePlaceholder}><PictureOutlined /></span>,
    },
    { title: 'Nomi', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: 'Kategoriya', dataIndex: 'category' },
    { title: 'Narxi', dataIndex: 'price', render: (price: number) => <MoneyText value={price} />, sorter: (a, b) => a.price - b.price },
    { title: 'Qoldiq', dataIndex: 'stock', width: 100, sorter: (a, b) => a.stock - b.stock },
    { title: 'Variant', dataIndex: 'variants', width: 90, render: (variants: Product['variants']) => variants.length },
    { title: 'Holati', dataIndex: 'status', render: (status: Product['status']) => <StatusTag status={status} /> },
    {
      title: 'Amallar',
      width: 110,
      render: (_, product) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} aria-label="Mahsulotni tahrirlash" onClick={() => { setEditingProduct(product); setModalOpen(true); }} />
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Mahsulotni o‘chirish" onClick={() => setDeletingProduct(product)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <header className={styles.pageHeader}>
        <Typography.Text className={styles.eyebrow}>Katalog</Typography.Text>
        <Typography.Title level={1}>Mahsulotlar</Typography.Title>
        <Typography.Text type="secondary">
          Jami {products.length} ta mahsulot katalogda.
        </Typography.Text>
      </header>
      <Card className={styles.tableCard}>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={filteredProducts}
          scroll={{ x: 900 }}
          search={{
            placeholder: 'Mahsulot yoki SKU qidirish...',
            filter: (product, query) =>
              `${product.name} ${product.sku}`
                .toLocaleLowerCase('uz')
                .includes(query),
          }}
          toolbarExtra={
            <Flex gap={10} wrap>
              <Select
                value={status}
                className={styles.filter}
                onChange={setStatus}
                options={[
                  { value: 'ALL', label: 'Barchasi' },
                  { value: 'ACTIVE', label: 'Faol' },
                  { value: 'LOW', label: 'Kam qoldiq' },
                  { value: 'INACTIVE', label: 'Nofaol' },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingProduct(null); setModalOpen(true); }}>
                Mahsulot qo‘shish
              </Button>
            </Flex>
          }
        />
      </Card>
      <ProductFormModal
        open={modalOpen}
        product={editingProduct}
        onCancel={() => setModalOpen(false)}
        onSave={(values) => {
          setProducts((items) =>
            editingProduct
              ? items.map((item) =>
                  item.id === editingProduct.id ? { ...item, ...values } : item,
                )
              : [
                  {
                    ...values,
                    id: crypto.randomUUID(),
                    status: values.stock > 5 ? 'ACTIVE' : 'LOW',
                  },
                  ...items,
                ],
          );
          setModalOpen(false);
          void message.success('Mahsulot saqlandi');
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title="Mahsulot o‘chirilsinmi?"
        description={`${deletingProduct?.name ?? 'Mahsulot'} ro‘yxatdan olib tashlanadi.`}
        confirmText="O‘chirish"
        danger
        onCancel={() => setDeletingProduct(null)}
        onConfirm={() => {
          if (deletingProduct) removeProduct(deletingProduct);
        }}
      />
    </>
  );
}
