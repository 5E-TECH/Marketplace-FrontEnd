import { Alert, App, Button, Checkbox, Form, Input, Modal, Popconfirm, Radio, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { Eye, Pencil, RotateCcw, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useBroadcastsQuery, useNotificationTemplatesQuery, usePreviewBroadcastMutation, useResetTemplateMutation, useSendBroadcastMutation, useUpdateTemplateMutation } from '../../features/adminNotifications/api/adminNotificationQueries';
import type { Broadcast, BroadcastAudience, BroadcastChannel, BroadcastMessage, BroadcastPreview, BroadcastStatus, NotificationTemplate } from '../../features/adminNotifications/model/adminNotificationTypes';
import { formatDateTime } from '../../shared/lib/date';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminNotificationsPage.module.css';

type NotificationsTab = 'templates' | 'broadcast';
interface TemplateValues { title: string; body: string }
const statusColor: Record<BroadcastStatus, string> = { QUEUED: 'default', SENDING: 'processing', DONE: 'success', FAILED: 'error' };

/** Ko‘rinishda o‘zgaruvchi o‘rniga uning tavsifi: `{shopName}` → ‹Do‘kon nomi›. */
const sample = (text: string, variables: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => (variables[name] ? `‹${variables[name]}›` : match));

function MessageCard({ title, body }: { title: string; body: string }) {
  return <div className={styles.messageCard}><strong>{title || '—'}</strong><p>{body || '—'}</p></div>;
}

function TemplateEditor({ template, onClose }: { template: NotificationTemplate; onClose: () => void }) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm<TemplateValues>();
  const bodyRef = useRef<TextAreaRef>(null);
  const update = useUpdateTemplateMutation();
  const reset = useResetTemplateMutation();
  const title = Form.useWatch('title', form) ?? template.title;
  const body = Form.useWatch('body', form) ?? template.body;

  /** O‘zgaruvchi kursor turgan joyga qo‘yiladi (bo‘lmasa oxiriga). */
  const insert = (name: string) => {
    const textarea = bodyRef.current?.resizableTextArea?.textArea;
    const raw: unknown = form.getFieldValue('body');
    const current = typeof raw === 'string' ? raw : '';
    const at = textarea ? textarea.selectionStart : current.length;
    form.setFieldValue('body', `${current.slice(0, at)}{${name}}${current.slice(at)}`);
    textarea?.focus();
  };

  return (
    <Modal
      open
      title={t('adminNotify.editTitle', { name: template.name })}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={update.isPending}
      onCancel={() => { if (!update.isPending) onClose(); }}
      onOk={() => form.submit()}
      width="min(640px, 100vw)"
      destroyOnHidden
      footer={(originNode) => <div className={styles.modalFooter}>
        {template.customized ? <Popconfirm title={t('adminNotify.resetConfirm')} onConfirm={() => reset.mutate(template.key, { onSuccess: () => { void message.success(t('adminNotify.resetDone')); onClose(); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}>
          <Button icon={<RotateCcw size={16} />} loading={reset.isPending}>{t('adminNotify.reset')}</Button>
        </Popconfirm> : <span />}
        <span className={styles.footerActions}>{originNode}</span>
      </div>}
    >
      <Typography.Paragraph type="secondary">{template.description}</Typography.Paragraph>
      <Form<TemplateValues> form={form} layout="vertical" initialValues={{ title: template.title, body: template.body }} onFinish={(values) => update.mutate({ key: template.key, title: values.title, body: values.body }, { onSuccess: () => { void message.success(t('adminNotify.saved')); onClose(); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}>
        <Form.Item name="title" label={t('adminNotify.fieldTitle')} rules={[{ required: true, whitespace: true, message: t('adminNotify.required') }, { max: 255 }]}>
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="body" label={t('adminNotify.fieldBody')} rules={[{ required: true, whitespace: true, message: t('adminNotify.required') }, { max: 2000 }]}>
          <Input.TextArea ref={bodyRef} rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
      <div className={styles.variables}>
        <span>{t('adminNotify.variables')}</span>
        <div>{Object.entries(template.variables).map(([name, text]) => (
          <Tooltip key={name} title={text}>
            <Tag className={styles.variable} onClick={() => insert(name)} role="button" tabIndex={0} aria-label={t('adminNotify.insertAria', { name })} onKeyDown={(event) => { if (event.key === 'Enter') insert(name); }}>{`{${name}}`}</Tag>
          </Tooltip>
        ))}</div>
      </div>
      <div className={styles.previewBlock}>
        <span>{t('adminNotify.preview')}</span>
        <MessageCard title={sample(title, template.variables)} body={sample(body, template.variables)} />
      </div>
    </Modal>
  );
}

function TemplatesTab() {
  const { locale, t } = useTranslation();
  const query = useNotificationTemplatesQuery();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);

  const columns: ColumnsType<NotificationTemplate> = [
    { title: t('adminNotify.template'), render: (_, row) => <span className={styles.stack}><Typography.Text strong>{row.name}</Typography.Text><small>{row.description}</small></span> },
    { title: t('adminNotify.message'), responsive: ['md'], render: (_, row) => <span className={styles.stack}><span>{row.title}</span><small className={styles.clamp}>{row.body}</small></span> },
    { title: t('adminNotify.status'), width: 150, render: (_, row) => row.customized ? <Tag color="gold" bordered={false}>{t('adminNotify.customized')}</Tag> : <Tag bordered={false}>{t('adminNotify.default')}</Tag> },
    { title: t('adminNotify.updatedAt'), dataIndex: 'updatedAt', responsive: ['xl'], width: 170, render: (value: string | null) => value ? formatDateTime(value, locale) : '—' },
    { title: '', width: 56, align: 'center', render: (_, row) => <Tooltip title={t('adminNotify.edit')}><Button type="text" icon={<Pencil size={16} />} aria-label={t('adminNotify.editAria', { name: row.name })} onClick={() => setEditing(row)} /></Tooltip> },
  ];

  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('adminNotify.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />;
  return <>
    <TablePanel title={t('adminNotify.templatesTab')} caption={t('pagination.total', { total: query.data.length })}>
      <DataTable rowKey="key" columns={columns} dataSource={query.data} pagination={false} tableLayout="auto" scroll={{ x: 'max-content' }} />
    </TablePanel>
    {editing ? <TemplateEditor template={editing} onClose={() => setEditing(null)} /> : null}
  </>;
}

function BroadcastForm() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm<BroadcastMessage>();
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const previewMutation = usePreviewBroadcastMutation();
  const sendMutation = useSendBroadcastMutation();

  const closePreview = () => { if (!sendMutation.isPending) { setPreview(null); setConfirmed(false); } };
  const send = () => {
    if (!preview) return;
    sendMutation.mutate(preview, {
      onSuccess: (result) => {
        void (result.idempotent ? message.info(t('adminNotify.alreadySent')) : message.success(t('adminNotify.sent', { count: result.recipientsCount })));
        setPreview(null);
        setConfirmed(false);
        form.resetFields();
      },
      // 409: xabar yoki qabul qiluvchilar soni o‘zgargan — qayta ko‘rib chiqish kerak.
      onError: (error) => { void message.error(getAuthErrorMessage(error)); setPreview(null); setConfirmed(false); },
    });
  };

  return <section className={styles.formPanel} aria-label={t('adminNotify.broadcastTab')}>
    <Form<BroadcastMessage> form={form} layout="vertical" initialValues={{ audience: 'all', channels: [] }} onFinish={(values) => previewMutation.mutate({ ...values, channels: values.channels ?? [] }, { onSuccess: setPreview, onError: (error) => void message.error(getAuthErrorMessage(error)) })}>
      <Form.Item name="audience" label={t('adminNotify.audience')}>
        <Radio.Group optionType="button" options={(['all', 'sellers', 'buyers'] as BroadcastAudience[]).map((value) => ({ value, label: t(`adminNotify.audience.${value}` as TranslationKey) }))} />
      </Form.Item>
      <Form.Item name="channels" label={t('adminNotify.channels')} extra={t('adminNotify.channelsHint')}>
        <Checkbox.Group options={(['sms', 'email'] as BroadcastChannel[]).map((value) => ({ value, label: t(`adminNotify.channel.${value}` as TranslationKey) }))} />
      </Form.Item>
      <Form.Item name="title" label={t('adminNotify.fieldTitle')} rules={[{ required: true, whitespace: true, message: t('adminNotify.required') }, { max: 255 }]}>
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="body" label={t('adminNotify.fieldBody')} rules={[{ required: true, whitespace: true, message: t('adminNotify.required') }, { max: 2000 }]}>
        <Input.TextArea rows={4} maxLength={2000} showCount />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<Eye size={16} />} loading={previewMutation.isPending}>{t('adminNotify.previewAction')}</Button>
    </Form>
    <Modal
      open={Boolean(preview)}
      title={t('adminNotify.confirmTitle')}
      onCancel={closePreview}
      okText={t('adminNotify.send')}
      okButtonProps={{ danger: true, icon: <Send size={16} />, disabled: !confirmed || !preview?.recipientsCount, loading: sendMutation.isPending }}
      cancelText={t('common.cancel')}
      onOk={send}
      destroyOnHidden
    >
      {preview ? <div className={styles.confirm}>
        <dl className={styles.facts}>
          <dt>{t('adminNotify.audience')}</dt><dd>{t(`adminNotify.audience.${preview.audience}` as TranslationKey)}</dd>
          <dt>{t('adminNotify.recipients')}</dt><dd><strong>{t('adminNotify.recipientsCount', { count: preview.recipientsCount })}</strong></dd>
          <dt>{t('adminNotify.channelsAll')}</dt><dd>{[t('adminNotify.channel.inapp'), ...preview.channels.map((channel) => t(`adminNotify.channel.${channel}` as TranslationKey))].join(', ')}</dd>
        </dl>
        <MessageCard title={preview.title} body={preview.body} />
        {preview.recipientsCount ? <>
          <Alert type="warning" showIcon title={t('adminNotify.irreversible')} />
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>{t('adminNotify.confirmCheck', { count: preview.recipientsCount })}</Checkbox>
        </> : <Alert type="info" showIcon title={t('adminNotify.noRecipients')} />}
      </div> : null}
    </Modal>
  </section>;
}

function BroadcastHistory() {
  const { locale, t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useBroadcastsQuery(page);
  const columns: ColumnsType<Broadcast> = [
    { title: t('adminNotify.date'), dataIndex: 'createdAt', width: 170, render: (value: string) => value ? formatDateTime(value, locale) : '—' },
    { title: t('adminNotify.message'), render: (_, row) => <span className={styles.stack}><Typography.Text strong>{row.title}</Typography.Text><small className={styles.clamp}>{row.body}</small></span> },
    { title: t('adminNotify.audience'), dataIndex: 'audience', responsive: ['md'], render: (value: BroadcastAudience) => t(`adminNotify.audience.${value}` as TranslationKey) },
    { title: t('adminNotify.status'), render: (_, row) => <Tooltip title={row.lastError ?? undefined}><Tag color={statusColor[row.status]} bordered={false}>{t(`adminNotify.status.${row.status}` as TranslationKey)}</Tag></Tooltip> },
    { title: t('adminNotify.progress'), align: 'right', render: (_, row) => <span className={styles.number}>{row.sentCount} / {row.recipientsCount}</span> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('adminNotify.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />;
  return <TablePanel title={t('adminNotify.history')} caption={t('pagination.total', { total: query.data.total })}>
    <DataTable rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" scroll={{ x: 'max-content' }} emptyState={<EmptyState compact title={t('adminNotify.emptyHistory')} />} pagination={query.data.total > 10 ? { ...createTablePagination(10, (total) => t('pagination.total', { total })), current: page, total: query.data.total } : false} onChange={(pagination) => setPage(pagination.current ?? 1)} />
  </TablePanel>;
}

function BroadcastTab() {
  const { t } = useTranslation();
  const isSuperadmin = useAppSelector(selectAuthUser)?.role === 'SUPERADMIN';
  return <div className={styles.stackGap}>
    {isSuperadmin ? <BroadcastForm /> : <Alert type="info" showIcon title={t('adminNotify.superadminOnly')} />}
    <BroadcastHistory />
  </div>;
}

/** C6.8 — xabar shablonlari va ommaviy xabar. */
export default function AdminNotificationsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: NotificationsTab = searchParams.get('tab') === 'broadcast' ? 'broadcast' : 'templates';
  return <main className={styles.page}>
    <PageHeader title={t('adminNotify.title')} description={t('adminNotify.description')} />
    <Tabs activeKey={tab} destroyOnHidden onChange={(key) => setSearchParams(key === 'templates' ? {} : { tab: key }, { replace: true })} items={[
      { key: 'templates', label: t('adminNotify.templatesTab'), children: <TemplatesTab /> },
      { key: 'broadcast', label: t('adminNotify.broadcastTab'), children: <BroadcastTab /> },
    ]} />
  </main>;
}
