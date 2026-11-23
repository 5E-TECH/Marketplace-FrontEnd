import { App } from 'antd';
import { FilePlus, Info } from 'lucide-react';
import { useId, useState } from 'react';
import { useDeclareShipmentMutation, useInboundWholesalersQuery, useWholesalerProductsQuery } from '../../../features/inbound/api/inboundQueries';
import { shipmentTitle } from '../../../features/inbound/lib/shipmentLabels';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import styles from './UndeclaredDialog.module.css';

export interface UndeclaredPreset {
  wholesalerId?: string;
  productId?: string;
}

interface UndeclaredDialogProps {
  preset: UndeclaredPreset | null;
  awaiting: readonly InboundShipment[];
  onClose: () => void;
  /** Mahsulot kutilayotgan postavkada bor — ariza o'rniga shu postavkaning qabuli. */
  onStartExpected: (shipment: InboundShipment) => void;
  onDeclared: (shipment: InboundShipment) => void;
}

/**
 * «Arizasiz postavka» (ombor-qabul 5): arizasi yo'q yuk keldi. Karta bo'yicha (FE-16, BE-17: «DECLARED ni
 * WAREHOUSE yoki ADMIN roli optovik nomidan ochadi») omborchi arizani o'zi ochadi — dizayndagi «Adminga
 * yuborish» o'rniga; saqlangach postavka «Kutilayotganlar»ga tushadi. Yuk xati raqami izohga yoziladi
 * (BE-17 da alohida maydon yo'q).
 */
export function UndeclaredDialog({ preset, awaiting, onClose, onStartExpected, onDeclared }: UndeclaredDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const declare = useDeclareShipmentMutation();
  const id = useId();
  const wholesalersQuery = useInboundWholesalersQuery(preset !== null);
  const usable = (wholesalersQuery.data ?? []).filter((item) => item.contractSigned && item.status === 'ACTIVE');
  const [picked, setPicked] = useState<string | null>(preset?.wholesalerId ?? null);
  const wholesalerId = picked ?? usable[0]?.id ?? null;
  const productsQuery = useWholesalerProductsQuery(preset !== null ? wholesalerId : null);
  const [productId, setProductId] = useState<string | null>(preset?.productId ?? null);
  const [quantity, setQuantity] = useState('');
  const [waybill, setWaybill] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const products = (productsQuery.data ?? []).filter((item) => item.status === 'ACTIVE' && item.cpaEnabled);
  const product = products.find((item) => item.productId === productId) ?? null;
  const expected = product ? awaiting.find((item) => item.items.some((line) => line.productId === product.productId)) ?? null : null;
  const amount = Number(quantity);
  const quantityInvalid = !quantity || !Number.isInteger(amount) || amount < 1 || amount > 100_000;

  const submit = () => {
    setTouched(true);
    if (!wholesalerId || !product || quantityInvalid || declare.isPending) return;
    const text = [waybill.trim() ? t('inb.undeclared.waybillNote', { number: waybill.trim() }) : null, note.trim() || null].filter(Boolean).join(' ');
    declare.mutate(
      { wholesalerId, expectedAt: tashkentDate(), note: text || undefined, items: [{ productId: product.productId, quantity: amount }] },
      {
        onSuccess: (created) => {
          notification.success({
            title: t('inb.undeclared.done', { number: created.number }),
            description: t('inb.undeclared.doneText', { product: shipmentTitle(t, created), count: created.declared, time: tashkentClock() }),
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
      {/* BE-17 da omborchiga optovik va mahsulot ro'yxati hali yopiq (taklif, fe-16 §4) — jim bo'sh qolmasin. */}
      {wholesalersQuery.error ?? productsQuery.error ? (
        <p className={styles.loadError} role="alert">{t('inb.undeclared.loadError', { reason: getApiErrorMessage(wholesalersQuery.error ?? productsQuery.error) })}</p>
      ) : null}
      <div className={styles.grid}>
        <div>
          <label className={styles.label} htmlFor={`${id}-w`}>{t('inb.form.wholesaler')} <span className={styles.required}>*</span></label>
          <SearchSelect id={`${id}-w`} label={t('inb.form.wholesaler')} value={wholesalerId} placeholder={t('inb.form.wholesalerPlaceholder')} searchable={false}
            options={usable.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => { setPicked(value); setProductId(null); }} />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${id}-p`}>{t('inb.form.product')} <span className={styles.required}>*</span></label>
          <SearchSelect id={`${id}-p`} label={t('inb.form.product')} value={productId} placeholder={t('inb.form.productPlaceholder')} searchable={false}
            invalid={touched && !product}
            options={products.map((item) => ({ value: item.productId, label: item.name }))}
            onChange={setProductId} />
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
