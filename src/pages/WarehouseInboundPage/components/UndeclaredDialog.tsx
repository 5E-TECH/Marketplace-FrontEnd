import { App } from 'antd';
import { FilePlus, Info } from 'lucide-react';
import { useId, useState } from 'react';
import { useDeclareShipmentsMutation } from '../../../features/inbound/api/inboundQueries';
import type { InboundShipment, InboundWholesaler } from '../../../features/inbound/model/inboundTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { createIdempotencyKey } from '../../../shared/api/requestOptions';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import styles from './UndeclaredDialog.module.css';

export interface UndeclaredPreset {
  wholesalerId?: string;
  variantId?: string;
}

interface UndeclaredDialogProps {
  preset: UndeclaredPreset | null;
  wholesalers: readonly InboundWholesaler[];
  awaiting: readonly InboundShipment[];
  onClose: () => void;
  /** Mahsulot kutilayotgan postavkada bor — ariza o'rniga shu postavkaning qabuli. */
  onStartExpected: (shipment: InboundShipment) => void;
  onDeclared: (shipment: InboundShipment) => void;
}

/**
 * «Arizasiz postavka» (ombor-qabul 5): arizasi yo'q yuk keldi. Karta bo'yicha (FE-16, BE-17: «DECLARED ni
 * WAREHOUSE yoki ADMIN roli optovik nomidan ochadi») omborchi arizani o'zi ochadi — dizayndagi «Adminga
 * yuborish» o'rniga; saqlangach postavka «Kutilayotganlar»ga tushadi.
 */
export function UndeclaredDialog({ preset, wholesalers, awaiting, onClose, onStartExpected, onDeclared }: UndeclaredDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const declare = useDeclareShipmentsMutation();
  const id = useId();
  const usable = wholesalers.filter((item) => item.contractSigned && item.status === 'ACTIVE');
  const [wholesalerId, setWholesalerId] = useState<string | null>(preset?.wholesalerId ?? usable[0]?.id ?? null);
  const [variantId, setVariantId] = useState<string | null>(preset?.variantId ?? null);
  const [quantity, setQuantity] = useState('');
  const [waybill, setWaybill] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [idempotencyKey] = useState(createIdempotencyKey);
  const wholesaler = usable.find((item) => item.id === wholesalerId) ?? null;
  const products = (wholesaler?.products ?? []).filter((item) => item.status === 'ACTIVE');
  const product = products.find((item) => item.variantId === variantId) ?? null;
  const expected = product ? awaiting.find((item) => item.sku.variantId === product.variantId) ?? null : null;
  const amount = Number(quantity);
  const quantityInvalid = !quantity || !Number.isInteger(amount) || amount < 1 || amount > 100_000;

  const submit = () => {
    setTouched(true);
    if (!wholesaler || !product || quantityInvalid || declare.isPending) return;
    declare.mutate(
      {
        wholesalerId: wholesaler.id,
        expectedAt: tashkentDate(),
        note: note.trim() || undefined,
        waybillNumber: waybill.trim() || undefined,
        items: [{ variantId: product.variantId, quantity: amount }],
        idempotencyKey,
      },
      {
        onSuccess: ([created]) => {
          if (!created) return;
          notification.success({
            title: t('inb.undeclared.done', { number: created.number }),
            description: t('inb.undeclared.doneText', { product: created.sku.name, count: created.declared, time: tashkentClock() }),
            placement: phone ? 'top' : 'bottomRight',
            duration: 6,
          });
          onDeclared(created);
        },
        onError: (error) => notification.error({ title: t('inb.form.saveError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
      },
    );
  };

  return (
    <Dialog
      open={preset !== null}
      title={t('inb.undeclared.title')}
      description={t('inb.undeclared.sub')}
      icon={<FilePlus size={20} />}
      width={480}
      locked={declare.isPending}
      onClose={onClose}
      testId="undeclared-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={declare.isPending}>{t('inb.undeclared.cancel')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={declare.isPending} onClick={submit}>{t('inb.undeclared.submit')}</DialogPrimary>
        </>
      )}
    >
      <p className={styles.intro}>{t('inb.undeclared.intro')}</p>
      <div className={styles.grid}>
        <div>
          <label className={styles.label} htmlFor={`${id}-w`}>{t('inb.form.wholesaler')} <span className={styles.required}>*</span></label>
          <SearchSelect id={`${id}-w`} label={t('inb.form.wholesaler')} value={wholesalerId} placeholder={t('inb.form.wholesalerPlaceholder')} searchable={false}
            options={usable.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => { setWholesalerId(value); setVariantId(null); }} />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${id}-p`}>{t('inb.form.product')} <span className={styles.required}>*</span></label>
          <SearchSelect id={`${id}-p`} label={t('inb.form.product')} value={variantId} placeholder={t('inb.form.productPlaceholder')} searchable={false}
            invalid={touched && !product}
            options={products.map((item) => ({ value: item.variantId, label: item.name }))}
            onChange={setVariantId} />
        </div>
      </div>
      {expected ? (
        <div className={styles.expected} data-testid="undeclared-expected">
          <Info aria-hidden />
          <div>
            <strong>{t('inb.undeclared.expected', { number: expected.number, count: expected.declared, status: t(`status.shipment.${expected.status}`) })}</strong>
            <p>{t('inb.undeclared.expectedText')}</p>
            <button type="button" className={styles.secondary} onClick={() => onStartExpected(expected)}>{t('inb.undeclared.startExpected', { number: expected.number })}</button>
          </div>
        </div>
      ) : null}
      <div className={styles.grid}>
        <div>
          <label className={styles.label} htmlFor={`${id}-q`}>{t('inb.undeclared.quantity')} <span className={styles.required}>*</span></label>
          <div className={styles.qty} aria-invalid={(touched && quantityInvalid) || undefined}>
            <input id={`${id}-q`} inputMode="numeric" autoComplete="off" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            <span>{t('inb.unit')}</span>
          </div>
        </div>
        <div>
          <label className={styles.label} htmlFor={`${id}-b`}>{t('inb.undeclared.waybill')}</label>
          <input id={`${id}-b`} className={styles.input} maxLength={60} placeholder={t('inb.form.optional')} value={waybill} onChange={(event) => setWaybill(event.target.value)} />
        </div>
      </div>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`${id}-n`}>{t('inb.undeclared.note')}</label>
          <span>{t('inb.form.optional')}</span>
        </div>
        <textarea id={`${id}-n`} className={styles.textarea} maxLength={500} placeholder={t('inb.undeclared.notePlaceholder')} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
    </Dialog>
  );
}
