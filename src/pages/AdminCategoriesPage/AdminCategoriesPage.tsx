import { Alert, App, Avatar, Button, Form, Input, InputNumber, Space, Switch, Tag, TreeSelect } from 'antd';
import { ChevronRight, FolderTree, Image, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminCategoriesQuery, useCreateCategoryMutation, useDeleteCategoryMutation, useUpdateCategoryMutation } from '../../features/categories/api/categoryQueries';
import type { Category, CategoryPayload } from '../../features/categories/model/categoryTypes';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminCategoriesPage.module.css';

interface CategoryValues { name: string; parentId?: string; iconUrl?: string; sortOrder: number; isActive: boolean }
interface ParentOption { value: string; title: string; children: ParentOption[] }

function flatten(items: Category[]): Category[] {
  return items.flatMap(item => [item, ...flatten(item.children)]);
}

function parentOptions(items: Category[], excluded: Set<string>): ParentOption[] {
  return items.filter(item => !excluded.has(item.id)).map(item => ({ value: item.id, title: item.name, children: parentOptions(item.children, excluded) }));
}

function filterTree(items: Category[], search: string): Category[] {
  return items.flatMap(item => {
    if (`${item.name} ${item.slug}`.toLowerCase().includes(search)) return [item];
    const children = filterTree(item.children, search);
    return children.length ? [{ ...item, children }] : [];
  });
}

function payload(values: CategoryValues): CategoryPayload {
  return { name: values.name.trim(), parentId: values.parentId || null, iconUrl: values.iconUrl?.trim() || null, sortOrder: values.sortOrder, isActive: values.isActive };
}

