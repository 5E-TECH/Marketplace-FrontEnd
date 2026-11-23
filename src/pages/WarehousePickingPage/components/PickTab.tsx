import { App } from 'antd';
import { ArrowRight, CircleCheck, CircleX, Lock, PackageSearch } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useScanTaskMutation } from '../../../features/fulfillment/api/fulfillmentQueries';
import { byPackedDesc, currentPickTask, goodsOf, lineByCode, neededLine, productsOf, taskBadge } from '../../../features/fulfillment/lib/pickRules';
import type { PickLine, PickTask } from '../../../features/fulfillment/model/fulfillmentTypes';
import { ScanField } from '../../../features/warehouse/ui/ScanField';
import { getApiErrorCode, getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { parcelTitle, useParcelSubline } from './parcelText';
import { ParcelSteps } from './ParcelSteps';
import styles from '../WarehousePickingPage.module.css';

type ScanOutcome =
  | { kind: 'ok'; code: string; line: PickLine | null; picked: boolean }
  /** `foreign` — skanerlangan tovar bu buyurtmada umuman yo'q (boshqa posilkaniki yoki noma'lum). */
  | { kind: 'wrong'; code: string; message: string; scanned: PickLine | null; needed: PickLine | null; foreign: boolean };

const kg = (value: number | null) => (value === null ? '—' : `${value} kg`);
const Cell = ({ value }: { value: string | null }) => (value ? <span className={styles.cell}>{value}</span> : <>—</>);

interface PickTabProps {
  items: readonly PickTask[];
  /** Hamma posilkalar (bugun va ertaga) — noto'g'ri kod qaysi tovarniki ekanini topish uchun. */
  catalog: readonly PickTask[];
  phone: boolean;
  onPack: (task: PickTask) => void;
  /** Telefon: skan bloki sahifaning eng tepasiga (karkas-E 4.7) shu joyga chiqadi. */
  scanSlot?: HTMLElement | null;
  /** Telefon: joriy posilkadan keyin (dizaynda to'lqin kartasi shu yerda). */
  afterParcel?: ReactNode;
}

/** «Yig'ish» (ombor-yigish): joriy posilka — skan, noto'g'ri tovar bloki (TC1), qatorlar, «Qadoqqa o'tish»; posilkalar. */
export function PickTab({ items, catalog, phone, onPack, scanSlot = null, afterParcel = null }: PickTabProps) {
  const [focusId, setFocusId] = useState<string | null>(null);
  // Skan boshlangan posilka «Qadoqqa o'tish» bosilguncha ko'rinib turadi: ro'yxat yangilanishi skan javobidan oldin
  // kelsa ham (u PICKED bo'ladi) navbatdagi posilkaga sakrab ketmaydi.
  const focused = items.find((task) => task.taskId === focusId && (task.status === 'TO_PICK' || task.status === 'PICKED')) ?? null;
  const task = focused ?? currentPickTask(items);
  return (
    <div className={styles.columns}>
      <div className={styles.main}>
        {task
          ? <CurrentParcel key={task.taskId} task={task} catalog={catalog} phone={phone} scanSlot={scanSlot} onFocus={() => setFocusId(task.taskId)} onPack={() => { setFocusId(null); onPack(task); }} />
          : <NothingToPick hasItems={items.length > 0} />}
        {afterParcel}
      </div>
      <div className={styles.aside}>
        <ParcelList items={items} current={task} />
      </div>
    </div>
  );
}

function NothingToPick({ hasItems }: { hasItems: boolean }) {
  const { t } = useTranslation();
  return (
    <section className={styles.card} data-testid="pick-empty">
      <div className={styles.cardTitle}>
        <h2>{t(hasItems ? 'ful.pick.allPicked' : 'ful.pick.noParcels')}</h2>
        <span>{t(hasItems ? 'ful.pick.allPickedText' : 'ful.wave.emptyText')}</span>
      </div>
    </section>
  );
}

interface CurrentParcelProps {
  task: PickTask;
  catalog: readonly PickTask[];
  phone: boolean;
  scanSlot: HTMLElement | null;
  /** Skan boshlandi — posilka joriy bo'lib qoladi. */
  onFocus: () => void;
  onPack: () => void;
}

function CurrentParcel({ task, catalog, phone, scanSlot, onFocus, onPack }: CurrentParcelProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const subline = useParcelSubline();
  const scan = useScanTaskMutation();
  const lockId = useId();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const picked = task.status === 'PICKED';
  const confirmed = task.confirmedAt ? t('ful.pick.confirmedAt', { time: tashkentClock(Date.parse(task.confirmedAt)) }) : null;

  const onScan = (code: string) => {
    if (picked || scan.isPending) return;
    onFocus();
    scan.mutate({ taskId: task.taskId, code }, {
      onSuccess: (result) => {
        setOutcome({ kind: 'ok', code, line: lineByCode([task], code), picked: result.status === 'PICKED' });
      },
      onError: (error) => {
        if (getApiErrorCode(error) === 'WRONG_ITEM') {
          setOutcome({ kind: 'wrong', code, message: getApiErrorMessage(error), scanned: lineByCode(catalog, code), needed: neededLine(task), foreign: !lineByCode([task], code) });
          return;
        }
        notification.error({ title: t('ful.pick.scanError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
      },
    });
  };

  const wrong = outcome?.kind === 'wrong' ? outcome : null;
  const ok = outcome?.kind === 'ok' ? outcome : null;
  const packButton = (
    <button type="button" className={`${styles.primary} ${phone ? styles.barPrimary : ''}`} data-size="large" disabled={!picked} aria-describedby={picked ? undefined : lockId} onClick={onPack}>
      {t('ful.pick.toPack')}<ArrowRight aria-hidden />
    </button>
  );

  const scanBlock = (
    <ScanBlock
      task={task}
      phone={phone}
      disabled={picked}
      invalidCode={wrong?.code ?? null}
      onScan={onScan}
      onInvalidClear={() => setOutcome(null)}
      notice={wrong ? <WrongItem outcome={wrong} /> : ok ? <RightItem outcome={ok} /> : null}
    />
  );

  return (
    <>
      {phone ? (scanSlot ? createPortal(scanBlock, scanSlot) : scanBlock) : null}
      <section className={styles.card} data-testid="pick-parcel" data-task-id={task.taskId} data-status={task.status}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <h2>{parcelTitle(task)}</h2>
            <span>{subline(task, [confirmed, task.overdue ? t('ful.pick.overdue') : null]) || goodsOf(task)}</span>
          </div>
          <div className={styles.chips}><StatusBadge family="task" code={picked ? 'PICKED' : 'PICKING'} /></div>
        </div>
        <ParcelSteps step={picked ? 2 : 1} />
        {phone ? null : scanBlock}
        {phone ? (
          <ul className={styles.lineCards} aria-label={t('ful.pick.linesAria', { number: task.orderNumber })}>
            {task.lines.map((line, index) => (
              <li key={index} data-done={line.pickedQty >= line.quantity || undefined}>
                <span className={styles.lineTop}><Cell value={line.cell} /><strong>{line.pickedQty} / {line.quantity}</strong></span>
                <span className={styles.stack}><span>{line.productName}</span><span>{[line.barcode ?? line.sku, line.weightKg === null ? null : t('ful.pick.lineWeight', { weight: kg(line.weightKg) })].filter(Boolean).join(' · ')}</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table} data-testid="pick-lines">
              <caption className={styles.visuallyHidden}>{t('ful.pick.linesAria', { number: task.orderNumber })}</caption>
              <thead>
                <tr>
                  <th>{t('ful.pick.col.cell')}</th>
                  <th>{t('ful.pick.col.product')}</th>
                  <th className={styles.num}>{t('ful.pick.col.weight')}</th>
                  <th className={styles.num}>{t('ful.pick.col.need')}</th>
                  <th className={styles.num}>{t('ful.pick.col.scanned')}</th>
                </tr>
              </thead>
              <tbody>
                {task.lines.map((line, index) => (
                  <tr key={index} data-done={line.pickedQty >= line.quantity || undefined}>
                    <td><Cell value={line.cell} /></td>
                    <td><span className={styles.stack}><span>{line.productName}</span><span>{line.barcode ?? line.sku ?? '—'}</span></span></td>
                    <td className={styles.num}>{kg(line.weightKg)}</td>
                    <td className={styles.num}>{line.quantity}</td>
                    <td className={styles.num}><strong>{line.pickedQty}</strong> / {line.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.cardFoot}>
          <p className={styles.lockHint} id={lockId}>
            {picked ? <PackageSearch aria-hidden /> : <Lock aria-hidden />}
            <span>{t(picked ? 'ful.pick.nextHint' : 'ful.pick.lockHint')}</span>
          </p>
          <div className={styles.footActions}>{packButton}</div>
        </div>
      </section>
      {phone ? <PageActionBar>{packButton}</PageActionBar> : null}
    </>
  );
}

interface ScanBlockProps {
  task: PickTask;
  phone: boolean;
  disabled: boolean;
  invalidCode: string | null;
  onScan: (code: string) => void;
  onInvalidClear: () => void;
  notice: ReactNode;
}

/** Skan maydoni va natija bloki: telefonda — sahifaning birinchi bloki (karkas-E 4.7). */
function ScanBlock({ task, phone, disabled, invalidCode, onScan, onInvalidClear, notice }: ScanBlockProps) {
  const { t } = useTranslation();
  const field = (
    <ScanField
      label={t('ful.pick.barcode')}
      labelExtra={phone ? <span className={styles.labelExtra}>{parcelTitle(task)}</span> : undefined}
      placeholder={t(invalidCode ? 'ful.pick.placeholderWrong' : 'ful.pick.placeholder')}
      onScan={onScan}
      invalidCode={invalidCode}
      echoInvalid={false}
      onInvalidClear={onInvalidClear}
      disabled={disabled}
      testId="scan-field"
    />
  );
  if (!phone) return <>{notice}{field}</>;
  return (
    <section className={styles.card} aria-label={t('ful.pick.scanAria', { number: task.orderNumber })} data-tight>
      {field}
      {notice}
    </section>
  );
}

/** Noto'g'ri SKU (TC1): qizil to'xtatuvchi blok — nima skanerlandi va nima kerak; keyingi qadam yopiq. */
function WrongItem({ outcome }: { outcome: Extract<ScanOutcome, { kind: 'wrong' }> }) {
  const { t } = useTranslation();
  const side = (label: string, icon: ReactNode, line: PickLine | null, fallback: string) => (
    <div>
      <p>{icon}{label}</p>
      <p>{line?.productName ?? fallback}</p>
      <p>{t('ful.pick.cellLabel')} <strong>{line?.cell ?? '—'}</strong></p>
      <p>{line ? line.barcode ?? line.sku : fallback}</p>
    </div>
  );
  const { scanned, needed } = outcome;
  // «Elektr choynakni B-02-2 ga qaytaring va B-02-1 dan Simsiz quloqchinlarni oling.» — ikkala yacheyka ma'lum bo'lsa.
  const action = outcome.foreign && scanned?.cell && needed?.cell
    ? t('ful.pick.wrongBack', { scanned: scanned.productName, from: scanned.cell, needed: needed.productName, at: needed.cell })
    : `${outcome.message} ${t('ful.pick.wrongRule')}`;
  return (
    <div className={styles.stop} role="alert" data-testid="wrong-item">
      <div className={styles.stopHead}>
        <CircleX aria-hidden />
        <div>
          <p>{t('ful.pick.wrongTitle')}</p>
          <p>{action} {t('ful.pick.wrongLock')}</p>
        </div>
      </div>
      <div className={styles.compare}>
        {side(t('ful.pick.scannedLabel'), <CircleX aria-hidden />, scanned, outcome.code)}
        {side(t('ful.pick.neededLabel'), <ArrowRight aria-hidden />, needed, '—')}
      </div>
    </div>
  );
}

function RightItem({ outcome }: { outcome: Extract<ScanOutcome, { kind: 'ok' }> }) {
  const { t } = useTranslation();
  const where = [outcome.line?.barcode ?? outcome.code, outcome.line?.cell].filter(Boolean).join(' · ');
  return (
    <div className={styles.ok} role="status" data-testid="right-item">
      <CircleCheck aria-hidden />
      <p>
        <strong>{t('ful.pick.rightTitle', { product: outcome.line?.productName ?? outcome.code })}</strong>
        {t(outcome.picked ? 'ful.pick.rightDone' : 'ful.pick.rightMore', { where })}
      </p>
    </div>
  );
}

/** «Posilkalar · bugungi to'lqin»: yig'ilmoqda, navbatda (yacheyka), qadoq kutmoqda, qadoqlandi (vaqt). */
export function ParcelList({ items, current }: { items: readonly PickTask[]; current: PickTask | null }) {
  const { t } = useTranslation();
  const picking = current && current.status === 'TO_PICK' ? [current] : [];
  const groups = [
    { key: 'picking', label: t('ful.list.picking'), list: picking },
    { key: 'queued', label: t('ful.list.queued'), list: items.filter((task) => task.status === 'TO_PICK' && task.taskId !== current?.taskId) },
    { key: 'picked', label: t('ful.list.picked'), list: items.filter((task) => task.status === 'PICKED') },
    { key: 'packed', label: t('ful.list.packed'), list: items.filter((task) => task.status === 'PACKED').sort(byPackedDesc) },
  ].filter((group) => group.list.length);
  const end = (task: PickTask, group: string) => {
    if (group === 'picking') return <StatusBadge family="task" code="PICKING" />;
    if (group === 'queued') return <Cell value={task.lines[0]?.cell ?? null} />;
    if (group === 'packed') return task.packedAt ? tashkentClock(Date.parse(task.packedAt)) : null;
    return <StatusBadge family="task" code={taskBadge(task)} />;
  };
  return (
    <section className={styles.card} data-tight data-testid="parcel-list">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{t('ful.list.title')}</h2>
          <span>{t('ful.list.sub', { count: items.length })}</span>
        </div>
      </div>
      {groups.length ? groups.map((group) => (
        <div key={group.key}>
          <p className={styles.groupTitle}>{group.label} · {group.list.length}</p>
          <ul className={styles.parcels} aria-label={group.label}>
            {group.list.map((task) => (
              <li key={task.taskId} data-current={group.key === 'picking' || undefined} data-task-id={task.taskId}>
                <span className={styles.stack}>
                  <span>{parcelTitle(task)}</span>
                  <span>{productsOf(task)}{task.overdue ? ` · ${t('ful.pick.overdue')}` : ''}</span>
                </span>
                <span className={styles.parcelEnd}>{end(task, group.key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )) : <p className={styles.empty}>{t('ful.list.empty')}</p>}
    </section>
  );
}
