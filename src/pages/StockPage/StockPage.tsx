import { ArrowDownToLine, SlidersHorizontal } from 'lucide-react';
import { App, Button, Card, Form, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useState } from 'react';
import { useAdjustStockMutation, useInboundStockMutation, useStockQuery } from '../../features/stock/api/stockQueries';
import type { StockItem } from '../../features/stock/model/stockTypes';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { FilterTabs } from '../../shared/ui/FilterTabs/FilterTabs';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { NumberControl, TextAreaControl } from '../../shared/ui/FormControls/FormControls';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import styles from './StockPage.module.css';

type StockAction = { type: 'inbound' | 'adjust'; item: StockItem } | null;
type MutationForm = { amount: number | null; reason: string };

export default function StockPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<MutationForm>();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [lowOnly, setLowOnly] = useState(false);
  const [action, setAction] = useState<StockAction>(null);
  const search = useDeferredValue(query.trim());
  const stockQuery = useStockQuery({ page, limit: 20, ...(search ? { search } : {}), ...(lowOnly ? { lowOnly: true } : {}) });
  const inboundMutation = useInboundStockMutation();
  const adjustMutation = useAdjustStockMutation();

  const columns: ColumnsType<StockItem> = [
    { title: 'Mahsulot', render: (_, item) => <span className={styles.product}><Typography.Text strong>{item.productName}</Typography.Text><small>{item.variantName || 'Default variant'}</small></span> },
    { title: 'SKU', dataIndex: 'sku' },
    { title: 'Ombor', dataIndex: 'warehouseName' },
    { title: 'Jami', dataIndex: 'onHand', align: 'center' },
    { title: 'Band', dataIndex: 'reserved', align: 'center' },
    { title: 'Mavjud', dataIndex: 'available', align: 'center', render: (available: number, item) => <span className={available <= item.lowStockThreshold ? styles.lowValue : undefined}>{available}</span> },
    { title: 'Minimum', dataIndex: 'lowStockThreshold', align: 'center' },
    { title: 'Holat', render: (_, item) => item.available <= item.lowStockThreshold ? <Tag color="warning">Kam qolgan</Tag> : <Tag color="success">Yetarli</Tag> },
    { title: 'Amallar', width: 190, render: (_, item) => <span className={styles.actions}><Button size="small" icon={<ArrowDownToLine size={15} />} onClick={() => setAction({ type: 'inbound', item })}>Kirim</Button><Button size="small" icon={<SlidersHorizontal size={15} />} onClick={() => setAction({ type: 'adjust', item })}>Tuzatish</Button></span> },
  ];

  const submit = (values: MutationForm) => {
    if (!action || values.amount === null) return;
    const common = { variantId: action.item.variantId, warehouseId: action.item.warehouseId, reason: values.reason.trim() };
    const type = action.type;
    const options = {
      onSuccess: () => {
        setAction(null);
        void message.success(type === 'inbound' ? 'Kirim muvaffaqiyatli bajarildi' : 'Qoldiq tuzatildi');
      },
      onError: (error: Error) => void message.error(getAuthErrorMessage(error)),
    };

    if (type === 'inbound') {
      inboundMutation.mutate({ ...common, quantity: values.amount }, options);
      return;
    }

    adjustMutation.mutate({ ...common, delta: values.amount }, options);
  };

  if (stockQuery.isPending) return <ContentState state="loading" />;
  if (stockQuery.isError) return <ContentState state="error" title="Qoldiqni yuklab bo‘lmadi" description={getAuthErrorMessage(stockQuery.error)} onAction={() => void stockQuery.refetch()} />;

  return <main className={styles.page}>
    <PageHeader title="Qoldiq" description="Variantlar kesimida ombor qoldiqlarini boshqaring" />
    <ListToolbar value={query} placeholder="Mahsulot yoki SKU qidirish..." onChange={(value) => { setQuery(value); setPage(1); }} />
    <Card>
      <FilterTabs value={lowOnly ? 'LOW' : 'ALL'} ariaLabel="Qoldiq filtri" options={[{ value: 'ALL', label: 'Barcha qoldiq' }, { value: 'LOW', label: 'Kam qolgan' }]} onChange={(value) => { setLowOnly(value === 'LOW'); setPage(1); }} />
      <DataTable rowKey={(item) => `${item.variantId}-${item.warehouseId}`} columns={columns} dataSource={stockQuery.data.items} rowClassName={(item) => item.available <= item.lowStockThreshold ? styles.lowStock : ''} scroll={{ x: 1050 }} pagination={{ ...createTablePagination(20), current: page, total: stockQuery.data.total }} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    </Card>
    <FormModal title={action?.type === 'inbound' ? 'Tovar kirimi' : 'Qoldiqni tuzatish'} open={Boolean(action)} form={form} submitText={action?.type === 'inbound' ? 'Kirim qilish' : 'Tuzatish'} loading={inboundMutation.isPending || adjustMutation.isPending} onCancel={() => setAction(null)} onSubmit={submit}>
      {action ? <p className={styles.context}><strong>{action.item.productName}</strong> · {action.item.variantName || 'Default'} · {action.item.warehouseName}</p> : null}
      <Form.Item label={action?.type === 'inbound' ? 'Miqdor' : 'O‘zgarish miqdori'} name="amount" rules={[{ required: true, message: 'Miqdorni kiriting' }, { validator: (_, value: number | null) => value === null || (action?.type === 'inbound' ? value > 0 : value !== 0) ? Promise.resolve() : Promise.reject(new Error(action?.type === 'inbound' ? 'Miqdor musbat bo‘lishi kerak' : 'Miqdor 0 bo‘lishi mumkin emas')) }]}><NumberControl precision={0} {...(action?.type === 'inbound' ? { min: 1 } : {})} placeholder={action?.type === 'inbound' ? '50' : '-5 yoki 10'} /></Form.Item>
      <Form.Item label="Sabab" name="reason" rules={[{ required: true, whitespace: true, message: 'Sababni kiriting' }, { max: 500 }]}><TextAreaControl rows={3} maxLength={500} placeholder={action?.type === 'inbound' ? 'Yangi partiya' : 'Inventarizatsiya natijasi'} /></Form.Item>
    </FormModal>
  </main>;
}
