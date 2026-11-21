import { CircleAlert, FolderTree, Package, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { useDeleteCategoryMutation } from '../../../features/categories/api/categoryQueries';
import type { Category } from '../../../features/categories/model/categoryTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { byStatus } from '../model/categoryRows';
import styles from '../AdminCategoriesPage.module.css';

interface DeleteCategoryDialogProps {
  category: Category;
  parent: Category | null;
  /** Shu kategoriyaning o'zidagi mahsulotlar; `undefined` — ro'yxat hali kelmagan (o'chirish yopiq). */
  products: readonly AdminProductListItem[] | undefined;
  onClose: () => void;
  onDeleted: (category: Category) => void;
}

/**
 * O'chirish (holatlar 4): mahsuloti yoki ichki kategoriyasi bor kategoriya o'chirilmaydi — mahsulot kategoriyasiz
 * qolmaydi (backend ichki kategoriyani tekshiradi, mahsulotni — ekran; taklif fe-12 §9); bo'shi — xavfli tasdiq.
 */
export function DeleteCategoryDialog({ category, parent, products, onClose, onDeleted }: DeleteCategoryDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteCategoryMutation();
  const [error, setError] = useState('');
  const children = category.children;
  const known = products !== undefined;
  const listed = products ?? [];

  if (listed.length || children.length) {
    const reason = listed.length && children.length ? 'acat.delete.hasBoth' : listed.length ? 'acat.delete.hasProducts' : 'acat.delete.hasChildren';
    return (
      <Dialog
        open
        title={t('acat.delete.blockedTitle', { name: category.name })}
        description={t(reason)}
        icon={<TriangleAlert />}
        tone="warning"
        width={440}
        onClose={onClose}
        testId="delete-category"
        footer={(
          <>
            <DialogCancel onClick={onClose}>{t('acat.close')}</DialogCancel>
            {listed.length ? (
              <DialogPrimary shortcut={false} onClick={() => { onClose(); void navigate(`/admin/products?category=${encodeURIComponent(category.id)}`); }}>{t('acat.delete.openProducts')}</DialogPrimary>
            ) : null}
          </>
        )}
      >
        {listed.length ? (
          <div className={styles.warningBox} role="note">
            <Package aria-hidden />
            <div>
              <strong>{t('acat.delete.productCount', { count: listed.length })}</strong>
              <p>{t('acat.delete.moveProducts', { list: byStatus(listed).map((product) => product.name).join(', ') })}</p>
            </div>
          </div>
        ) : null}
        {children.length ? (
          <div className={styles.warningBox} role="note">
            <FolderTree aria-hidden />
            <div>
              <strong>{t('acat.delete.childCount', { count: children.length })}</strong>
              <p>{t('acat.delete.moveChildren', { list: children.map((child) => child.name).join(', ') })}</p>
            </div>
          </div>
        ) : null}
        <p className={styles.formNote}>{t('acat.delete.rule')}</p>
      </Dialog>
    );
  }

  const confirm = () => {
    setError('');
    if (!known) return;
    remove.mutate(category.id, { onSuccess: () => onDeleted(category), onError: (caught) => setError(getApiErrorMessage(caught)) });
  };

  return (
    <Dialog
      open
      title={t('acat.delete.confirmTitle', { name: category.name })}
      description={t('acat.delete.noProducts')}
      icon={<Trash2 />}
      tone="danger"
      width={440}
      locked={remove.isPending}
      onClose={onClose}
      testId="delete-category"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={remove.isPending}>{t('acat.cancel')}</DialogCancel>
          <DialogPrimary danger shortcut={false} icon={<Trash2 aria-hidden />} onClick={confirm} disabled={!known} saving={remove.isPending} savingLabel={t('acat.delete.deleting')}>{t('acat.delete')}</DialogPrimary>
        </>
      )}
    >
      {error ? <p className={styles.formAlert} role="alert"><CircleAlert aria-hidden />{error}</p> : null}
      <dl className={styles.facts}>
        <div><dt>{t('acat.form.parent')}</dt><dd>{parent?.name ?? t('acat.delete.topLevel')}</dd></div>
        <div><dt>{t('acat.delete.products')}</dt><dd>{known ? 0 : '…'}</dd></div>
        <div><dt>{t('acat.delete.menu')}</dt><dd>{t('acat.delete.menuRemoved')}</dd></div>
      </dl>
      <p className={styles.formNote}>{t(known ? 'acat.delete.audit' : 'acat.delete.checking')}</p>
    </Dialog>
  );
}
