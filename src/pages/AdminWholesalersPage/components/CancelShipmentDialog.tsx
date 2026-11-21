import { App } from 'antd';
import { CircleX } from 'lucide-react';
import { useId, useState } from 'react';
import { useCancelShipmentMutation } from '../../../features/inbound/api/inboundQueries';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import styles from './CancelShipmentDialog.module.css';

const REASONS = ['mistake', 'withdrawn', 'duplicate'] as const;

/** «P-0114 arizasini bekor qilish» (admin-postavka 3): faqat «E'lon qilindi», sabab majburiy, xavfli tugma o'ngda. */
export function CancelShipmentDialog({ shipment, onClose }: { shipment: InboundShipment | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const cancel = useCancelShipmentMutation();
  const id = useId();
  const [reason, setReason] = useState<string | null>(null);
  const close = () => {
    setReason(null);
    onClose();
  };

  const submit = () => {
    if (!shipment || !reason || cancel.isPending) return;
    cancel.mutate({ id: shipment.id, reason: t(`inb.cancel.reason.${reason as (typeof REASONS)[number]}`) }, {
      onSuccess: () => {
        notification.success({ title: t('inb.cancel.done', { number: shipment.number }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
        close();
      },
      onError: (error) => notification.error({ title: t('inb.cancel.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open={shipment !== null}
      title={shipment ? t('inb.cancel.title', { number: shipment.number }) : ''}
      description={t('inb.cancel.sub')}
      icon={<CircleX size={20} />}
      tone="danger"
      width={440}
      locked={cancel.isPending}
      onClose={close}
      testId="cancel-shipment"
      footer={(
        <>
          <DialogCancel onClick={close} disabled={cancel.isPending}>{t('inb.cancel.back')}</DialogCancel>
          <DialogPrimary danger shortcut={false} disabled={!reason} saving={cancel.isPending} onClick={submit}>{t('inb.cancel.submit')}</DialogPrimary>
        </>
      )}
    >
      {shipment ? (
        <>
          <dl className={styles.facts}>
            <div><dt>{t('inb.cancel.shipment')}</dt><dd>{shipment.number} · {t(`status.shipment.${shipment.status}`)}</dd></div>
            <div><dt>{t('inb.cancel.product')}</dt><dd>{shipment.sku.name} · {t('inb.pieces', { count: shipment.declared })}</dd></div>
            <div><dt>{t('inb.cancel.expected')}</dt><dd>{isoToDots(shipment.expectedAt)}</dd></div>
            <div><dt>{t('inb.cancel.wholesaler')}</dt><dd>{shipment.wholesaler.name}</dd></div>
          </dl>
          <div>
            <label className={styles.label} htmlFor={`${id}-reason`}>{t('inb.cancel.reason')} <span className={styles.required}>*</span></label>
            <SearchSelect
              id={`${id}-reason`}
              label={t('inb.cancel.reason')}
              value={reason}
              placeholder={t('inb.cancel.reasonPlaceholder')}
              searchable={false}
              options={REASONS.map((value) => ({ value, label: t(`inb.cancel.reason.${value}`) }))}
              onChange={setReason}
            />
          </div>
          <p className={styles.rule}>{t('inb.cancel.rule')}</p>
        </>
      ) : null}
    </Dialog>
  );
}
