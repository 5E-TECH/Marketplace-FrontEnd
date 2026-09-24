import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Switch, Tag, Upload } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ChevronDown, ChevronUp, GalleryHorizontalEnd, ImageUp, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  useBannersQuery,
  useCreateBannerMutation,
  useDeleteBannerMutation,
  useReorderBannersMutation,
  useUpdateBannerMutation,
  useUploadBannerImageMutation,
} from '../../features/banners/api/bannerQueries';
import { BANNER_LINK_PATTERN, MAX_BANNERS, type Banner, type BannerPayload } from '../../features/banners/model/bannerTypes';
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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const iso = (value?: Dayjs | null): string | null => (value ? value.toISOString() : null);

/**
 * `Form.Item name="imageUrl"` bolasi: antd `value` ni o'zi uzatadi, shuning
 * uchun "rasm yuklang" xatosi boshqa maydonlardagi kabi ostida chiqadi.
 * Qiymatni sahifa yuklash tugagach `form.setFieldValue` bilan qo'yadi.
 * Forma `id` si tugmaga ATAYLAB berilmaydi: `<label for>` tugma nomini
 * "Banner rasmi" ga almashtirib, ekran o'quvchidan amalni ("Rasm yuklash")
 * yashirardi.
 */
function ImageUploadButton({ value, uploading, percent, disabled, onPick }: { value?: string; uploading: boolean; percent: number | null; disabled: boolean; onPick: (file: File) => void }) {
  const { t } = useTranslation();
  return <Upload accept={IMAGE_TYPES.join(',')} showUploadList={false} disabled={disabled} beforeUpload={file => { onPick(file); return Upload.LIST_IGNORE; }}>
    <Button icon={<ImageUp size={16} />} loading={uploading} disabled={disabled}>
      {percent !== null ? t('admin.banners.uploading', { percent }) : t(value ? 'admin.banners.replace' : 'admin.banners.upload')}
    </Button>
  </Upload>;
}

function payload(values: Partial<BannerValues>): BannerPayload {
  return {
    title: values.title?.trim() ?? '',
    imageUrl: values.imageUrl?.trim() ?? '',
    linkUrl: values.linkUrl?.trim() || null,
    sortOrder: values.sortOrder,
    isActive: values.isActive,
    startsAt: iso(values.startsAt),
    endsAt: iso(values.endsAt),
  };
}

/**
 * Tahrirda faqat admin o'zgartirgan maydonlar yuboriladi. Oldin forma ochilgan
 * paytdagi hamma maydon yuborilardi: shu vaqt ichida boshqa admin bannerni
 * o'chirib qo'ygan yoki joyini o'zgartirgan bo'lsa, "Saqlash" uni jimgina
 * qaytarib yuborardi. `sortOrder` bu yerda umuman yuborilmaydi — tartibni
 * faqat ↑↓ tugmalari o'zgartiradi.
 */
