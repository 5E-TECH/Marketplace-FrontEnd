import { ExternalLink } from 'lucide-react';
import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import type {
  SellerOrder,
  SellerOrderStatus,
} from '../../features/orders/model/orderTypes';
import { useSellerShipmentsQuery } from '../../features/orders/api/orderQueries';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import { formatDateTime } from '../../shared/lib/date';

/** Jo'natma holatlari — Elchi yaratilgandan keyingi bosqichlar. */
type ShipmentStatusFilter = 'ALL' | SellerOrderStatus;

const statusOptions: Array<{ value: ShipmentStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Barcha holatlar' },
  { value: 'SHIPMENT_CREATED', label: 'Pochtaga topshirildi' },
  { value: 'RECEIVED', label: 'Elchi qabul qildi' },
  { value: 'ON_THE_ROAD', label: 'Yo‘lda' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'RETURNED', label: 'Qaytarildi' },
  { value: 'CANCELLED', label: 'Bekor qilindi' },
];

const money = new Intl.NumberFormat('uz-UZ');
const formatMoney = (value: number) =>
  `${money.format(value).replaceAll(',', ' ')} so‘m`;

export default function DeliveryPage() {
  const [status, setStatus] = useState<ShipmentStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Har harfda emas, yozish to'xtagach so'rov yuboriladi (boshqa ro'yxatlardagi kabi).
  const deferredSearch = useDebouncedValue(search.trim());

  const shipmentsQuery = useSellerShipmentsQuery({
    page,
    limit: TABLE_PAGE_SIZE,
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
    { title: 'Sana', dataIndex: 'createdAt', width: 150, render: (value: string) => formatDateTime(value) },
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
        description={getApiErrorMessage(shipmentsQuery.error)}
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
            <FilterSelect<ShipmentStatusFilter>
              value={status}
              options={statusOptions}
              title="Jo‘natma holati"
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            {hasFilters ? (
              <ResetFiltersButton
                onClick={() => {
                  setSearch('');
                  setStatus('ALL');
                  setPage(1);
                }}
              />
            ) : null}
          </>
        }
      />
      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={shipments}
        emptyState={
          <EmptyState
            compact
            title="Jo‘natmalar topilmadi"
            description="Buyurtma Elchi’ga topshirilganda shu yerda ko‘rinadi."
          />
        }
        pagination={{
          current: page,
          total: shipmentsQuery.data.total,
          onChange: setPage,
        }}
      />
    </>
  );
}
