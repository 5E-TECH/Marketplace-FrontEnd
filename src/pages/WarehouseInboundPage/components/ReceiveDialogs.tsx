import { CircleCheck, FileCheck, RotateCcw, Search, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { isValidCell, shipmentTally } from '../../../features/inbound/lib/scanRules';
import { shipmentTitle, wholesalerLabel } from '../../../features/inbound/lib/shipmentLabels';
import type { InboundShipment, ScanMode } from '../../../features/inbound/model/inboundTypes';
import type { JournalEntry } from '../../../features/inbound/model/receivingDraft';
import type { ItemCounts } from '../../../features/inbound/model/useReceiving';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import type { ItemView } from './ReceivingPanel';
import styles from './ReceiveDialogs.module.css';

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

interface UndoProps {
  shipment: InboundShipment;
  scan: JournalEntry | null;
  /** Bekor qilinadigan skan qatorining sonlari. */
  counts: ItemCounts | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** «Oxirgi skanni bekor qilasizmi?» (ombor-qabul holatlar 5): faqat oxirgi hisoblangan skan; xavfli tugma o'ngda. */
export function UndoScanDialog({ shipment, scan, counts, onClose, onConfirm }: UndoProps) {
  const { t } = useTranslation();
  const accepted = scan?.kind === 'ACCEPTED';
  const counted = counts ? counts.accepted + counts.defect : 0;
  return (
    <Dialog
      open={scan !== null}
      title={t('inb.undo.title')}
      description={t('inb.undo.sub', { number: shipment.number, product: scan?.productName ?? shipmentTitle(t, shipment) })}
      icon={<RotateCcw size={20} />}
      tone="warning"
      width={440}
      onClose={onClose}
      testId="undo-scan"
      footer={(
        <>
          <DialogCancel onClick={onClose}>{t('inb.undo.back')}</DialogCancel>
          <DialogPrimary danger shortcut={false} onClick={onConfirm}>{t('inb.undo.submit')}</DialogPrimary>
        </>
      )}
    >
      {scan && counts ? (
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
  counts: ItemCounts;
  items: readonly ItemView[];
  /** SKU larning hozirgi «mavjud» soni — «120 → 218 dona». */
  available: number | null;
  /** Shu qabulda sotuvga yaroqli (60 kundan ko'p muddatli) qabul qilingan son. */
  sellable: number;
  note: string;
  onNoteChange: (note: string) => void;
  onCellChange: (itemId: string, cell: string) => void;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** «Qabulni yakunlash» (ombor-qabul holatlar 4): farq bilan, kam bilan (avval «Qayta sanash»), farqsiz. Yacheyka — majburiy. */
export function FinishDialog({ open, shipment, counts, items, available, sellable, note, onNoteChange, onCellChange, saving, onClose, onConfirm }: FinishProps) {
  const { t } = useTranslation();
  const id = useId();
  const [touched, setTouched] = useState(false);
  const tally = shipmentTally(counts);
  const short = tally.shortage > 0;
  const exact = !short && tally.diff === 0 && counts.defect === 0 && tally.surplus === 0;
  const status = exact ? 'RECEIVED' : 'DISCREPANCY';
  const cellsInvalid = items.some((view) => !isValidCell(view.cell));
  const stats: [string, string, string | undefined][] = [
    [t('inb.recv.col.declared'), String(counts.declared), undefined],
    [t('inb.recv.col.accepted'), String(counts.accepted), undefined],
    [t('inb.recv.col.defect'), String(counts.defect), counts.defect ? 'danger' : undefined],
    short ? [t('inb.recv.shortage'), String(tally.shortage), 'warning'] : [t('inb.recv.col.diff'), signed(tally.diff), tally.diff < 0 ? 'danger' : undefined],
  ];
  const confirm = () => {
    setTouched(true);
    if (!cellsInvalid) onConfirm();
  };
  const close = () => {
    setTouched(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      title={t('inb.recv.finish')}
      description={t('inb.finish.sub', { number: shipment.number, product: shipmentTitle(t, shipment), wholesaler: wholesalerLabel(t, shipment) })}
      icon={exact ? <CircleCheck size={20} /> : short ? <TriangleAlert size={20} /> : <FileCheck size={20} />}
      tone={exact ? 'success' : short ? 'warning' : 'action'}
      width={480}
      locked={saving}
      onClose={close}
      testId="finish-dialog"
      footer={short ? (
        <>
          <DialogCancel onClick={close} disabled={saving}>{t('inb.finish.recount')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={saving} onClick={confirm}>{t('inb.finish.submitShort')}</DialogPrimary>
        </>
      ) : (
        <>
          <DialogCancel onClick={close} disabled={saving}>{t('inb.undo.back')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={saving} onClick={confirm}>{t(exact ? 'inb.finish.submit' : 'inb.finish.submitDiff')}</DialogPrimary>
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
        {items.map((view) => {
          const invalid = !isValidCell(view.cell);
          const label = items.length === 1 ? t('inb.finish.toStock') : view.item.productName;
          return (
            <div key={view.item.id} data-item-id={view.item.id}>
              <dt><label htmlFor={`${id}-${view.item.id}`}>{label}</label></dt>
              <dd>
                {t('inb.finish.toStockCount', { count: view.counts.accepted })}{' → '}
                {view.cellKnown ? view.cell : (
                  <input
                    id={`${id}-${view.item.id}`}
                    className={styles.cellInput}
                    aria-label={t('inb.finish.cell', { product: view.item.productName })}
                    aria-invalid={(touched && invalid) || undefined}
                    placeholder={t('inb.finish.cellPlaceholder')}
                    maxLength={32}
                    value={view.cell}
                    onChange={(event) => onCellChange(view.item.id, event.target.value.toUpperCase())}
                  />
                )}
              </dd>
            </div>
          );
        })}
        {touched && cellsInvalid ? <p className={styles.findOther} role="alert">{t('inb.finish.cellRequired')}</p> : null}
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
            maxLength={1000}
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
  mode: ScanMode;
  onClose: () => void;
  onCount: (itemId: string) => void;
}

/** «Nom bo'yicha topish» (ombor-qabul holatlar 2): kod o'qilmadi — tovar shu postavka qatorlaridan tanlanadi, bitta dona. */
export function FindByNameDialog({ open, shipment, mode, onClose, onCount }: FindProps) {
  const { t } = useTranslation();
  const id = useId();
  const [itemId, setItemId] = useState<string | null>(shipment.items.length === 1 ? shipment.items[0].id : null);
  const close = () => {
    setItemId(shipment.items.length === 1 ? shipment.items[0].id : null);
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
          <DialogPrimary shortcut={false} disabled={!itemId} onClick={() => { if (itemId) onCount(itemId); }}>{t('inb.find.submit')}</DialogPrimary>
        </>
      )}
    >
      <div>
        <label className={styles.findLabel} htmlFor={`${id}-p`}>{t('inb.find.product')}</label>
        <SearchSelect
          id={`${id}-p`}
          label={t('inb.find.product')}
          value={itemId}
          placeholder={t('inb.find.placeholder')}
          searchable
          options={shipment.items.map((item) => ({ value: item.id, label: item.productName, description: item.barcode ?? undefined }))}
          onChange={setItemId}
        />
      </div>
      <p className={styles.rule}>{t('inb.find.hint', { mode: t(mode === 'ACCEPT' ? 'inb.recv.accept' : 'inb.recv.defect') })}</p>
    </Dialog>
  );
}
