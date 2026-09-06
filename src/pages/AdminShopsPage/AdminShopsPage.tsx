import { App, Button, Form, Input, Modal, Select, Space, Statistic, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Ban, Check, Eye, Play, X } from 'lucide-react';
import { useState } from 'react';
import { useActivateAdminShopMutation, useAdminShopDetailQuery, useAdminShopsQuery, useApproveAdminShopMutation, useRejectAdminShopMutation, useSuspendAdminShopMutation } from '../../features/adminShops/api/adminShopQueries';
import type { AdminShop, AdminShopStatus } from '../../features/adminShops/model/adminShopTypes';
import { getUserErrorMessage } from '../../features/users/lib/getUserErrorMessage';
import { formatDate } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { DetailDrawer } from '../../shared/ui/DetailDrawer/DetailDrawer';
import { DetailList } from '../../shared/ui/DetailList/DetailList';
import styles from './AdminShopsPage.module.css';

type StatusFilter = 'ALL' | AdminShopStatus;
interface RejectValues { reason: string }
const statusColor: Record<AdminShopStatus, string> = { PENDING: 'warning', ACTIVE: 'success', INACTIVE: 'default', SUSPENDED: 'error', REJECTED: 'error' };

export default function AdminShopsPage() {
  const { message } = App.useApp();
  const { language, t } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminShop | null>(null);
  const [rejecting, setRejecting] = useState<AdminShop | null>(null);
  const [rejectForm] = Form.useForm<RejectValues>();
  const debounced = useDebouncedValue(search.trim());
  const query = useAdminShopsQuery({ page, limit: 20, ...(debounced ? { search: debounced } : {}), ...(status !== 'ALL' ? { status } : {}) });
  const detail = useAdminShopDetailQuery(selected?.id ?? null);
  const approve = useApproveAdminShopMutation();
  const reject = useRejectAdminShopMutation();
  const suspend = useSuspendAdminShopMutation();
  const activate = useActivateAdminShopMutation();
  const notifyError = (error: Error) => void message.error(getUserErrorMessage(error, language));
  const closeAfter = (text: string) => { setSelected(null); void message.success(text); };

  const columns: ColumnsType<AdminShop> = [
    { title: t('adminShops.market'), render: (_, shop) => <Typography.Text strong>{shop.name}</Typography.Text> },
    { title: t('adminShops.ownerId'), dataIndex: 'ownerUserId', width: 100, responsive: ['lg'], render: (value: string) => `#${value}` },
    { title: t('users.phone'), dataIndex: 'phone', responsive: ['sm'] },
    { title: t('adminShops.address'), dataIndex: 'address', responsive: ['lg'], render: (value: string | null) => value || '—' },
    { title: t('users.status'), dataIndex: 'status', width: 120, render: (value: AdminShopStatus) => <Tag color={statusColor[value]}>{value}</Tag> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => value ? formatDate(value, language) : '—' },
    { title: t('users.actions'), width: 90, align: 'center', render: (_, shop) => <Button type="text" icon={<Eye size={17} />} aria-label={`${shop.name} tafsilotlarini ko‘rish`} onClick={() => setSelected(shop)}>Ko‘rish</Button> },
  ];

  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('adminShops.loadError')} description={getUserErrorMessage(query.error, language)} onAction={() => void query.refetch()} />;
  return <main className={styles.page}>
    <PageHeader title={t('adminShops.title')} description="Kutilayotgan do‘konlarni tekshiring, tasdiqlang yoki sabab bilan rad eting" />
    <ListToolbar value={search} placeholder={t('adminShops.search')} onChange={(value) => { setSearch(value); setPage(1); }} actions={<Select<StatusFilter> className={styles.filter} value={status} options={['PENDING','ALL','ACTIVE','SUSPENDED','REJECTED','INACTIVE'].map((value) => ({ value, label: value === 'ALL' ? t('users.allStatuses') : value }))} onChange={(value) => { setStatus(value); setPage(1); }} />} />
    <DataTable rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('adminShops.empty')} description={t('adminShops.emptyDescription')} />} pagination={{ ...createTablePagination(20), current: page, total: query.data.total }} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    <DetailDrawer title={selected?.name ?? 'Do‘kon tafsiloti'} subtitle="Do‘kon moderatsiyasi" width="min(560px, 100vw)" open={Boolean(selected)} onClose={() => setSelected(null)} extra={selected ? <Tag color={statusColor[selected.status]}>{selected.status}</Tag> : null}>
      {detail.isPending ? <ContentState state="loading" /> : detail.isError ? <ContentState state="error" description={getUserErrorMessage(detail.error, language)} onAction={() => void detail.refetch()} /> : detail.data && selected ? <>
        <DetailList items={[{ label: 'Do‘kon', value: detail.data.name }, { label: 'Do‘kon ID', value: `#${detail.data.id}` }, { label: 'Seller ID', value: `#${detail.data.ownerUserId}` }, { label: 'Telefon', value: selected.phone }, { label: 'Manzil', value: selected.address || '—' }]} />
        <div className={styles.stats}><Statistic title="Mahsulotlar" value={detail.data.stats.products} /><Statistic title="Buyurtmalar" value={detail.data.stats.orders} /><Statistic title="Omborlar" value={detail.data.stats.warehouses} /></div>
        <Space wrap className={styles.actions}>
          {selected.status === 'PENDING' ? <><Button type="primary" icon={<Check />} loading={approve.isPending} onClick={() => approve.mutate(selected.id, { onSuccess: () => closeAfter('Do‘kon tasdiqlandi'), onError: notifyError })}>Tasdiqlash</Button><Button danger icon={<X />} onClick={() => { rejectForm.resetFields(); setRejecting(selected); }}>Rad etish</Button></> : null}
          {selected.status === 'ACTIVE' ? <Button danger icon={<Ban />} loading={suspend.isPending} onClick={() => suspend.mutate(selected.id, { onSuccess: () => closeAfter('Do‘kon vaqtincha to‘xtatildi'), onError: notifyError })}>To‘xtatish</Button> : null}
          {selected.status === 'SUSPENDED' ? <Button type="primary" icon={<Play />} loading={activate.isPending} onClick={() => activate.mutate(selected.id, { onSuccess: () => closeAfter('Do‘kon qayta faollashtirildi'), onError: notifyError })}>Faollashtirish</Button> : null}
        </Space>
      </> : null}
    </DetailDrawer>
    <Modal title="Do‘konni rad etish" open={Boolean(rejecting)} okText="Rad etish" cancelText="Bekor qilish" okButtonProps={{ danger: true, loading: reject.isPending }} onCancel={() => setRejecting(null)} onOk={() => rejectForm.submit()} destroyOnHidden><Form<RejectValues> form={rejectForm} layout="vertical" onFinish={({ reason }) => { if (!rejecting) return; reject.mutate({ shopId: rejecting.id, reason: reason.trim() }, { onSuccess: () => { setRejecting(null); setSelected(null); void message.success('Do‘kon rad etildi'); }, onError: notifyError }); }}><Form.Item name="reason" label="Rad etish sababi" rules={[{ required: true, whitespace: true, message: 'Sababni kiriting' }, { min: 5, message: 'Kamida 5 ta belgi kiriting' }, { max: 500 }]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="Masalan: hujjatlar to‘liq emas" /></Form.Item></Form></Modal>
  </main>;
}
