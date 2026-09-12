import { Button, Card, Space, Form, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { ImageUpload } from '../../shared/ui/ImageUpload/ImageUpload';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';

interface TestRecord {
  id: number;
  name: string;
  amount: number;
}

const records: TestRecord[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `Item ${String(index + 1).padStart(2, '0')}`,
  amount: (index + 1) * 1_000,
}));

const columns: ColumnsType<TestRecord> = [
  {
    title: 'Nomi',
    dataIndex: 'name',
    sorter: (left, right) => left.name.localeCompare(right.name),
  },
  {
    title: 'Summa',
    dataIndex: 'amount',
    sorter: (left, right) => left.amount - right.amount,
    render: (value: number) => <MoneyText value={value} />,
  },
];

export default function SharedUiTestPage() {
  const [form] = Form.useForm<{ status: string }>();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card title="DataTable">
          <DataTable
            rowKey="id"
            columns={columns}
            dataSource={records}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            search={{
              placeholder: 'Test yozuvini qidirish',
              filter: (record, query) =>
                record.name.toLocaleLowerCase('uz').includes(query),
            }}
          />
        </Card>

        <Card title="ConfirmDialog">
          <Button onClick={() => setConfirmOpen(true)}>Tasdiqni ochish</Button>
          <output aria-label="Tasdiqlar soni">{confirmCount}</output>
          <ConfirmDialog
            open={confirmOpen}
            title="Amal tasdiqlansinmi?"
            confirmText="Ha"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmCount((count) => count + 1);
              setConfirmOpen(false);
            }}
          />
        </Card>

        <Card title="FormModal">
          <Button onClick={() => setFormOpen(true)}>Formani ochish</Button>
          <FormModal form={form} open={formOpen} title="Test formasi" onCancel={() => setFormOpen(false)} onSubmit={() => setFormOpen(false)}>
            <Form.Item name="status" label="Holati"><Select options={[{ value: 'ACTIVE', label: 'Faol' }]} /></Form.Item>
          </FormModal>
        </Card>
        <Card title="ImageUpload">
          <ImageUpload />
        </Card>

        <Card title="MoneyText">
          <MoneyText value={1_234_567} />
        </Card>
      </Space>
    </main>
  );
}
