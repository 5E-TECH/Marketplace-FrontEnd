import { App } from 'antd';
import { ChevronRight, CircleCheck, CircleX, PauseCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useHideProductMutation } from '../api/adminProductsQueries';
import type { AdminProductListItem } from '../model/adminProductTypes';
import { REJECT_REASON_MAX } from './adminProductModerationConfig';
import styles from './StopProductDialog.module.css';

interface StopProductDialogProps {
  product: Pick<AdminProductListItem, 'id' | 'name' | 'stock'>;
  /** Offer yorlig'ida ochilganda «Oqibatlarini batafsil ko'rish» havolasi kerak emas. */
  showDetailsLink?: boolean;
  onClose: () => void;
}

/**
 * «{Mahsulot}ni to'xtatasizmi?» (admin-mahsulotlar 3, admin-offer «To'xtatish oqibati»): sabab majburiy —
 * sotuvchilar kabinetida va auditda ko'rinadi (`POST /admin/products/{id}/hide`). Yangi sahifa ochilmaydi,
 * band buyurtmalar odatdagidek yetkaziladi.
 */
export function StopProductDialog({ product, showDetailsLink = true, onClose }: StopProductDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const reasonId = useId();
  const hide = useHideProductMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const reserved = product.stock?.reserved ?? 0;

  const submit = () => {
    setTouched(true);
    if (!trimmed || hide.isPending) return;
    hide.mutate({ id: product.id, reason: trimmed }, {
      onSuccess: () => {
        notification.success({ title: t('stop.toast', { name: product.name }), description: t('stop.toastText'), placement: phone ? 'top' : 'bottomRight', duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('stop.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('stop.title', { name: product.name })}
      description={t('stop.text')}
      icon={<PauseCircle />}
      tone="warning"
      locked={hide.isPending}
      onClose={onClose}
      testId="stop-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={hide.isPending}>{t('moderation.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={hide.isPending} savingLabel={t('moderation.saving')} shortcut={false} danger icon={<PauseCircle />} disabled={touched && !trimmed}>
            {t('stop.confirm')}
          </DialogPrimary>
        </>
      )}
    >
      <div>
        <div className={styles.labelRow}>
          <label htmlFor={reasonId}>{t('stop.reason')} <span aria-hidden>*</span></label>
        </div>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={REJECT_REASON_MAX}
          required
          autoFocus
          placeholder={t('stop.reasonPlaceholder')}
          aria-invalid={(touched && !trimmed) || undefined}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className={styles.hint}>{t('stop.reasonHint')}</p>
      </div>
      <div>
        <p className={styles.caption}>{t('stop.what')}</p>
        <ul className={styles.effects}>
          <li>
            <CircleX aria-hidden data-tone="danger" />
            <span>
              <span><span className={styles.visuallyHidden}>{t('stop.stopped')} </span>{t('stop.catalog')}</span>
              <span>{t('stop.catalogText')}</span>
            </span>
          </li>
          <li>
            <CircleCheck aria-hidden data-tone="success" />
            <span>
              <span><span className={styles.visuallyHidden}>{t('stop.continues')} </span>{reserved ? t('stop.orders', { count: reserved }) : t('stop.ordersNone')}</span>
              <span>{t('stop.ordersText')}</span>
            </span>
          </li>
        </ul>
      </div>
      {showDetailsLink ? (
        <Link className={styles.link} to={`/admin/products/${encodeURIComponent(product.id)}?tab=offer`} onClick={onClose}>
          {t('stop.details')}
          <ChevronRight aria-hidden />
        </Link>
      ) : null}
    </Dialog>
  );
}
