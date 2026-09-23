import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Switch, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ChevronDown, ChevronUp, GalleryHorizontalEnd, Image as ImageIcon, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useBannersQuery, useCreateBannerMutation, useDeleteBannerMutation, useReorderBannersMutation, useUpdateBannerMutation } from '../../features/banners/api/bannerQueries';
import type { Banner, BannerPayload } from '../../features/banners/model/bannerTypes';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import { ToolbarButton } from '../../shared/ui/ToolbarButton/ToolbarButton';
import styles from './AdminBannersPage.module.css';

interface BannerValues { title: string; imageUrl: string; linkUrl?: string; sortOrder: number; isActive: boolean; startsAt?: Dayjs | null; endsAt?: Dayjs | null }

const iso = (value?: Dayjs | null): string | null => (value ? value.toISOString() : null);

function payload(values: BannerValues): BannerPayload {
  return {
    title: values.title.trim(),
    imageUrl: values.imageUrl.trim(),
    linkUrl: values.linkUrl?.trim() || null,
    sortOrder: values.sortOrder,
    isActive: values.isActive,
    startsAt: iso(values.startsAt),
    endsAt: iso(values.endsAt),
  };
}

/** Backend `isVisible` ni o'zi hisoblaydi; bu yerda faqat sababini ko'rsatamiz. */
function statusTag(banner: Banner, t: (key: never, values?: Record<string, string>) => string) {
  if (banner.isVisible) return <Tag color="green">{t('admin.banners.visible' as never)}</Tag>;
  if (!banner.isActive) return <Tag>{t('admin.banners.hidden' as never)}</Tag>;
  if (banner.endsAt && dayjs(banner.endsAt).isBefore(dayjs())) return <Tag color="red">{t('admin.banners.expired' as never)}</Tag>;
  return <Tag color="blue">{t('admin.banners.scheduled' as never)}</Tag>;
}