interface CategoryTreeProps {
  items: Category[];
  collapsed: string[];
  onToggle: (id: string, expanded: boolean) => void;
  onAdd: (parentId: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function CategoryTree({ items, collapsed, onToggle, onAdd, onEdit, onDelete }: CategoryTreeProps) {
  const { t } = useTranslation();
  return <ul className={styles.treeGroup} role="group">
    {items.map(category => {
      const hasChildren = category.children.length > 0;
      const expanded = hasChildren && !collapsed.includes(category.id);
      return <li className={styles.treeItem} role="treeitem" aria-expanded={hasChildren ? expanded : undefined} data-category-id={category.id} key={category.id}>
        <div className={styles.node}>
          <span className={styles.nodeBranch}>
            {hasChildren ? <button type="button" className={styles.expandButton} aria-label={t(expanded ? 'admin.categories.hideChildrenAria' : 'admin.categories.showChildrenAria', { name: category.name })} onClick={() => onToggle(category.id, expanded)}><ChevronRight size={16} /></button> : <span className={styles.leafDot} aria-hidden />}
          </span>
          <Avatar className={styles.icon} shape="square" size={42} src={category.iconUrl || undefined} icon={<FolderTree size={20} />} />
          <div className={styles.categoryText}><strong>{category.name}</strong><span>/{category.slug || '—'}</span></div>
          <div className={styles.nodeMeta}>
            {hasChildren ? <span className={styles.childCount}>{t('admin.categories.childCount', { count: category.children.length })}</span> : null}
            <span className={styles.order}><small>{t('admin.common.order')}</small>{category.sortOrder}</span>
            <Tag color={category.isActive ? 'success' : 'default'}>{t(category.isActive ? 'status.active' : 'status.inactive')}</Tag>
          </div>
          <Space className={styles.actions} size={2}>
            <Button type="text" icon={<Plus size={16} />} aria-label={t('admin.categories.addChildAria', { name: category.name })} onClick={() => onAdd(category.id)} />
            <Button type="text" icon={<Pencil size={16} />} aria-label={t('admin.categories.editAria', { name: category.name })} onClick={() => onEdit(category)} />
            <Button type="text" danger icon={<Trash2 size={16} />} aria-label={t('admin.categories.deleteAria', { name: category.name })} onClick={() => onDelete(category)} />
          </Space>
        </div>
        {expanded ? <CategoryTree items={category.children} collapsed={collapsed} onToggle={onToggle} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} /> : null}
      </li>;
    })}
  </ul>;
}

export default function AdminCategoriesPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm<CategoryValues>();
  const [editing, setEditing] = useState<Category | null | undefined>();
  const [initialValues, setInitialValues] = useState<CategoryValues>();
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [saveError, setSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const graphScrollRef = useRef<HTMLDivElement>(null);
  const query = useAdminCategoriesQuery();
  const create = useCreateCategoryMutation();
  const update = useUpdateCategoryMutation();
  const remove = useDeleteCategoryMutation();
  const flat = useMemo(() => flatten(query.data ?? []), [query.data]);
  const branchIds = flat.filter(item => item.children.length).map(item => item.id);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleTree = useMemo(() => filterTree(query.data ?? [], normalizedSearch), [query.data, normalizedSearch]);
  const excludedParents = useMemo(() => new Set(editing ? flatten([editing]).map(item => item.id) : []), [editing]);
  const saving = create.isPending || update.isPending;
  const iconUrl = Form.useWatch('iconUrl', form);

  useEffect(() => {
    const scroller = graphScrollRef.current;
    const graph = scroller?.firstElementChild;
    if (!scroller || !graph) return;

    let frame = 0;
    const centerRoot = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
      });
    };
    const observer = new ResizeObserver(centerRoot);
    observer.observe(graph);
    centerRoot();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [visibleTree]);

  const openForm = (category: Category | null, parentId?: string) => {
    setSaveError('');
    form.resetFields();
    setInitialValues(category
      ? { name: category.name, parentId: category.parentId ?? undefined, iconUrl: category.iconUrl ?? undefined, sortOrder: category.sortOrder, isActive: category.isActive }
      : { name: '', parentId, iconUrl: undefined, sortOrder: 0, isActive: true });
    setEditing(category);
  };
  return <main className={styles.page}>
    <PageHeader title={t('admin.categories.title')} description={t('admin.categories.description')} extra={<Button type="primary" icon={<Plus size={18} />} disabled={!query.data} onClick={() => openForm(null)}>{t('admin.categories.add')}</Button>} />
    {query.isPending ? <ContentState state="loading" /> : query.isError ? <ContentState state="error" title={t('admin.categories.loadError')} description={getApiErrorMessage(query.error)} onAction={() => void query.refetch()} /> : <>
      <div className={styles.overview}>
        <span className={styles.overviewIcon}><FolderTree size={25} /></span>
        <div className={styles.overviewCopy}><strong>{t('admin.categories.tree')}</strong><span>{t('admin.categories.treeHint')}</span></div>
        <div className={styles.stats}><span><b>{query.data.length}</b>{t('admin.categories.roots')}</span><span><b>{flat.filter(item => item.isActive).length}</b>{t('status.active')}</span><span><b>{flat.filter(item => !item.isActive).length}</b>{t('status.inactive')}</span></div>
      </div>
      <TablePanel title={t('admin.categories.tree')} caption={t('pagination.total', { total: flat.length })}>
        <div className={styles.toolbar}>
          <Input prefix={<Search size={17} />} allowClear value={search} onChange={event => setSearch(event.target.value)} placeholder={t('admin.categories.search')} aria-label={t('admin.categories.search')} />
          <Button icon={<Layers size={16} />} disabled={!branchIds.length || Boolean(normalizedSearch)} onClick={() => setCollapsed(collapsed.length ? [] : branchIds)}>{t(collapsed.length ? 'admin.categories.expand' : 'admin.categories.collapse')}</Button>
        </div>
        <div className={styles.treeViewport} aria-busy={query.isFetching}>
          {visibleTree.length ? <div ref={graphScrollRef} className={styles.graphScroller} data-testid="category-tree-scroll" tabIndex={0}>
            <div className={styles.graph} role="tree" aria-label={t('admin.categories.tree')}>
              <div className={styles.rootNode} data-testid="category-tree-root">
                <span><FolderTree size={23} /></span>
                <div><strong>{t('admin.categories.allCategories')}</strong><small>{t('pagination.total', { total: flat.length })}</small></div>
              </div>
              <CategoryTree items={visibleTree} collapsed={normalizedSearch ? [] : collapsed} onToggle={(id, expanded) => setCollapsed(previous => expanded ? [...previous, id] : previous.filter(item => item !== id))} onAdd={parentId => openForm(null, parentId)} onEdit={openForm} onDelete={category => { setDeleteError(''); setDeleting(category); }} />
            </div>
          </div> : <EmptyState compact title={t(normalizedSearch ? 'admin.categories.noResults' : 'admin.categories.empty')} description={t(normalizedSearch ? 'admin.categories.noResultsHint' : 'admin.categories.emptyDescription')} />}
        </div>
      </TablePanel>
    </>}
    <FormModal<CategoryValues> title={t(editing ? 'admin.categories.edit' : 'admin.categories.new')} open={editing !== undefined} form={form} initialValues={initialValues} loading={saving} onCancel={() => setEditing(undefined)} onSubmit={values => {
      if (saving) return;
      setSaveError('');
      const options = {
        onSuccess: () => { setEditing(undefined); setSearch(''); setCollapsed([]); void message.success(t('admin.categories.saved')); },
        onError: (error: Error) => {
          const errorText = getApiErrorMessage(error);
          setSaveError(errorText);
          if (/slug/i.test(errorText)) form.setFields([{ name: 'name', errors: [errorText] }]);
        },
      };
      if (editing) update.mutate({ id: editing.id, payload: payload(values) }, options); else create.mutate(payload(values), options);
    }}>
      <div className={styles.formIntro}><FolderTree size={22} /><p>{t('admin.categories.formHint')}</p></div>
      {saveError ? <Alert className={styles.alert} type="error" showIcon title={saveError} /> : null}
      <Form.Item name="name" label={t('admin.common.name')} extra={t('admin.categories.slugHint')} rules={[{ required: true, whitespace: true, message: t('admin.categories.nameRequired') }, { max: 255 }]}><Input autoFocus maxLength={255} disabled={saving} /></Form.Item>
      <Form.Item name="parentId" label={t('admin.categories.parent')}><TreeSelect allowClear showSearch treeDefaultExpandAll treeNodeFilterProp="title" treeData={parentOptions(query.data ?? [], excludedParents)} placeholder={t('admin.categories.rootPlaceholder')} disabled={saving} /></Form.Item>
      <Form.Item name="iconUrl" label={t('admin.categories.iconUrl')} rules={[{ type: 'url' }, { max: 500 }]}><Input prefix={<Image size={16} />} placeholder="https://…" disabled={saving} /></Form.Item>
      <div className={styles.formBottom}>
        <div className={styles.iconPreview}><Avatar shape="square" size={48} src={iconUrl || undefined} icon={<FolderTree size={24} />} /><span>{t('admin.categories.iconPreview')}</span></div>
        <Form.Item name="sortOrder" label={t('admin.categories.orderNumber')} rules={[{ required: true }]}><InputNumber min={0} max={2147483647} precision={0} disabled={saving} /></Form.Item>
        <Form.Item name="isActive" label={t('status.active')} valuePropName="checked"><Switch disabled={saving} /></Form.Item>
      </div>
    </FormModal>
    <ConfirmDialog open={Boolean(deleting)} title={t('admin.categories.deleteTitle')} description={<><p><strong>{deleting?.name}</strong></p><p>{t('admin.categories.deleteDescription')}</p>{deleteError ? <Alert type="error" showIcon title={deleteError} /> : null}</>} confirmText={t('common.delete')} danger loading={remove.isPending} onCancel={() => { if (!remove.isPending) setDeleting(null); }} onConfirm={() => {
      if (!deleting || remove.isPending) return;
      setDeleteError('');
      remove.mutate(deleting.id, { onSuccess: () => { setDeleting(null); void message.success(t('admin.categories.deleted')); }, onError: error => setDeleteError(getApiErrorMessage(error)) });
    }} />
  </main>;
}
