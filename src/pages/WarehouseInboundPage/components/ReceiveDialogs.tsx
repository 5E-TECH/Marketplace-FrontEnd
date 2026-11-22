import { CircleCheck, FileCheck, RotateCcw, Search, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { shipmentTally } from '../../../features/inbound/lib/scanRules';
import type { InboundProductOption, InboundShipment, ScanMode, ShipmentScan } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import type { Counts } from './ReceivingPanel';
import styles from './ReceiveDialogs.module.css';

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

interface UndoProps {
  shipment: InboundShipment;
  scan: ShipmentScan | null;
  counts: Counts;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** «Oxirgi skanni bekor qilasizmi?» (ombor-qabul holatlar 5): faqat oxirgi hisoblangan skan; xavfli tugma o'ngda. */
export function UndoScanDialog({ shipment, scan, counts, saving, onClose, onConfirm }: UndoProps) {
  const { t } = useTranslation();
  const accepted = scan?.result === 'ACCEPTED';
  const counted = counts.accepted + counts.defect;
  return (
    <Dialog
      open={scan !== null}
      title={t('inb.undo.title')}
      description={t('inb.undo.sub', { number: shipment.number, product: shipment.sku.name })}
      icon={<RotateCcw size={20} />}
      tone="warning"
      width={440}
      locked={saving}
      onClose={onClose}
      testId="undo-scan"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('inb.undo.back')}</DialogCancel>
          <DialogPrimary danger shortcut={false} saving={saving} onClick={onConfirm}>{t('inb.undo.submit')}</DialogPrimary>
        </>
      )}
    >
      {scan ? (
        <>
          <dl className={styles.facts}>
            <div><dt>{t('inb.undo.scan')}</dt><dd>{tashkentClock(Date.parse(scan.at))} · {scan.barcode}</dd></div>
            <div><dt>{t('inb.undo.written')}</dt><dd>{t(accepted ? 'inb.recv.accept' : 'inb.recv.defect')}</dd></div>
            <div>
              <dt>{t(accepted ? 'inb.recv.accepted' : 'inb.recv.defect')}</dt>
              <dd>{accepted ? `${counts.accepted} → ${counts.accepted - 1}` : `${counts.defect} → ${counts.defect - 1}`}</dd>
            </div>
            <div><dt>{t('inb.undo.counted')}</dt><dd>{counted} / {counts.declared} → {counted - 1} / {counts.declared}</dd></div>
          </dl>
          <p className={styles.rule}>{t('inb.undo.rule')}</p>
        </>
      ) : null}
    </Dialog>
  );
}

interface FinishProps {
  open: boolean;
  shipment: InboundShipment;
  counts: Counts;
  /** SKU ning hozirgi «mavjud» soni — «120 → 218 dona». */
  available: number | null;
  /** Shu qabulda sotuvga yaroqli (60 kundan ko'p muddatli) qabul qilingan son. */
  sellable: number;
  note: string;
  onNoteChange: (note: string) => void;
  saving: boolean;
  onClose: () => void;
  onConfirm: (confirmShortage: boolean) => void;
}

