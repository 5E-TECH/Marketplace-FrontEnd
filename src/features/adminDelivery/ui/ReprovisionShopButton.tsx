import { App, Button, Popconfirm } from 'antd';
import { RefreshCw } from 'lucide-react';
import { getAuthErrorMessage } from '../../auth/lib/getAuthErrorMessage';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useReprovisionShopMutation } from '../api/adminDeliveryQueries';

interface ReprovisionShopButtonProps {
  shopId: string;
  /** Jadval qatorida faqat ikonka. */
  compact?: boolean;
}

/**
 * C6.7 — do‘konni Elchi’da qayta ro‘yxatdan o‘tkazish (idempotent: yangi
 * market ochilmaydi). Backend xatoni javobda qaytaradi (`status: failed`),
 * shuning uchun muvaffaqiyatli HTTP javobida ham natija tekshiriladi.
 */
export function ReprovisionShopButton({ shopId, compact = false }: ReprovisionShopButtonProps) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const reprovision = useReprovisionShopMutation();
  const run = () => reprovision.mutate(shopId, {
    onSuccess: (result) => {
      if (result.error || result.status === 'failed') {
        void message.error(t('adminOps.reprovision.failed', { error: result.error ?? result.status }));
        return;
      }
      void message.success(t('adminOps.reprovision.done', { market: result.elchiMarketId ?? '—' }));
    },
    onError: (error) => void message.error(getAuthErrorMessage(error)),
  });
  return (
    <Popconfirm title={t('adminOps.reprovision.confirm', { id: shopId })} description={t('adminOps.reprovision.confirmDescription')} onConfirm={run}>
      <Button
        icon={<RefreshCw size={compact ? 15 : 16} />}
        type={compact ? 'text' : 'default'}
        loading={reprovision.isPending}
        aria-label={t('adminOps.reprovision.actionAria', { id: shopId })}
        title={compact ? t('adminOps.reprovision.action') : undefined}
      >
        {compact ? null : t('adminOps.reprovision.action')}
      </Button>
    </Popconfirm>
  );
}
