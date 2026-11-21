import { App, Button } from 'antd';
import { ChevronRight, CircleX, Clock, FileText, MapPin, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeclareShipmentsMutation } from '../../../features/inbound/api/inboundQueries';
import type { InboundProductOption, InboundShipment, InboundWholesaler } from '../../../features/inbound/model/inboundTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { createIdempotencyKey } from '../../../shared/api/requestOptions';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import { DateInput } from '../../../shared/ui/DateInput/DateInput';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import styles from '../AdminWholesalersPage.module.css';

interface Row {
  key: number;
  variantId: string;
  quantity: string;
}

interface DeclareFormProps {
  wholesalers: readonly InboundWholesaler[];
  wholesaler: InboundWholesaler | null;
  onWholesalerChange: (id: string) => void;
  /** Saqlandi: ro'yxatda belgilash va «Arizani ochish». */
  onDeclared: (shipments: InboundShipment[]) => void;
}

const MAX_QUANTITY = 100_000;
let rowKey = 0;
const emptyRow = (): Row => ({ key: (rowKey += 1), variantId: '', quantity: '' });

/** «Yangi postavka arizasi · optovik nomidan» (admin-postavka; OMB-1, BE-17): har qator — alohida postavka. */
export function DeclareForm({ wholesalers, wholesaler, onWholesalerChange, onDeclared }: DeclareFormProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const declare = useDeclareShipmentsMutation();
  const id = useId();
  const today = tashkentDate();
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [expectedAt, setExpectedAt] = useState<string | null>(today);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  // Bitta arizaga bitta kalit: tarmoq uzilib qayta bosilsa, server ikkinchi postavka ochmaydi.
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);

  const locked = !wholesaler?.contractSigned;
  const products = wholesaler?.products ?? [];
  const approved = products.filter((item) => item.status === 'ACTIVE');
  const productOf = (variantId: string) => products.find((item) => item.variantId === variantId);

  const productError = (row: Row, index: number) => {
    if (!row.variantId) return 'product';
    return rows.findIndex((other) => other.variantId === row.variantId) !== index ? 'duplicate' : null;
  };
  const quantityInvalid = (row: Row) => {
    const quantity = Number(row.quantity);
    return !row.quantity || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY;
  };
  const dateInvalid = !expectedAt || expectedAt < today;
  const invalid = !wholesaler || locked || dateInvalid || rows.some((row, index) => productError(row, index) || quantityInvalid(row));

  const option = (product: InboundProductOption) => {
    const ok = product.status === 'ACTIVE';
    const description = ok
      ? t('inb.form.productOption', { barcode: product.barcode ?? '—', count: product.available })
      : product.status === 'PENDING_REVIEW' && product.reviewSince
        ? t('inb.form.inReview', { date: isoToDots(product.reviewSince) })
        : t('inb.form.notApproved');
    return { value: product.variantId, label: product.name, description, disabled: !ok };
  };

  const productHint = (product: InboundProductOption) => t('inb.form.productHint', {
    barcode: product.barcode ?? '—',
    onHand: product.onHand,
    available: product.available,
    expiry: t(product.expiryTracked ? 'inb.form.expiryTracked' : 'inb.form.expiryNotTracked'),
  });

  const wholesalerHint = (item: InboundWholesaler) => [
    phone && item.tin ? t('inb.form.tin', { tin: item.tin }) : null,
    t('inb.form.contractSigned'),
    t('inb.form.approvedCount', { count: item.products.filter((product) => product.status === 'ACTIVE').length }),
    t(item.cabinet ? 'inb.form.cabinetActive' : 'inb.form.noCabinet'),
  ].filter(Boolean).join(' · ');

  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: number) => setRows((list) => (list.length > 1 ? list.filter((row) => row.key !== key) : [emptyRow()]));

  const submit = () => {
    setTouched(true);
    if (invalid || !wholesaler || !expectedAt || declare.isPending) return;
    declare.mutate(
      {
        wholesalerId: wholesaler.id,
        expectedAt,
        note: note.trim() || undefined,
        items: rows.map((row) => ({ variantId: row.variantId, quantity: Number(row.quantity) })),
        idempotencyKey,
      },
      {
        onSuccess: (created) => {
          const first = created[0];
          const key = `declared-${first?.id ?? ''}`;
          notification.success({
            key,
            title: created.length > 1 ? t('inb.form.savedMany', { numbers: created.map((item) => item.number).join(', ') }) : t('inb.form.saved', { number: first?.number ?? '' }),
            description: created.length > 1
              ? t('inb.form.savedManyText', { count: created.length, date: isoToDots(expectedAt) })
              : t('inb.form.savedText', { product: first?.sku.name ?? '', count: first?.declared ?? 0, date: isoToDots(expectedAt) }),
            placement: phone ? 'top' : 'bottomRight',
            duration: 6,
            actions: first ? (
              <Button size="small" onClick={() => { notification.destroy(key); void navigate(`/admin/wholesalers/shipments/${encodeURIComponent(first.id)}`); }}>
                {t('inb.form.openShipment')}
              </Button>
            ) : undefined,
          });
          setRows([emptyRow()]);
          setNote('');
          setTouched(false);
          setIdempotencyKey(createIdempotencyKey());
          onDeclared(created);
        },
        onError: (error) => notification.error({ title: t('inb.form.saveError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
      },
    );
  };

  return (
    <form className={styles.form} noValidate data-testid="declare-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className={styles.cardHead}>
        <h2>{t('inb.form.title')}</h2>
        <span className={styles.cardSub}>{t('inb.form.onBehalf')}</span>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`${id}-wholesaler`}>{t('inb.form.wholesaler')} <span className={styles.required}>*</span></label>
        </div>
        <SearchSelect
          id={`${id}-wholesaler`}
          label={t('inb.form.wholesaler')}
          value={wholesaler?.id ?? null}
          placeholder={t('inb.form.wholesalerPlaceholder')}
          searchable={false}
          invalid={Boolean(wholesaler && locked)}
          describedBy={`${id}-wholesaler-hint`}
          options={wholesalers.map((item) => ({ value: item.id, label: phone || !item.tin ? item.name : t('inb.form.wholesalerOption', { name: item.name, tin: item.tin }) }))}
          onChange={onWholesalerChange}
        />
        {wholesaler && locked ? (
          <>
            <p className={styles.error} id={`${id}-wholesaler-hint`}><CircleX aria-hidden />{t('inb.form.noContract')}</p>
            <Link className={styles.contractLink} to="/admin/wholesalers">{t('inb.form.contractLink')}<ChevronRight aria-hidden /></Link>
          </>
        ) : wholesaler ? <p className={styles.hint} id={`${id}-wholesaler-hint`}>{wholesalerHint(wholesaler)}</p> : null}
      </div>

      <div className={styles.rows} data-disabled={locked || undefined}>
        {rows.map((row, index) => {
          const product = productOf(row.variantId);
          const error = touched ? productError(row, index) : null;
          const quantityError = touched && quantityInvalid(row);
          return (
            <div key={row.key} className={styles.row} data-testid="declare-row">
              <div className={`${styles.field} ${styles.productField}`}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor={`${id}-product-${row.key}`}>{t('inb.form.product')} <span className={styles.required}>*</span></label>
                </div>
                <SearchSelect
                  id={`${id}-product-${row.key}`}
                  label={t('inb.form.product')}
                  sheetHint={wholesaler ? t('inb.form.productSheetHint', { name: wholesaler.name }) : undefined}
                  searchLabel={t('inb.form.productSearch')}
                  value={row.variantId || null}
                  placeholder={t(locked ? 'inb.form.pickWholesalerFirst' : 'inb.form.productPlaceholder')}
                  searchable
                  disabled={locked}
                  invalid={error === 'product' || error === 'duplicate'}
                  options={products.map(option)}
                  onChange={(variantId) => update(row.key, { variantId })}
                />
                {error === 'product' ? <p className={styles.error}><CircleX aria-hidden />{t('inb.form.errProduct')}</p> : null}
                {error === 'duplicate' ? <p className={styles.error}><CircleX aria-hidden />{t('inb.form.errDuplicate')}</p> : null}
                {product && !error ? <p className={styles.hint}>{productHint(product)}</p> : null}
              </div>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor={`${id}-qty-${row.key}`}>{t('inb.form.quantity')} <span className={styles.required}>*</span></label>
                </div>
                <div className={styles.qty} aria-invalid={quantityError || undefined}>
                  <input
                    id={`${id}-qty-${row.key}`}
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={locked}
                    value={row.quantity}
                    onChange={(event) => update(row.key, { quantity: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                  />
                  <span>{t('inb.unit')}</span>
                </div>
                {quantityError ? <p className={styles.error}><CircleX aria-hidden />{t('inb.form.errQuantity')}</p> : null}
              </div>
              <div className={styles.removeCell}>
                <button type="button" className={styles.iconButton} aria-label={t('inb.form.removeRow')} title={t('inb.form.removeRow')} disabled={locked} onClick={() => remove(row.key)}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
        <div>
          <button type="button" className={styles.link} disabled={locked || rows.length >= approved.length} onClick={() => setRows((list) => [...list, emptyRow()])}>
            <Plus aria-hidden />{t('inb.form.addRow')}
          </button>
        </div>
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <div className={styles.labelRow}><label className={styles.label} htmlFor={`${id}-date`}>{t('inb.form.expectedAt')}</label></div>
          <DateInput id={`${id}-date`} className={styles.dateInput} value={expectedAt} min={today} onChange={setExpectedAt} status={touched && dateInvalid ? 'error' : undefined} />
          {touched && dateInvalid ? <p className={styles.error}><CircleX aria-hidden />{t('inb.form.errDate')}</p> : null}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor={`${id}-note`}>{t('inb.form.note')}</label>
            <span className={styles.optional}>{t('inb.form.optional')}</span>
          </div>
          <div className={styles.textInput}>
            <input id={`${id}-note`} maxLength={500} placeholder={t('inb.form.notePlaceholder')} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
      </div>

      <div className={styles.rules}>
        <p><MapPin aria-hidden /><span><strong>{t('inb.form.where')}</strong> <span className={styles.muted}>{t('inb.form.whereValue')}</span></span></p>
        <p><FileText aria-hidden /><span>{t('inb.form.actRule')}</span></p>
        <p><Clock aria-hidden /><span>{t('inb.form.expiryRule')}</span></p>
      </div>

      <div className={styles.formFooter}>
        <button type="submit" className={styles.primary} disabled={declare.isPending || locked}>
          <PackagePlus aria-hidden />{t('inb.form.submit')}
        </button>
        <span>{t('inb.form.submitHint')}</span>
      </div>
    </form>
  );
}