function changedFields(next: BannerPayload, previous: BannerPayload): BannerPayload {
  const keys: (keyof BannerPayload)[] = ['title', 'imageUrl', 'linkUrl', 'isActive', 'startsAt', 'endsAt'];
  return Object.fromEntries(keys.filter(key => next[key] !== previous[key]).map(key => [key, next[key]]));
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
  const upload = useUploadBannerImageMutation();
  const [editing, setEditing] = useState<Banner | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<BannerValues>>({});
  const [saveError, setSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const saving = create.isPending || update.isPending;
  const busy = saving || upload.isPending;
  const imageUrl = Form.useWatch('imageUrl', form);
  const title = Form.useWatch('title', form);
  const banners = query.data ?? [];
  const limitReached = banners.length >= MAX_BANNERS;

  const statusTag = (banner: Banner) => {
    if (banner.isVisible) return <Tag color="green">{t('admin.banners.visible')}</Tag>;
    if (!banner.isActive) return <Tag>{t('admin.banners.hidden')}</Tag>;
    if (banner.endsAt && dayjs(banner.endsAt).isBefore(dayjs())) return <Tag color="red">{t('admin.banners.expired')}</Tag>;
    return <Tag color="blue">{t('admin.banners.scheduled')}</Tag>;
  };

  const openForm = (banner: Banner | null) => {
    setSaveError('');
    setUploadPercent(null);
    form.resetFields();
    // Yangi banner ro'yxat oxiriga tushadi: `banners.length` bo'sh o'rin
    // bo'lmasa o'rtaga yoki boshqasi bilan bir xil tartibga tushardi.
    const nextOrder = banners.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);
    setInitialValues(banner
      ? { title: banner.title, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl ?? undefined, sortOrder: banner.sortOrder, isActive: banner.isActive, startsAt: banner.startsAt ? dayjs(banner.startsAt) : null, endsAt: banner.endsAt ? dayjs(banner.endsAt) : null }
      : { title: '', imageUrl: '', linkUrl: undefined, sortOrder: nextOrder, isActive: true, startsAt: null, endsAt: null });
    setEditing(banner);
  };

  /** Butun ro'yxatni qayta raqamlab yuboramiz — backend bitta tranzaksiyada saqlaydi. */
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

  const uploadImage = (file: File) => {
    setSaveError('');
    if (!IMAGE_TYPES.includes(file.type)) { setSaveError(t('admin.banners.uploadType')); return; }
    if (file.size > MAX_IMAGE_SIZE) { setSaveError(t('admin.banners.uploadTooBig')); return; }
    setUploadPercent(0);
    upload.mutate({ file, onProgress: setUploadPercent }, {
      onSuccess: url => {
        form.setFieldValue('imageUrl', url);
        form.validateFields(['imageUrl']).catch(() => undefined);
      },
      onError: error => setSaveError(getApiErrorMessage(error)),
      onSettled: () => setUploadPercent(null),
    });
  };

  /**
   * Panelda tanlangan sana formaga DARHOL yoziladi. antd `showTime` bilan
   * qiymatni popup yopilgandan keyin (asinxron) topshiradi: admin sanani
   * bosib, to'g'ridan "Saqlash"ni bossa, forma undan oldin o'qib, `null`
   * yuborardi — rejalashtirilgan banner darhol chiqib ketardi.
   */
  const commitDate = (field: 'startsAt' | 'endsAt') => (value: Dayjs | Dayjs[] | null) => {
    form.setFieldValue(field, Array.isArray(value) ? value[0] ?? null : value);
  };

  const preview = (variant: 'desktop' | 'phone') => <figure className={styles.previewFrame}>
    <div className={variant === 'desktop' ? styles.previewDesktop : styles.previewPhone}>
      <img src={imageUrl} alt="" />
      {title?.trim() ? <span className={styles.previewTitle}>{title}</span> : null}
    </div>
    <figcaption>{t(variant === 'desktop' ? 'admin.banners.previewDesktop' : 'admin.banners.previewPhone')}</figcaption>
  </figure>;

  return <main className={styles.page}>
    <PageHeader title={t('admin.banners.title')} description={t('admin.banners.description')} extra={<Button type="primary" icon={<Plus size={18} />} disabled={!query.data || limitReached} onClick={() => openForm(null)}>{t('admin.banners.add')}</Button>} />
    {limitReached ? <Alert type="info" showIcon title={t('admin.banners.limitReached', { max: MAX_BANNERS })} /> : null}
    {query.isPending ? <ContentState state="loading" /> : query.isError ? <ContentState state="error" title={t('admin.banners.loadError')} description={getApiErrorMessage(query.error)} onAction={() => void query.refetch()} /> : (
      <TablePanel title={t('admin.banners.title')} caption={t('pagination.total', { total: banners.length })}>
        {banners.length ? <div className={styles.rows} aria-busy={query.isFetching || reorder.isPending}>
          {banners.map((banner, index) => <div className={styles.row} key={banner.id} data-banner-id={banner.id}>
            <span className={styles.thumb}>{banner.imageUrl ? <img src={banner.imageUrl} alt="" loading="lazy" /> : null}</span>
            <div className={styles.copy}>
              <strong>{banner.title}</strong>
              {banner.linkUrl ? <span className={styles.link}><Link2 size={12} /> {banner.linkUrl}</span> : null}
              <span className={styles.meta}>
                {statusTag(banner)}
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
    <FormModal<BannerValues> title={t(editing ? 'admin.banners.edit' : 'admin.banners.new')} open={editing !== undefined} form={form} initialValues={initialValues} loading={busy} onCancel={() => { if (!upload.isPending) setEditing(undefined); }} onSubmit={values => {
      if (busy) return;
      if (values.startsAt && values.endsAt && !values.endsAt.isAfter(values.startsAt)) {
        setSaveError(t('admin.banners.periodInvalid'));
        return;
      }
      setSaveError('');
      const options = {
        onSuccess: () => { setEditing(undefined); void message.success(t('admin.banners.saved')); },
        onError: (error: Error) => setSaveError(getApiErrorMessage(error)),
      };
      if (!editing) { create.mutate(payload(values), options); return; }
      const changes = changedFields(payload(values), payload(initialValues));
      if (!Object.keys(changes).length) { setEditing(undefined); return; }
      update.mutate({ id: editing.id, payload: changes }, options);
    }}>
      <div className={styles.formIntro}><GalleryHorizontalEnd size={22} /><p>{t('admin.banners.imageHint')}</p></div>
      {saveError ? <Alert className={styles.alert} type="error" showIcon title={saveError} /> : null}
      <Form.Item name="imageUrl" label={t('admin.banners.imageUrl')} extra={t('admin.banners.uploadHint')} rules={[{ required: true, whitespace: true, message: t('admin.banners.imageRequired') }]}>
        <ImageUploadButton uploading={upload.isPending} percent={uploadPercent} disabled={busy} onPick={uploadImage} />
      </Form.Item>
      {imageUrl ? <div className={styles.previewBox}><span>{t('admin.banners.preview')}</span><div className={styles.previewGrid}>{preview('desktop')}{preview('phone')}</div></div> : null}
      <Form.Item name="title" label={t('admin.banners.titleLabel')} extra={t('admin.banners.titleHint')} rules={[{ required: true, whitespace: true, message: t('admin.banners.titleRequired') }, { max: 255 }]}><Input autoFocus maxLength={255} disabled={saving} /></Form.Item>
      <Form.Item name="linkUrl" label={t('admin.banners.linkUrl')} extra={t('admin.banners.linkHint')} rules={[{ max: 1000 }, { pattern: BANNER_LINK_PATTERN, message: t('admin.banners.linkInvalid') }]}><Input prefix={<Link2 size={16} />} placeholder="/katalog/telefon" disabled={saving} /></Form.Item>
      <div className={styles.formGrid}>
        {/* needConfirm={false}: "OK" bosish shart emas. onCalendarChange: qiymat "Saqlash"dan oldin formaga tushsin. */}
        <Form.Item name="startsAt" label={t('admin.banners.startsAt')} extra={t('admin.banners.periodHint')}><DatePicker showTime needConfirm={false} onCalendarChange={commitDate('startsAt')} style={{ width: '100%' }} disabled={saving} /></Form.Item>
        <Form.Item name="endsAt" label={t('admin.banners.endsAt')}><DatePicker showTime needConfirm={false} onCalendarChange={commitDate('endsAt')} style={{ width: '100%' }} disabled={saving} /></Form.Item>
        {editing ? null : <Form.Item name="sortOrder" label={t('admin.common.order')} rules={[{ required: true }]}><InputNumber min={0} max={2147483647} precision={0} style={{ width: '100%' }} disabled={saving} /></Form.Item>}
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
