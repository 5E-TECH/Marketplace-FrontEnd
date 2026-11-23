import { App, QRCode } from 'antd';
import { ArrowRight, CircleAlert, CircleCheck, Lock, Package, PackageCheck, Printer, QrCode, Scale } from 'lucide-react';
import { useId, useState } from 'react';
import { fetchLabel } from '../../../features/fulfillment/api/fulfillmentApi';
import { usePackTaskMutation } from '../../../features/fulfillment/api/fulfillmentQueries';
import { byPackedDesc, goodsOf, isPicking, placeOf, productsOf, weightOf } from '../../../features/fulfillment/lib/pickRules';
import type { PickTask } from '../../../features/fulfillment/model/fulfillmentTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { formatMoneyNbsp } from '../../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { PrintDialog } from '../../../shared/ui/PrintDialog/PrintDialog';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { ParcelSteps } from './ParcelSteps';
import { parcelTitle, useParcelSubline } from './parcelText';
import styles from '../WarehousePickingPage.module.css';

interface PackTabProps {
  items: readonly PickTask[];
  /** Yig'ishdan «Qadoqqa o'tish» bilan kelgan posilka. */
  selectedId: string | null;
  phone: boolean;
  onToPick: () => void;
}

/** «Qadoq va yorliq» (ombor-qadoq): og'irlik, tarkib, yorliq (TC2) → «Qadoqlandi»; bugun qadoqlanganlar, qayta chop etish. */
export function PackTab({ items, selectedId, phone, onToPick }: PackTabProps) {
  const { t } = useTranslation();
  // Yorlig'i chop etilgan (yoki PDF yuklab olingan) posilkalar — «Qadoqlandi» shundan keyin ochiladi.
  const [printed, setPrinted] = useState<ReadonlySet<string>>(new Set());
  const [reprint, setReprint] = useState<PickTask | null>(null);
  const waiting = items.filter((task) => task.status === 'PICKED');
  const task = waiting.find((item) => item.taskId === selectedId) ?? waiting[0] ?? null;
  const packed = items.filter((item) => item.status === 'PACKED').sort(byPackedDesc);
  const picking = items.filter((item) => item.status === 'TO_PICK');
  const next = picking.find(isPicking) ?? picking[0] ?? null;
  const markPrinted = (id: string) => setPrinted((set) => new Set(set).add(id));
  return (
    <div className={styles.columns}>
      <div className={styles.main}>
        {task
          ? <PackParcel key={task.taskId} task={task} phone={phone} printed={printed.has(task.taskId)} onPrinted={() => markPrinted(task.taskId)} />
          : <NothingToPack picking={next} />}
      </div>
      <div className={styles.aside}>
        <PackDesk />
        <section className={styles.card} data-tight data-testid="picking-summary">
          <div className={styles.cardHead}><div className={styles.cardTitle}><h2>{t('ful.pack.pickingTitle')}</h2></div></div>
          <div className={styles.iconRow}>
            <span className={styles.iconCircle}><Package aria-hidden /></span>
            <span className={styles.stack}>
              <span>{t('ful.pack.pickingCount', { count: picking.length })}</span>
              <span>{next ? t('ful.pack.pickingNext', { parcel: parcelTitle(next), product: productsOf(next) }) : t('ful.pack.pickingNone')}</span>
            </span>
          </div>
          <div><button type="button" className={styles.linkButton} data-touch onClick={onToPick}>{t('ful.pack.toPick')}<ArrowRight aria-hidden /></button></div>
        </section>
        <PackedToday packed={packed} onReprint={setReprint} />
      </div>
      {reprint ? <LabelDialog task={reprint} reprint onClose={() => setReprint(null)} /> : null}
    </div>
  );
}

function NothingToPack({ picking }: { picking: PickTask | null }) {
  const { t } = useTranslation();
  return (
    <section className={styles.card} data-testid="pack-empty">
      <div className={styles.cardTitle}>
        <h2>{t('ful.pack.emptyTitle')}</h2>
        <span>{picking ? t('ful.pack.emptyPicking', { parcel: parcelTitle(picking) }) : t('ful.pack.emptyText')}</span>
      </div>
    </section>
  );
}

