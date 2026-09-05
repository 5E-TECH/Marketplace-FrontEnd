import { ExternalLink, RotateCcw } from 'lucide-react';
import { Button, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useState } from 'react';
import type {
  SellerOrder,
  SellerOrderStatus,
} from '../../features/orders/model/orderTypes';
import { useSellerShipmentsQuery } from '../../features/orders/api/orderQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ContentState } from '../../shared/ui/ContentState/ContentState';

/** Jo'natma holatlari — Elchi yaratilgandan keyingi bosqichlar. */
type ShipmentStatusFilter = 'ALL' | SellerOrderStatus;

const statusOptions: Array<{ value: ShipmentStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Barcha holatlar' },
  { value: 'SHIPMENT_CREATED', label: 'Elchi yaratildi' },
  { value: 'ON_THE_ROAD', label: 'Yo‘lda' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'RETURNED', label: 'Qaytarildi' },
  { value: 'CANCELLED', label: 'Bekor qilindi' },
];

const PAGE_SIZE = 20;
const money = new Intl.NumberFormat('uz-UZ');
const formatMoney = (value: number) =>
  `${money.format(value).replaceAll(',', ' ')} so‘m`;
const formatDate = (value: string) =>
  new Date(value).toLocaleString('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export default function DeliveryPage() {
  const [status, setStatus] = useState<ShipmentStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const shipmentsQuery = useSellerShipmentsQuery({
    page,
    limit: PAGE_SIZE,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(status !== 'ALL' ? { status } : {}),
  });

  const columns: ColumnsType<SellerOrder> = [
    {
      title: 'Buyurtma',
      width: 130,
      render: (_, order) => <strong>#{order.salesOrderId}</strong>,
    },
    {
      title: 'Xaridor',
      dataIndex: 'buyerName',
      render: (name: string | null) => name || 'Noma’lum xaridor',
    },
    {
      title: 'Elchi jo‘natmasi',
      dataIndex: 'elchiShipmentId',
      width: 170,
      render: (shipmentId: string | null) => shipmentId ?? '—',
    },
    {
      title: 'Yetkazishda undirish',
      dataIndex: 'codAmount',
      width: 180,
      render: (amount: number) =>
        amount > 0 ? formatMoney(amount) : 'Oldindan to‘langan',
    },
    { title: 'Sana', dataIndex: 'createdAt', width: 150, render: formatDate },
    {
      title: 'Holati',
      dataIndex: 'status',
      width: 140,
      render: (value: SellerOrderStatus) => <StatusTag status={value} />,
    },
    {
      title: '',
      width: 130,
      render: (_, order) =>
        order.trackingUrl ? (
          <Typography.Link
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Kuzatish <ExternalLink size={14} />
          </Typography.Link>
        ) : null,
    },
  ];

  if (shipmentsQuery.isPending) return <ContentState state="loading" />;
  if (shipmentsQuery.isError) {
    return (
      <ContentState
        state="error"
        title="Jo‘natmalarni yuklab bo‘lmadi"
        description={getAuthErrorMessage(shipmentsQuery.error)}
        onAction={() => void shipmentsQuery.refetch()}
      />
    );
  }

  const shipments = shipmentsQuery.data.items;
  const hasFilters = Boolean(search) || status !== 'ALL';

  return (
    <>
      <PageHeader
        title="Yetkazib berish"
        description="Elchi orqali jo‘natilgan buyurtmalar va ularning kuzatuv havolalari"
      />
      <ListToolbar
        value={search}
        placeholder="Buyurtma ID yoki xaridor ismi..."
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actions={
          <>
            <Select<ShipmentStatusFilter>
              value={status}
              options={statusOptions}
              title="Jo‘natma holati"
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            {hasFilters ? (
              <Button
                icon={<RotateCcw size={16} />}
                onClick={() => {
                  setSearch('');
                  setStatus('ALL');
                  setPage(1);
                }}
              >
                Tozalash
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={shipments}
        scroll={{ x: 820 }}
        emptyState={
          <EmptyState
            compact
            title="Jo‘natmalar topilmadi"
            description="Buyurtma Elchi’ga topshirilganda shu yerda ko‘rinadi."
          />
        }
        pagination={
          shipmentsQuery.data.total > PAGE_SIZE
            ? {
                ...createTablePagination(PAGE_SIZE),
                current: page,
                total: shipmentsQuery.data.total,
              }
            : false
        }
        onChange={(pagination) => setPage(pagination.current ?? 1)}
      />
    </>
  );
}
