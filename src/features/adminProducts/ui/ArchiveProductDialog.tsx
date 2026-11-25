import { App } from 'antd';
import { Archive } from 'lucide-react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { useArchiveProductMutation } from '../api/adminProductsQueries';
import type { AdminProduct, ProductStockSummary } from '../model/adminProductTypes';
import { productBadgeCode } from './adminProductModerationConfig';
import { ConditionList } from './SideCard';
import styles from './form/ProductForm.module.css';

/**
 * «Arxivlash» (admin-mahsulot-karta.holatlar 4, Ph9): karta, narx qarorlari va audit saqlanadi, ro'yxatdan yashiriladi
 * («Arxiv» filtri). Sotuvdagi (to'xtatilmagan) yoki qoldig'i bor mahsulot arxivlanmaydi — sababi ko'rsatiladi (taklif §10).
 */
export function ArchiveProductDialog({ product, stock, onClose }: { product: AdminProduct; stock: ProductStockSummary | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const archive = useArchiveProductMutation();
  const code = productBadgeCode(product);
  const onSale = product.status === 'ACTIVE' && !product.isBlocked;
  const pieces = stock ? stock.onHand + stock.reserved : 0;
  const blocker = onSale ? t('apf.archive.onSale') : pieces > 0 ? t('apf.archive.hasStock', { count: formatMoney(pieces) }) : null;

  const submit = () => {
    if (blocker) return;
    archive.mutate(product.id, {
      onSuccess: () => {
        notification.success({ title: t('apf.archive.done', { name: product.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('apf.archive.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('apf.archive.title', { name: product.name })}
      description={t(`apf.archive.subtitle.${code}` as TranslationKey)}
      icon={<Archive />}
      tone="danger"
      locked={archive.isPending}
      onClose={onClose}
      testId="archive-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={archive.isPending}>{t('apf.footer.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} disabled={Boolean(blocker)} saving={archive.isPending} savingLabel={t('apf.footer.saving')} shortcut={false} danger icon={<Archive />}>
            {t('apf.archive.confirm')}
          </DialogPrimary>
        </>
      )}
    >
      <ConditionList
        items={[
          { ok: true, title: t('apf.archive.kept'), hint: t('apf.archive.keptHint') },
          { ok: true, title: t('apf.archive.hidden'), hint: t('apf.archive.hiddenHint') },
          blocker
            ? { ok: false, title: t('apf.archive.blockedTitle'), hint: blocker }
            : { ok: false, notNeeded: true, title: t('apf.archive.blockedTitle'), hint: t('apf.archive.blockedHint') },
        ]}
      />
      <p className={styles.note}>{blocker ?? t(`apf.archive.free.${code}` as TranslationKey)}</p>
    </Dialog>
  );
}