interface PackParcelProps {
  task: PickTask;
  phone: boolean;
  printed: boolean;
  onPrinted: () => void;
}

function PackParcel({ task, phone, printed, onPrinted }: PackParcelProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const subline = useParcelSubline();
  const pack = usePackTaskMutation();
  const lockId = useId();
  const [printOpen, setPrintOpen] = useState(false);
  const weight = weightOf(task);
  const cod = task.codAmount === null ? null : t('ful.pack.cod', { amount: formatMoneyNbsp(task.codAmount) });
  const ready = task.parcel.labelReady;

  // `mutateAsync`: qadoqlangan posilka ro'yxatdan chiqadi va karta yopiladi — xabar baribir chiqishi kerak.
  const confirm = () => {
    pack.mutateAsync(task.taskId)
      .then(() => notification.success({ title: t('ful.pack.done', { number: task.orderNumber }), description: t('ful.pack.doneText'), placement: phone ? 'top' : 'bottomRight', duration: 4 }))
      .catch((error: unknown) => notification.error({ title: t('ful.pack.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }));
  };

  const printButton = (
    <button type="button" className={`${styles.primary} ${phone ? styles.barPrimary : ''}`} data-size="large" disabled={!ready} onClick={() => setPrintOpen(true)}>
      <Printer aria-hidden />{t('ful.pack.print')}
    </button>
  );
  const packButton = (
    <button type="button" className={styles.secondary} data-size="large" disabled={!printed || pack.isPending} aria-describedby={printed ? undefined : lockId} onClick={confirm}>
      <PackageCheck aria-hidden />{t('ful.pack.packed')}
    </button>
  );

  return (
    <>
      <section className={styles.card} data-testid="pack-parcel" data-task-id={task.taskId}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <h2>{parcelTitle(task)}</h2>
            <span>{subline(task, [cod]) || goodsOf(task)}</span>
          </div>
          <div className={styles.chips}><StatusBadge family="task" code="PICKED" /></div>
        </div>
        <ParcelSteps step={2} />

        <p className={styles.blockTitle}>{t('ful.pack.weighTitle')}<span>{t('ful.pack.scaleTbd')}</span></p>
        {/* Tarozi ulanmagan (EQ-07): kartadagi og'irlik ko'rsatiladi, tarozi ko'rsatkichi va «Mos» — ulangach. */}
        <div className={styles.weigh} role="group" aria-label={t('ful.pack.weighTitle')}>
          <span className={styles.weighLabel}>{t('ful.pack.weighLabel')}</span>
          <span className={styles.weighValue}>{weight ?? '—'}<span> kg</span></span>
          <span className={styles.weighGoods}>{goodsOf(task)}</span>
        </div>
        <p className={styles.note}>{t('ful.pack.tolerance')} <span className={styles.muted}>{t('ful.pack.toleranceTbd')}</span>{t('ful.pack.toleranceTail')}</p>
        {phone ? (
          <ul className={styles.lineCards} aria-label={t('ful.pack.contentsAria', { number: task.orderNumber })} data-testid="pack-lines">
            {task.lines.map((line, index) => (
              <li key={index}>
                <span className={styles.lineName}>{line.productName}<span> × {line.quantity}</span></span>
                <span className={styles.lineMeta}>{[line.barcode ?? line.sku, line.weightKg === null ? null : t('ful.pack.lineWeight', { weight: `${line.weightKg} kg` })].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table} data-testid="pack-lines">
              <caption className={styles.visuallyHidden}>{t('ful.pack.contentsAria', { number: task.orderNumber })}</caption>
              <thead>
                <tr>
                  <th>{t('ful.pick.col.product')}</th>
                  <th>{t('ful.pack.col.barcode')}</th>
                  <th className={styles.num}>{t('ful.pack.col.qty')}</th>
                  <th className={styles.num}>{t('ful.pack.col.weight')}</th>
                </tr>
              </thead>
              <tbody>
                {task.lines.map((line, index) => (
                  <tr key={index}>
                    <td><strong>{line.productName}</strong></td>
                    <td>{line.barcode ?? line.sku ?? '—'}</td>
                    <td className={styles.num}>{line.quantity}</td>
                    <td className={styles.num}>{line.weightKg === null ? '—' : `${line.weightKg} kg`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.blockTitle}>{t('ful.pack.labelTitle')}<span>{t(ready ? 'ful.pack.preview' : 'ful.pack.labelFormat')}</span></p>
        {ready ? (
          <>
            <LabelPreview task={task} />
            <p className={styles.note}>{t('ful.pack.printerNote')} <span className={styles.muted}>{t('ful.desk.tbd')}</span>.</p>
          </>
        ) : (
          <div className={styles.warn} role="alert" data-testid="label-missing">
            <CircleAlert aria-hidden />
            <p><strong>{t('ful.pack.noLabelTitle')}</strong>{task.parcel.error ? `${task.parcel.error}. ` : ''}{t('ful.pack.noLabelText')}</p>
          </div>
        )}

        <div className={styles.cardFoot}>
          <p className={styles.lockHint} id={lockId} data-state={printed ? 'ok' : undefined}>
            {printed ? <CircleCheck aria-hidden /> : <Lock aria-hidden />}<span>{t(printed ? 'ful.pack.printedHint' : 'ful.pack.lockHint')}</span>
          </p>
          <div className={styles.footActions}>{packButton}{printButton}</div>
        </div>
      </section>
      {phone ? <PageActionBar>{packButton}{printButton}</PageActionBar> : null}
      {printOpen ? <LabelDialog task={task} onClose={() => setPrintOpen(false)} onDone={onPrinted} /> : null}
    </>
  );
}

/**
 * Yorliqning oldindan ko'rinishi (ombor-qadoq «2. Yorliq»): ma'lumot — ro'yxatdagi posilkadan; chop etiladigani — server
 * PDF (BE-19), u ham shu ma'lumotdan tuziladi. QR — posilka tokeni (taklif maydoni) kelsa haqiqiy, aks holda belgi.
 */
function LabelPreview({ task }: { task: PickTask }) {
  const { t } = useTranslation();
  const weight = weightOf(task);
  const place = placeOf(task);
  const token = task.parcel.qrCodeToken;
  return (
    <figure className={styles.label} aria-label={t('ful.label.previewAria', { number: task.orderNumber })} data-testid="label-preview">
      <div className={styles.labelHead}>
        <span>{t('ful.label.brand')}</span>
        {task.deliveryMode ? <span className={styles.labelMode}>{t(task.deliveryMode === 'DOOR' ? 'ful.parcels.door' : 'ful.parcels.center')}</span> : null}
      </div>
      <div className={styles.labelTrack}>
        {token
          ? <QRCode value={token} size={84} type="svg" bordered={false} bgColor="#ffffff" color="#101733" className={styles.labelQr} />
          : <QrCode className={styles.labelQrIcon} aria-hidden />}
        <div>
          <span>{t('ful.label.track')}</span>
          <span>{task.parcel.shipmentId ?? <span className={styles.muted}>{t('ful.label.trackTbd')}</span>}</span>
          <span>{t('ful.label.order')} <strong>{task.orderNumber}</strong> · {isoToDots(task.pickDate)}</span>
        </div>
      </div>
      <div className={styles.labelTo}>
        <span>{t('ful.label.recipient')}</span>
        <span>{task.customerName ?? '—'}</span>
        <span>{[place, task.deliveryMode ? t(task.deliveryMode === 'DOOR' ? 'ful.label.doorNote' : 'ful.label.centerNote') : null].filter(Boolean).join(' — ') || '—'}</span>
      </div>
      <div className={styles.labelFacts}>
        <div><span>{t('ful.label.goods')}</span><span>{goodsOf(task)}</span></div>
        {weight === null ? null : <div><span>{t('ful.label.weight')}</span><span>{weight} kg</span></div>}
        {task.codAmount === null ? null : <div><span>{t('ful.label.cod')}</span><span data-size="large">{t('ful.sum', { amount: formatMoneyNbsp(task.codAmount) })}</span></div>}
      </div>
      <span className={styles.labelFrom}>
        {t('ful.label.sender')} <span className={styles.muted}>{t('ful.label.senderTbd')}</span> · {t('ful.label.warehouse')} <span className={styles.muted}>{t('ful.label.warehouseTbd')}</span>
      </span>
    </figure>
  );
}

/** Yorliq (hujjat-posilka-yorligi): server PDF — Elchi trek, QR, tasdiqlangan manzil; umumiy chop etish oynasida. */
function LabelDialog({ task, reprint = false, onClose, onDone }: { task: PickTask; reprint?: boolean; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const description = [goodsOf(task), task.deliveryMode ? t(task.deliveryMode === 'DOOR' ? 'ful.mode.door' : 'ful.mode.center') : null, task.codAmount === null ? null : t('ful.sum', { amount: formatMoneyNbsp(task.codAmount) })].filter(Boolean).join(' · ');
  return (
    <PrintDialog
      open
      title={t(reprint ? 'ful.label.reprintTitle' : 'ful.label.title', { number: task.orderNumber })}
      description={description}
      load={() => fetchLabel(task.orderId, `yorliq-${task.orderNumber}.pdf`)}
      facts={[
        [t('ful.label.order'), parcelTitle(task)],
        ...(task.packedAt ? [[t('ful.label.packedAt'), tashkentDateTime(task.packedAt)] as const] : []),
      ]}
      note={reprint ? { title: t('ful.label.reprintNote'), text: t('ful.label.reprintText') } : null}
      reprint={reprint}
      previewCaption={t('ful.label.caption')}
      onClose={onClose}
      onDone={onDone}
      testId="label-dialog"
    />
  );
}

/** «Qadoq stoli · qurilmalar holati»: tarozi va printer — EQ-07 (model hali tanlanmagan). */
function PackDesk() {
  const { t } = useTranslation();
  return (
    <section className={styles.card} data-tight>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}><h2>{t('ful.desk.title')}</h2><span>{t('ful.desk.sub')}</span></div>
      </div>
      <ul className={styles.devices} aria-label={t('ful.desk.sub')}>
        <li>
          <span className={styles.iconCircle}><Scale aria-hidden /></span>
          <span className={styles.stack}><span>{t('ful.desk.scale')}</span><span>{t('ful.desk.modelTbd')}</span></span>
          <span className={styles.muted}>{t('ful.desk.tbd')}</span>
        </li>
        <li>
          <span className={styles.iconCircle}><Printer aria-hidden /></span>
          <span className={styles.stack}><span>{t('ful.desk.printer')}</span><span>{t('ful.desk.printerModel')}</span></span>
          <span className={styles.muted}>{t('ful.desk.system')}</span>
        </li>
      </ul>
    </section>
  );
}

/** «Bugun qadoqlangan» — har qatorda yorliqni qayta chop etish. */
function PackedToday({ packed, onReprint }: { packed: readonly PickTask[]; onReprint: (task: PickTask) => void }) {
  const { t } = useTranslation();
  return (
    <section className={styles.card} data-tight data-testid="packed-today">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}><h2>{t('ful.pack.packedTitle', { count: packed.length })}</h2><span>{t('ful.pack.packedSub')}</span></div>
      </div>
      {packed.length ? (
        <ul className={styles.parcels}>
          {packed.map((task) => (
            <li key={task.taskId} data-task-id={task.taskId}>
              <span className={styles.stack}><span>{parcelTitle(task)}</span><span>{productsOf(task)}</span></span>
              <span className={styles.parcelEnd}>
                {task.packedAt ? tashkentClock(Date.parse(task.packedAt)) : null}
                <button type="button" className={styles.iconButton} aria-label={t('ful.pack.reprintAria', { number: task.orderNumber })} title={t('ful.pack.reprintAria', { number: task.orderNumber })} disabled={!task.parcel.labelReady} onClick={() => onReprint(task)}>
                  <Printer aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>{t('ful.pack.packedEmpty')}</p>}
    </section>
  );
}
