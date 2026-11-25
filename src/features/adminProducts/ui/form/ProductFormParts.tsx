import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { PageActionBar } from '../../../../shared/ui/PageActionBar/PageActionBar';
import { FIELD_ORDER, type ProductErrors } from '../../model/productForm';
import styles from './ProductForm.module.css';

/** «Saqlanmadi: N ta maydonda xato» (…holatlar «Forma xatolari»): qaysi maydon — nomi bilan; matn maydon ostida. */
export function ProductErrorSummary({ errors }: { errors: ProductErrors }) {
  const { t } = useTranslation();
  const fields = FIELD_ORDER.filter((field) => errors[field]);
  if (!fields.length) return null;
  const names = fields.map((field) => t(`apf.field.${field}` as TranslationKey));
  const single = fields.length === 1;
  const missing = single && (errors[fields[0]] === 'required' || errors[fields[0]] === 'weight' || errors[fields[0]] === 'image');
  return (
    <div className={styles.summary} role="alert" data-testid="product-form-errors">
      <CircleX aria-hidden />
      <div>
        <p>{t('apf.summary.title', { count: fields.length })}</p>
        <p>{single ? t(missing ? 'apf.summary.required' : 'apf.summary.invalid', { field: names[0] }) : t('apf.summary.many', { fields: names.join(', ') })}</p>
      </div>
    </div>
  );
}

interface FooterProps {
  dirty: boolean;
  saving: boolean;
  phone: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Pastki panel (admin-mahsulot-karta): o'zgarish bo'lmasa «Saqlash» o'chiq va sababi yozilgan; telefonda — pastki amal
 * paneli (Bekor qilish | Saqlash, ostida holat).
 */
export function ProductFormFooter({ dirty, saving, phone, onCancel, onSave }: FooterProps) {
  const { t } = useTranslation();
  const cancel = <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>{t('apf.footer.cancel')}</button>;
  const save = <button type="button" className={styles.primary} onClick={onSave} disabled={!dirty || saving} aria-busy={saving || undefined}>{t(saving ? 'apf.footer.saving' : 'apf.footer.save')}</button>;
  if (phone) {
    return (
      <PageActionBar>
        <div className={styles.phoneBar}>
          <div>{cancel}{save}</div>
          <p>{dirty ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden />}{t(dirty ? 'apf.footer.dirtyShort' : 'apf.footer.cleanShort')}</p>
        </div>
      </PageActionBar>
    );
  }
  return (
    <div className={styles.footer} data-testid="product-form-footer">
      <p data-dirty={dirty || undefined}>{t(dirty ? 'apf.footer.dirty' : 'apf.footer.clean')}</p>
      {cancel}
      {save}
    </div>
  );
}
