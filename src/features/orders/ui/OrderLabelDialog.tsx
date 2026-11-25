import { App } from 'antd';
import { CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { fetchFile } from '../../../shared/api/download';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime } from '../../../shared/lib/dayTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { PrintDialog } from '../../../shared/ui/PrintDialog/PrintDialog';
import { useLabelReprintMutation, useOrderQuery } from '../api/ordersQueries';
import { orderNumber } from '../lib/orderView';
import type { OrderListItem } from '../model/orderTypes';
import styles from './OrderDialogs.module.css';

const REASON_MAX = 300;

interface OrderLabelDialogProps {
  order: Pick<OrderListItem, 'id' | 'leadId' | 'buyerName' | 'districtName' | 'status' | 'totalAmount' | 'trackNumber'>;
  onClose: () => void;
}

/**
 * «Yorliqni qayta chop etish» (admin-buyurtmalar [taklif]): server PDF (`GET /admin/orders/{id}/label`) umumiy chop etish
 * oynasida; printer va nusxa — tizim oynasida (komponentlar-E §26). Sabab majburiy — chop etishdan oldin audit jurnaliga
 * yoziladi (taklif `POST /admin/orders/{id}/label/reprints`): kim, qachon, sabab.
 */
export function OrderLabelDialog({ order, onClose }: OrderLabelDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const detail = useOrderQuery('ADMIN', order.id).data;
  const reprint = useLabelReprintMutation();
  const reasonId = useId();
  const errorId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const number = orderNumber(order);
  const act = detail?.parcel?.act ?? null;
  const printed = detail?.parcel?.label ?? null;
  const trimmed = reason.trim();
  const invalid = touched && !trimmed;
  const placement = phone ? 'top' : 'bottomRight';

  const logReason = async () => {
    try {
      await reprint.mutateAsync({ id: order.id, reason: trimmed });
      return true;
    } catch (error) {
      notification.error({ title: t('ord.label.error'), description: getApiErrorMessage(error), placement });
      return false;
    }
  };

  return (
    <PrintDialog
      open
      title={t('ord.label.title')}
      description={[number, t(`status.order.${order.status}`), act ? t('ord.label.inAct', { code: act.code }) : t('ord.label.noAct')].join(' · ')}
      load={() => fetchFile(`/admin/orders/${encodeURIComponent(order.id)}/label`, `yorliq-${number}.pdf`)}
      facts={[
        [t('ord.label.label'), [number, order.buyerName, order.districtName].filter(Boolean).join(' · ')],
        [t('ord.label.cod'), t('ord.sum', { amount: formatMoney(order.totalAmount) })],
        [t('ord.panel.track'), order.trackNumber ?? t('ord.trackOnHandover')],
      ]}
      note={{
        title: t('ord.label.reprint'),
        // «bugun 14:34 da» — vergulsiz (dizayn).
        text: printed ? t('ord.label.reprintText', { id: number, when: dayTime(printed.printedAt, t, undefined, true).replace(', ', ' '), by: printed.by }) : t('ord.label.reprintAudit'),
      }}
      reprint
      previewCaption={t('ord.label.caption')}
      blocked={!trimmed}
      beforeOutput={logReason}
      onClose={onClose}
      onDone={() => notification.success({ title: t('ord.label.done'), description: t('ord.label.doneText', { id: number }), placement, duration: 4 })}
      testId="order-label-dialog"
    >
      <div>
        <div className={styles.labelRow}>
          <label htmlFor={reasonId}>{t('ord.label.reason')} <span className={styles.required} aria-hidden>*</span></label>
        </div>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={REASON_MAX}
          rows={2}
          required
          placeholder={t('ord.label.reasonPlaceholder')}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        {invalid ? <p id={errorId} className={styles.error}><CircleAlert aria-hidden />{t('ord.label.reasonError')}</p> : null}
      </div>
    </PrintDialog>
  );
}