/** «Qabulni yakunlash» (ombor-qabul holatlar 4): farq bilan, kam bilan (avval «Qayta sanash»), farqsiz. */
export function FinishDialog({ open, shipment, counts, available, sellable, note, onNoteChange, saving, onClose, onConfirm }: FinishProps) {
  const { t } = useTranslation();
  const id = useId();
  const tally = shipmentTally(counts);
  const short = tally.shortage > 0;
  const exact = !short && tally.diff === 0 && counts.defect === 0 && tally.surplus === 0;
  const status = exact ? 'RECEIVED' : 'DISCREPANCY';
  const cell = shipment.sku.cell ?? '—';
  const stats: [string, string, string | undefined][] = [
    [t('inb.recv.col.declared'), String(counts.declared), undefined],
    [t('inb.recv.col.accepted'), String(counts.accepted), undefined],
    [t('inb.recv.col.defect'), String(counts.defect), counts.defect ? 'danger' : undefined],
    short ? [t('inb.recv.shortage'), String(tally.shortage), 'warning'] : [t('inb.recv.col.diff'), signed(tally.diff), tally.diff < 0 ? 'danger' : undefined],
  ];

  return (
    <Dialog
      open={open}
      title={t('inb.recv.finish')}
      description={t('inb.finish.sub', { number: shipment.number, product: shipment.sku.name, wholesaler: shipment.wholesaler.name })}
      icon={exact ? <CircleCheck size={20} /> : short ? <TriangleAlert size={20} /> : <FileCheck size={20} />}
      tone={exact ? 'success' : short ? 'warning' : 'action'}
      width={480}
      locked={saving}
      onClose={onClose}
      testId="finish-dialog"
      footer={short ? (
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('inb.finish.recount')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={saving} onClick={() => onConfirm(true)}>{t('inb.finish.submitShort')}</DialogPrimary>
        </>
      ) : (
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('inb.undo.back')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={saving} onClick={() => onConfirm(false)}>{t(exact ? 'inb.finish.submit' : 'inb.finish.submitDiff')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stats}>
        {stats.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong data-tone={tone}>{value}</strong></div>)}
      </div>
      {short ? (
        <div className={styles.notice} data-tone="warning">
          <TriangleAlert aria-hidden />
          <p><strong>{t('inb.finish.shortTitle', { count: tally.shortage, counted: tally.counted, declared: counts.declared })}</strong>{t('inb.finish.shortText', { count: tally.shortage, diff: signed(tally.diff) })}</p>
        </div>
      ) : exact ? (
        <div className={styles.notice} data-tone="success">
          <CircleCheck aria-hidden />
          <p><strong>{t('inb.finish.exactTitle')}</strong>{t('inb.finish.exactText')}</p>
        </div>
      ) : null}
      <dl className={styles.list}>
        <div><dt>{t('inb.finish.toStock')}</dt><dd>{t('inb.finish.toStockValue', { count: counts.accepted, cell })}</dd></div>
        {!exact && available !== null ? <div><dt>{t('inb.finish.available')}</dt><dd>{t('inb.finish.availableValue', { from: available, to: available + sellable })}</dd></div> : null}
        {counts.defect ? <div><dt>{t('inb.recv.defect')}</dt><dd>{t('inb.finish.defectValue', { count: counts.defect })}</dd></div> : null}
        <div><dt>{t('inb.finish.status')}</dt><dd><StatusBadge family="shipment" code={status} /></dd></div>
        {exact ? null : <div><dt>{t('inb.recv.actTitle')}</dt><dd>{t('inb.finish.actValue')}</dd></div>}
      </dl>
      {exact ? null : (
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={`${id}-note`}>{t('inb.recv.note')}</label>
            <span>{t('inb.recv.optional')}</span>
          </div>
          <textarea
            id={`${id}-note`}
            className={styles.textarea}
            maxLength={500}
            placeholder={t(short ? 'inb.recv.notePlaceholderShort' : 'inb.recv.notePlaceholder')}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
      )}
    </Dialog>
  );
}

interface FindProps {
  open: boolean;
  shipment: InboundShipment;
  catalog: readonly InboundProductOption[];
  mode: ScanMode;
  onClose: () => void;
  onCount: () => void;
}

/** «Nom bo'yicha topish» (ombor-qabul holatlar 2): kod noma'lum — tovar nomidan topiladi; shu postavkaniki bo'lsa, bitta dona. */
export function FindByNameDialog({ open, shipment, catalog, mode, onClose, onCount }: FindProps) {
  const { t } = useTranslation();
  const id = useId();
  const [variantId, setVariantId] = useState<string | null>(null);
  const chosen = catalog.find((item) => item.variantId === variantId) ?? null;
  const other = chosen && chosen.variantId !== shipment.sku.variantId ? chosen : null;
  const close = () => {
    setVariantId(null);
    onClose();
  };
  return (
    <Dialog
      open={open}
      title={t('inb.find.title')}
      description={t('inb.find.sub')}
      icon={<Search size={20} />}
      width={440}
      onClose={close}
      testId="find-by-name"
      footer={(
        <>
          <DialogCancel onClick={close}>{t('inb.find.cancel')}</DialogCancel>
          <DialogPrimary shortcut={false} disabled={!chosen || Boolean(other)} onClick={() => { setVariantId(null); onCount(); }}>{t('inb.find.submit')}</DialogPrimary>
        </>
      )}
    >
      <div>
        <label className={styles.findLabel} htmlFor={`${id}-p`}>{t('inb.find.product')}</label>
        <SearchSelect
          id={`${id}-p`}
          label={t('inb.find.product')}
          value={variantId}
          placeholder={t('inb.find.placeholder')}
          searchable
          options={catalog.map((item) => ({ value: item.variantId, label: item.name, description: item.barcode ?? undefined }))}
          onChange={setVariantId}
        />
      </div>
      {other
        ? <p className={styles.findOther} role="alert">{t('inb.find.other', { product: other.name })}</p>
        : <p className={styles.rule}>{t('inb.find.hint', { mode: t(mode === 'ACCEPT' ? 'inb.recv.accept' : 'inb.recv.defect') })}</p>}
    </Dialog>
  );
}
