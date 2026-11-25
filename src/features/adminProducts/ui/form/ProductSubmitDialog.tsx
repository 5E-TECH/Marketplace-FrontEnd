import { App } from 'antd';
import { Send } from 'lucide-react';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { useCreativesQuery, useProductPricingQuery, useSubmitProductMutation } from '../../api/adminProductsQueries';
import type { AdminProduct } from '../../model/adminProductTypes';
import { ConditionList } from '../SideCard';
import styles from './ProductForm.module.css';

/**
 * «Moderatsiyaga yuborish» (…holatlar 4-bo'lim): qoralama yoki tuzatilgan rad etilgan mahsulot — shartnoma, majburiy
 * maydonlar, og'irlik va yetkazish, video; tasdiqlansa — PENDING_REVIEW (taklif §9 `POST …/submit`).
 */
export function ProductSubmitDialog({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const submit = useSubmitProductMutation();
  const pricing = useProductPricingQuery(product.id).data;
  const videos = (useCreativesQuery(product.id).data ?? []).filter((creative) => creative.type === 'VIDEO').length;
  const kg = String((product.weightGrams ?? 0) / 1000);
  const since = tashkentDay(product.statusChangedAt ?? product.updatedAt);

  const send = () => submit.mutate(product.id, {
    onSuccess: () => {
      notification.success({ title: t('apf.submit.done', { name: product.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
      onClose();
    },
    onError: (error) => notification.error({ title: t('apf.submit.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
  });

  return (
    <Dialog
      open
      title={t('apf.submit.title', { name: product.name })}
      description={t(product.status === 'REJECTED' ? 'apf.submit.sinceRejected' : 'apf.submit.since', { date: since })}
      icon={<Send />}
      locked={submit.isPending}
      onClose={onClose}
      testId="submit-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={submit.isPending}>{t('apf.footer.cancel')}</DialogCancel>
          <DialogPrimary onClick={send} saving={submit.isPending} savingLabel={t('apf.footer.saving')} shortcut={false} icon={<Send />}>{t('apf.submit.confirm')}</DialogPrimary>
        </>
      )}
    >
      <ConditionList
        items={[
          { ok: product.shop?.hasContract !== false, title: t('apf.submit.contract'), hint: product.shop?.name ?? null },
          { ok: true, title: t('apf.submit.fields'), hint: t('apf.cond.fieldsDone') },
          {
            ok: Boolean(product.weightGrams),
            title: t('apf.submit.weight', { kg }),
            hint: pricing ? t('apf.submit.weightHint', { mode: t(`apf.modeTitle.${pricing.params.deliveryMode}` as TranslationKey), amount: formatMoney(pricing.calculation.delivery.visibleCenter) }) : null,
          },
          videos
            ? { ok: true, title: t('apf.submit.videos', { count: videos }), hint: null }
            : { ok: false, pending: true, title: t('apf.submit.noVideo'), hint: t('apf.submit.noVideoHint') },
        ]}
      />
      <p className={styles.note}>{t('apf.submit.text')}</p>
    </Dialog>
  );
}
