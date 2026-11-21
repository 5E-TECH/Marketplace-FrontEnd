import { CircleCheck, CircleX, History, Info, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { OfferReadiness } from '../../../features/adminProducts/lib/offerReadiness';
import type { AdminProduct } from '../../../features/adminProducts/model/adminProductTypes';
import { REJECT_REASON_MAX, type ModerationRule } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import styles from '../AdminModerationPage.module.css';

/** Ctrl+Enter — oynaning asosiy amali (dizayndagi belgi bilan). */
function useCtrlEnter(active: boolean, action: () => void) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, action]);
}

interface ApproveDialogProps {
  open: boolean;
  product: AdminProduct;
  total: number;
  readiness: OfferReadiness;
  who: string;
  date: string;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 6.1 «Mahsulotni tasdiqlaysizmi?» — qo'llanadigan bandlar belgilangach; katalogga chiqish shartlari. */
export function ApproveDialog({ open, product, total, readiness, who, date, saving, onConfirm, onClose }: ApproveDialogProps) {
  const { t } = useTranslation();
  useCtrlEnter(open && !saving, onConfirm);
  const missing = (['price', 'video', 'stock'] as const).filter((key) => !readiness.conditions[key]);
  return (
    <Dialog
      open={open}
      title={t('moderation.approveTitle')}
      description={t('moderation.dialogSubtitle', { name: product.name, shop: product.shop?.name ?? '—' })}
      icon={<ShieldCheck />}
      tone="success"
      width={440}
      locked={saving}
      onClose={onClose}
      testId="approve-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('moderation.cancel')}</DialogCancel>
          <DialogPrimary onClick={onConfirm} saving={saving} savingLabel={t('moderation.saving')} shortcut={false}>{t('moderation.approveConfirm')}</DialogPrimary>
        </>
      )}
    >
      <p className={styles.progress} data-complete>
        <CircleCheck aria-hidden />
        {t('moderation.progress', { total, done: total })}
      </p>
      <ul className={styles.consequences}>
        <li data-tone="success"><CircleCheck aria-hidden /><span>{t('moderation.afterApprove')}</span></li>
        <li data-tone="info">
          <Info aria-hidden />
          <span>
            {missing.length
              ? `${t('moderation.afterApproveCatalog')} ${t('moderation.approveMissing', { missing: missing.map((key) => t(`moderation.missing.${key}` as TranslationKey)).join(', ') })}`
              : t('moderation.approveReady')}
          </span>
        </li>
        <li data-tone="muted"><History aria-hidden /><span>{t('moderation.approveAudit', { who, date })}</span></li>
      </ul>
    </Dialog>
  );
}

interface RejectDialogProps {
  open: boolean;
  product: AdminProduct;
  unchecked: readonly ModerationRule[];
  initialReason: string;
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** 6.2 «Mahsulotni rad etish» — sabab majburiy (optovik kabinetida ko'rinadi), belgilanmagan bandlar. */
export function RejectDialog({ open, product, unchecked, initialReason, saving, onConfirm, onClose }: RejectDialogProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const [reason, setReason] = useState(initialReason);
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const invalid = !trimmed;
  const submit = () => {
    setTouched(true);
    if (!invalid && !saving) onConfirm(trimmed);
  };
  useCtrlEnter(open && !saving, submit);
  const shop = product.shop?.name ?? '—';

  return (
    <Dialog
      open={open}
      title={t('moderation.rejectTitle')}
      description={t('moderation.dialogSubtitle', { name: product.name, shop })}
      icon={<XCircle />}
      tone="danger"
      width={480}
      locked={saving}
      onClose={onClose}
      testId="reject-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('moderation.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={saving} savingLabel={t('moderation.saving')} shortcut={false} danger disabled={touched && invalid}>
            {t('moderation.reject')}
          </DialogPrimary>
        </>
      )}
    >
      {unchecked.length ? (
        <div>
          <p className={styles.dialogLabel}>{t('moderation.unchecked')}</p>
          <ul className={styles.unchecked}>
            {unchecked.map((rule) => <li key={rule.key}><CircleX aria-hidden />{t(rule.title)}</li>)}
          </ul>
        </div>
      ) : null}
      <div>
        <div className={styles.reasonHead}>
          <label htmlFor={reasonId}>
            {t('moderation.reason')} <span className={styles.required}>{t('moderation.reasonMandatory')}</span>
          </label>
        </div>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={REJECT_REASON_MAX}
          autoFocus
          aria-invalid={(touched && invalid) || undefined}
          placeholder={t('moderation.reasonPlaceholder')}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className={styles.reasonHint}>{t('moderation.rejectVisible', { shop })}</p>
      </div>
    </Dialog>
  );
}