export default function AdminBannersPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<BannerValues>();
  const query = useBannersQuery();
  const create = useCreateBannerMutation();
  const update = useUpdateBannerMutation();
  const reorder = useReorderBannersMutation();
  const remove = useDeleteBannerMutation();
  const [editing, setEditing] = useState<Banner | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<BannerValues>>({});
  const [saveError, setSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const saving = create.isPending || update.isPending;
  const imageUrl = Form.useWatch('imageUrl', form);
  const banners = query.data ?? [];

  const openForm = (banner: Banner | null) => {
    setSaveError('');
    form.resetFields();
    setInitialValues(banner
      ? { title: banner.title, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl ?? undefined, sortOrder: banner.sortOrder, isActive: banner.isActive, startsAt: banner.startsAt ? dayjs(banner.startsAt) : null, endsAt: banner.endsAt ? dayjs(banner.endsAt) : null }
      : { title: '', imageUrl: '', linkUrl: undefined, sortOrder: banners.length, isActive: true, startsAt: null, endsAt: null });
    setEditing(banner);
  };

  /** Butun ro'yxatni qayta raqamlab yuboramiz — backend atomar saqlaydi. */
  const move = (index: number, direction: -1 | 1) => {
    const next = [...banners];
    const target = index + direction;
    if (target < 0 || target >= next.length || reorder.isPending) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((banner, position) => ({ id: banner.id, sortOrder: position })), {
      onSuccess: () => void message.success(t('admin.banners.reordered')),
      onError: (error: Error) => void message.error(getApiErrorMessage(error)),
    });
  };

  return <main className={styles.page}>
    <PageHeader title={t('admin.banners.title')} description={t('admin.banners.description')} extra={<Button type="primary" icon={<Plus size={18} />} disabled={!query.data} onClick={() => openForm(null)}>{t('admin.banners.add')}</Button>} />
    {query.isPending ? <ContentState state="loading" /> : query.isError ? <ContentState state="error" title={t('admin.banners.loadError')} description={getApiErrorMessage(query.error)} onAction={() => void query.refetch()} /> : (
      <TablePanel title={t('admin.banners.title')} caption={t('pagination.total', { total: banners.length })}>
        {banners.length ? <div className={styles.rows} aria-busy={query.isFetching || reorder.isPending}>
          {banners.map((banner, index) => <div className={styles.row} key={banner.id} data-banner-id={banner.id}>
            <span className={styles.thumb}>{banner.imageUrl ? <img src={banner.imageUrl} alt="" loading="lazy" /> : null}</span>
            <div className={styles.copy}>
              <strong>{banner.title}</strong>
              {banner.linkUrl ? <span className={styles.link}><Link2 size={12} /> {banner.linkUrl}</span> : null}
              <span className={styles.meta}>
                {statusTag(banner, t as never)}
                <span className={styles.period}>
                  {banner.startsAt ? `${t('admin.banners.startsAt')}: ${dayjs(banner.startsAt).format('DD.MM.YYYY HH:mm')}` : ''}
                  {banner.startsAt && banner.endsAt ? ' · ' : ''}
                  {banner.endsAt ? `${t('admin.banners.endsAt')}: ${dayjs(banner.endsAt).format('DD.MM.YYYY HH:mm')}` : ''}
                </span>
              </span>
            </div>
            <div className={styles.actions}>
              <ToolbarButton icon={<ChevronUp size={16} />} aria-label={t('admin.banners.moveUp', { name: banner.title })} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} />
              <ToolbarButton icon={<ChevronDown size={16} />} aria-label={t('admin.banners.moveDown', { name: banner.title })} disabled={index === banners.length - 1 || reorder.isPending} onClick={() => move(index, 1)} />
              <ToolbarButton icon={<Pencil size={16} />} aria-label={t('admin.banners.editAria', { name: banner.title })} onClick={() => openForm(banner)} />
              <ToolbarButton icon={<Trash2 size={16} />} aria-label={t('admin.banners.deleteAria', { name: banner.title })} onClick={() => { setDeleteError(''); setDeleting(banner); }} />
            </div>
          </div>)}
        </div> : <EmptyState compact title={t('admin.banners.empty')} description={t('admin.banners.emptyDescription')} />}
      </TablePanel>
    )}
    <FormModal<BannerValues> title={t(editing ? 'admin.banners.edit' : 'admin.banners.new')} open={editing !== undefined} form={form} initialValues={initialValues} loading={saving} onCancel={() => setEditing(undefined)} onSubmit={values => {
      if (saving) return;
      if (values.startsAt && values.endsAt && !values.endsAt.isAfter(values.startsAt)) {
        setSaveError(t('admin.banners.periodInvalid'));
        return;
      }
      setSaveError('');
      const options = {
        onSuccess: () => { setEditing(undefined); void message.success(t('admin.banners.saved')); },
        onError: (error: Error) => setSaveError(getApiErrorMessage(error)),
      };
      if (editing) update.mutate({ id: editing.id, payload: payload(values) }, options); else create.mutate(payload(values), options);
    }}>
      <div className={styles.formIntro}><GalleryHorizontalEnd size={22} /><p>{t('admin.banners.imageHint')}</p></div>
      {saveError ? <Alert className={styles.alert} type="error" showIcon title={saveError} /> : null}
      <Form.Item name="title" label={t('admin.common.name')} rules={[{ required: true, whitespace: true, message: t('admin.banners.titleRequired') }, { max: 255 }]}><Input autoFocus maxLength={255} disabled={saving} /></Form.Item>
      <Form.Item name="imageUrl" label={t('admin.banners.imageUrl')} rules={[{ required: true, whitespace: true, message: t('admin.banners.imageRequired') }, { max: 1000 }]}><Input prefix={<ImageIcon size={16} />} placeholder="https://…" disabled={saving} /></Form.Item>
      {imageUrl ? <div className={styles.previewBox}><span>{t('admin.banners.preview')}</span><div className={styles.previewImage}><img src={imageUrl} alt="" /></div></div> : null}
      <Form.Item name="linkUrl" label={t('admin.banners.linkUrl')} extra={t('admin.banners.linkHint')} rules={[{ max: 1000 }]}><Input prefix={<Link2 size={16} />} placeholder="/katalog/telefon" disabled={saving} /></Form.Item>
      <div className={styles.formGrid}>
        <Form.Item name="startsAt" label={t('admin.banners.startsAt')} extra={t('admin.banners.periodHint')}><DatePicker showTime style={{ width: '100%' }} disabled={saving} /></Form.Item>
        <Form.Item name="endsAt" label={t('admin.banners.endsAt')}><DatePicker showTime style={{ width: '100%' }} disabled={saving} /></Form.Item>
        <Form.Item name="sortOrder" label={t('admin.common.order')} rules={[{ required: true }]}><InputNumber min={0} max={2147483647} precision={0} style={{ width: '100%' }} disabled={saving} /></Form.Item>
        <Form.Item name="isActive" label={t('status.active')} valuePropName="checked"><Switch disabled={saving} /></Form.Item>
      </div>
    </FormModal>
    <ConfirmDialog open={Boolean(deleting)} title={t('admin.banners.deleteTitle')} description={<><p><strong>{deleting?.title}</strong></p><p>{t('admin.banners.deleteDescription')}</p>{deleteError ? <Alert type="error" showIcon title={deleteError} /> : null}</>} confirmText={t('common.delete')} danger loading={remove.isPending} onCancel={() => { if (!remove.isPending) setDeleting(null); }} onConfirm={() => {
      if (!deleting || remove.isPending) return;
      setDeleteError('');
      remove.mutate(deleting.id, { onSuccess: () => { setDeleting(null); void message.success(t('admin.banners.deleted')); }, onError: error => setDeleteError(getApiErrorMessage(error)) });
    }} />
  </main>;
}
