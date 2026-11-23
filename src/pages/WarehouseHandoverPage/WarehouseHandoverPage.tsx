import { App } from 'antd';
import { CircleCheck, CircleDot, CircleMinus, CircleX, Clock, FileCheck, FileText, Info, Printer, RotateCcw, TriangleAlert, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { fetchActPdf } from '../../features/fulfillment/api/fulfillmentApi';
import { useCreateHandoverActMutation, useHandoverActsQuery, usePickListQuery } from '../../features/fulfillment/api/fulfillmentQueries';
import { placeOf, productsOf } from '../../features/fulfillment/lib/pickRules';
import type { HandoverAct, PickTask } from '../../features/fulfillment/model/fulfillmentTypes';
import type { HandoverScan } from '../../features/fulfillment/model/handoverDraft';
import { useHandover, type HandoverNotice } from '../../features/fulfillment/model/useHandover';
import { ScanField } from '../../features/warehouse/ui/ScanField';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { tashkentClock, tashkentDate, tashkentDay } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { formatMoneyNbsp } from '../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { PrintDialog } from '../../shared/ui/PrintDialog/PrintDialog';
import shared from '../WarehousePickingPage/WarehousePickingPage.module.css';
import styles from './WarehouseHandoverPage.module.css';

type Filter = 'all' | 'pending' | 'scanned';
const clock = (iso: string) => tashkentClock(Date.parse(iso));

/**
 * «Elchi'ga topshirish» (FE-17; ombor-topshirish, OMB-5): yorliqdagi QR skan — posilka ochiq aktga; «Aktni yakunlash» —
 * bitta so'rov, aktdagi son = ekrandagi skanerlangan son (TC3). Akt PDF — imzo uchun (hujjat-topshirish-akti).
 */
export default function WarehouseHandoverPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const user = useAppSelector(selectAuthUser);
  const today = tashkentDate();
  const query = usePickListQuery(today);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const handover = useHandover(items);
  const create = useCreateHandoverActMutation();
  const [finished, setFinished] = useState<HandoverAct | null>(null);
  const [printAct, setPrintAct] = useState<HandoverAct | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  if (query.isError && !query.data) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <PageLoader compact />;

  const packed = items.filter((task) => task.status === 'PACKED');
  const picking = items.filter((task) => task.status === 'TO_PICK' || task.status === 'PICKED').length;
  const scanned = handover.tokens.length;
  const pending = packed.filter((task) => !handover.scannedIds.has(task.orderId));
  const scannedTasks = packed.filter((task) => handover.scannedIds.has(task.orderId));
  const total = Math.max(packed.length, scanned);
  const cod = scannedTasks.length === scanned && scannedTasks.every((task) => task.codAmount !== null)
    ? scannedTasks.reduce((sum, task) => sum + (task.codAmount ?? 0), 0)
    : null;

  const finish = () => {
    if (!scanned || create.isPending) return;
    create.mutateAsync(handover.tokens)
      .then((act) => {
        handover.reset();
        setFinished(act);
        setPrintAct(act);
        notification.success({ title: t('ful.act.done', { id: act.id, count: act.parcelCount }), description: t('ful.act.doneText'), placement: phone ? 'top' : 'bottomRight', duration: 4 });
      })
      .catch((error: unknown) => notification.error({ title: t('ful.act.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight', duration: 0 }));
  };

  const finishButton = (
    <button type="button" className={`${shared.primary} ${styles.finish}`} data-size="large" disabled={!scanned || create.isPending} aria-label={t('ful.act.finishAria', { count: scanned })} onClick={finish}>
      <FileCheck aria-hidden />{t('ful.act.finish')}<span className={styles.finishCount}>{scanned}</span>
    </button>
  );

  return (
    <div className={shared.page} data-testid="handover-page">
      <div className={styles.top}>
        <div className={styles.left}>
          <section className={shared.card} aria-label={t('ful.handover.scanAria')} data-tight>
            <ScanField
              label={t('ful.handover.qr')}
              placeholder={t('ful.handover.placeholder')}
              onScan={(code) => { setFinished(null); handover.scan(code); }}
              invalidCode={handover.notice && handover.notice.kind !== 'ADDED' && handover.notice.kind !== 'DUPLICATE' ? handover.notice.scan.code : null}
              onInvalidClear={handover.clearNotice}
              testId="scan-field"
            />
            {handover.notice ? <ScanNotice notice={handover.notice} /> : null}
            <p className={styles.hint}>{t('ful.handover.hint')}</p>
            <Journal journal={handover.draft.journal} total={handover.draft.journalTotal} canUndo={handover.hasLast} onUndo={handover.undoLast} />
          </section>
        </div>
        <div className={styles.right}>
          <section className={shared.card} data-testid="act-card" data-state={finished ? 'done' : 'open'}>
            <div className={shared.cardHead}>
              <div className={shared.cardTitle}>
                <h2>{t('ful.act.title')}</h2>
                <span>{finished ? t('ful.act.closedAt', { at: finished.createdAt }) : scanned ? t('ful.act.openedAt', { date: tashkentDay(handover.draft.startedAt), time: clock(handover.draft.startedAt) }) : t('ful.act.notOpened')}</span>
              </div>
              <div className={shared.chips}>
                {finished ? <span className={shared.cell}>{t('ful.act.number', { id: finished.id })}</span> : null}
                <span className={styles.chipInfo}>{finished ? <CircleCheck size={14} aria-hidden /> : <CircleDot size={14} aria-hidden />}{t(finished ? 'ful.act.closed' : 'ful.act.open')}</span>
              </div>
            </div>
            <div className={styles.actBody}>
            <div className={styles.actCount}>
              <span>{t('ful.act.inAct')}</span>
              <span className={styles.actValue}>
                <span data-testid="act-count">{finished ? finished.parcelCount : scanned}</span>
                <span>{finished ? t('ful.act.parcels') : t('ful.act.ofParcels', { total })}</span>
              </span>
              {finished ? null : (
                <>
                  <div className={styles.bar} role="img" aria-label={t('ful.act.barAria', { total, scanned })}>
                    {scanned ? <span data-kind="scanned" style={{ flex: `${scanned} 1 0px` }} /> : null}
                    {total - scanned > 0 ? <span style={{ flex: `${total - scanned} 1 0px` }} /> : null}
                  </div>
                  <div className={shared.legend}>
                    <span><i data-kind="packed" />{t('ful.act.scanned')} <strong>{scanned}</strong></span>
                    <span><i />{t('ful.act.left')} <strong>{Math.max(0, total - scanned)}</strong></span>
                  </div>
                </>
              )}
            </div>
            <dl className={`${shared.facts} ${styles.actFacts}`}>
              <div><dt>{t('ful.act.by')}</dt><dd>{shortPersonName(user?.name ?? '') || '—'}</dd></div>
              <div><dt>{t('ful.wave.pickup')}</dt><dd><span className={shared.muted}>{t('ful.wave.pickupTbd')}</span></dd></div>
              <div><dt>{t('ful.act.picking')}</dt><dd>{t('ful.act.pickingValue', { count: picking })}</dd></div>
              {cod !== null && !finished ? <div><dt>{t('ful.act.cod')}</dt><dd>{t('ful.sum', { amount: formatMoneyNbsp(cod) })}</dd></div> : null}
            </dl>
            </div>
            {finished ? (
              <>
                <div className={shared.ok} role="status">
                  <CircleCheck aria-hidden />
                  <p><strong>{t('ful.act.doneTitle')}</strong>{t('ful.act.doneText')}</p>
                </div>
                <button type="button" className={shared.secondary} onClick={() => setPrintAct(finished)}><Printer aria-hidden />{t('ful.act.print')}</button>
                <p className={styles.note}>{t('ful.act.nextHint')}</p>
              </>
            ) : (
              <>
                <p className={styles.note}>{t('ful.act.rule')}</p>
                <div className={styles.finishDesktop}>{finishButton}</div>
                <p className={styles.note}>{t('ful.act.leftover', { pending: pending.length, picking })}</p>
              </>
            )}
          </section>
        </div>
      </div>

      <ParcelsTable
        packed={packed}
        pending={pending}
        scanned={handover.draft.tokens}
        picking={picking}
        filter={filter}
        onFilter={setFilter}
        updatedAt={query.dataUpdatedAt}
        onRefresh={() => void query.refetch()}
        phone={phone}
      />
      <PreviousActs onPrint={setPrintAct} />
      <p className={styles.footnote}><Info aria-hidden /><span>{t('ful.handover.footnote')}</span></p>

      {phone && !finished ? <PageActionBar>{finishButton}</PageActionBar> : null}
      {printAct ? (
        <PrintDialog
          open
          title={t('ful.act.printTitle', { id: printAct.id })}
          description={t('ful.act.printSub', { count: printAct.parcelCount, at: printAct.createdAt })}
          load={() => fetchActPdf(printAct.id, `topshirish-akti-${printAct.id}.pdf`)}
          facts={[[t('ful.act.parcelsLabel'), String(printAct.parcelCount)], [t('ful.act.closedLabel'), printAct.createdAt]]}
          previewCaption={t('ful.act.caption')}
          onClose={() => setPrintAct(null)}
          testId="act-print"
        />
      ) : null}
    </div>
  );
}

/** Skan natijasi (ombor-topshirish holatlar 1): qo'shildi, takroriy, qadoqlanmagan, tovar kodi, noma'lum. */
function ScanNotice({ notice }: { notice: HandoverNotice }) {
  const { t } = useTranslation();
  const { scan } = notice;
  const name = [scan.orderNumber, scan.productName].filter(Boolean).join(' · ');
  if (notice.kind === 'ADDED') {
    return (
      <div className={shared.ok} role="status" data-testid="handover-notice" data-kind="added">
        <CircleCheck aria-hidden />
        <p><strong>{t('ful.handover.addedTitle', { position: scan.position ?? 0 })}</strong>{name || scan.code}</p>
      </div>
    );
  }
  if (notice.kind === 'DUPLICATE') {
    return (
      <div className={shared.warn} role="status" data-testid="handover-notice" data-kind="duplicate">
        <CircleDot aria-hidden />
        <p><strong>{t('ful.handover.duplicateTitle')}</strong>{t('ful.handover.duplicateText', { name: name || scan.code, time: scan.firstAt ? clock(scan.firstAt) : '—' })}</p>
      </div>
    );
  }
  const text = notice.kind === 'NOT_PACKED'
    ? t('ful.handover.notPackedText', { name })
    : notice.kind === 'PRODUCT_CODE'
      ? t('ful.handover.productText', { code: scan.code, product: scan.productName ?? '' })
      : t('ful.handover.unknownText', { code: scan.code });
  return (
    <div className={shared.warn} role="alert" data-testid="handover-notice" data-kind={notice.kind === 'NOT_PACKED' ? 'not-packed' : notice.kind === 'PRODUCT_CODE' ? 'product' : 'unknown'}>
      <TriangleAlert aria-hidden />
      <p><strong>{t(notice.kind === 'NOT_PACKED' ? 'ful.handover.notPackedTitle' : notice.kind === 'PRODUCT_CODE' ? 'ful.handover.productTitle' : 'ful.handover.unknownTitle')}</strong>{text}</p>
    </div>
  );
}

function Journal({ journal, total, canUndo, onUndo }: { journal: readonly HandoverScan[]; total: number; canUndo: boolean; onUndo: () => void }) {
  const { t } = useTranslation();
  const sub = (scan: HandoverScan) => {
    switch (scan.kind) {
      case 'ADDED': return t('ful.journal.added', { position: scan.position ?? 0 });
      case 'DUPLICATE': return t('ful.journal.duplicate', { time: scan.firstAt ? clock(scan.firstAt) : '—' });
      case 'NOT_PACKED': return t('ful.journal.notPacked');
      case 'PRODUCT_CODE': return t('ful.journal.product');
      default: return t('ful.journal.unknown');
    }
  };
  return (
    <div className={styles.journalBlock}>
      <div className={styles.journalHead}>
        <h2>{t('ful.journal.title')}</h2>
        <span>{t('ful.journal.sub', { count: total })}</span>
      </div>
      {journal.length ? (
        <ol className={styles.journal} aria-label={t('ful.journal.title')} data-testid="handover-journal">
          {journal.slice(0, 5).map((scan) => (
            <li key={scan.key} data-tone={scan.kind === 'ADDED' ? 'ok' : scan.kind === 'DUPLICATE' ? undefined : 'danger'}>
              {scan.kind === 'ADDED' ? <CircleCheck aria-hidden /> : scan.kind === 'DUPLICATE' ? <CircleMinus aria-hidden /> : <CircleX aria-hidden />}
              <span><span>{[scan.orderNumber, scan.productName].filter(Boolean).join(' · ') || scan.code}</span><span>{sub(scan)}</span></span>
              <span>{clock(scan.at)}</span>
            </li>
          ))}
        </ol>
      ) : <p className={shared.empty}>{t('ful.journal.empty')}</p>}
      <button type="button" className={styles.undo} disabled={!canUndo} onMouseDown={(event) => event.preventDefault()} onClick={onUndo}>
        <Undo2 aria-hidden />{t('ful.journal.undo')}
      </button>
    </div>
  );
}

interface ParcelsTableProps {
  packed: readonly PickTask[];
  pending: readonly PickTask[];
  scanned: readonly { orderId: string | null; at: string }[];
  picking: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  updatedAt: number;
  onRefresh: () => void;
  /** Telefonda jadval o'rniga ro'yxat (ombor-topshirish.mobil). */
  phone: boolean;
}

/** «Bugungi to'lqindan qadoqlangan posilkalar»: skanerlanmaganlari boshida; Hammasi · Skanerlanmagan · Skanerlangan. */
function ParcelsTable({ packed, pending, scanned, picking, filter, onFilter, updatedAt, onRefresh, phone }: ParcelsTableProps) {
  const { t } = useTranslation();
  const scannedAt = new Map(scanned.filter((item) => item.orderId).map((item) => [item.orderId as string, item.at]));
  const ordered = [...pending, ...packed.filter((task) => scannedAt.has(task.orderId))];
  const visible = ordered.filter((task) => filter === 'all' || (filter === 'scanned') === scannedAt.has(task.orderId));
  const counts: Record<Filter, number> = { all: packed.length, pending: pending.length, scanned: packed.length - pending.length };
  return (
    <section className={shared.card} data-testid="handover-parcels">
      <div className={shared.cardHead}>
        <div className={shared.cardTitle}>
          <h2>{pending.length ? t('ful.parcels.pendingTitle', { count: pending.length }) : t('ful.parcels.allTitle')}</h2>
          <span>{t('ful.parcels.sub', { packed: packed.length, picking })}</span>
        </div>
        <div className={`${shared.pills} ${styles.filterTabs}`} role="tablist" aria-label={t('ful.parcels.filterAria')}>
          {(['all', 'pending', 'scanned'] as const).map((value) => (
            <button key={value} type="button" role="tab" className={shared.pill} aria-selected={filter === value} onClick={() => onFilter(value)}>
              {t(`ful.parcels.${value}`)}<span className={shared.pillCount}>{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.tableTools}>
        <div className={shared.updated}>
          <span>{t('ful.page.updated')} <strong>{updatedAt ? tashkentClock(updatedAt) : '—'}</strong></span>
          <button type="button" className={shared.refresh} onClick={onRefresh}><RotateCcw aria-hidden />{t('ful.page.refresh')}</button>
        </div>
      </div>
      {visible.length && phone ? (
        <ul className={styles.parcelCards} aria-label={t('ful.parcels.caption')}>
          {visible.map((task) => {
            const at = scannedAt.get(task.orderId);
            return (
              <li key={task.taskId} data-order-id={task.orderId}>
                <span className={styles.cardRow}><strong>{task.orderNumber}</strong><ScanChip at={at} /></span>
                <span className={styles.cardWho}>{task.customerName ?? '—'}<span> · {productsOf(task)}</span></span>
                <span className={styles.cardRow}><span>{placeOf(task) ?? '—'}</span>{task.deliveryMode ? <DeliveryChip mode={task.deliveryMode} /> : null}</span>
              </li>
            );
          })}
        </ul>
      ) : visible.length ? (
        <div className={shared.scroll}>
          <table className={shared.table}>
            <caption className={shared.visuallyHidden}>{t('ful.parcels.caption')}</caption>
            <thead>
              <tr>
                <th>{t('ful.parcels.col.order')}</th>
                <th className={styles.wide}>{t('ful.parcels.col.product')}</th>
                <th>{t('ful.parcels.col.address')}</th>
                <th className={styles.wide}>{t('ful.parcels.col.delivery')}</th>
                <th>{t('ful.parcels.col.scan')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => {
                const mode = task.deliveryMode ? t(task.deliveryMode === 'DOOR' ? 'ful.parcels.door' : 'ful.parcels.center') : null;
                return (
                  <tr key={task.taskId} data-order-id={task.orderId}>
                    {/* Planshetda (ombor-topshirish.planshet) 3 ustun: mahsulot buyurtma ostida, yetkazish tuman yonida. */}
                    <td>
                      <span className={shared.stack}>
                        <span>{task.orderNumber}<span className={styles.narrow}> · {task.customerName ?? '—'}</span></span>
                        <span><span className={styles.wide}>{task.customerName ?? '—'}</span><span className={styles.narrow}>{productsOf(task)}</span></span>
                      </span>
                    </td>
                    <td className={styles.wide}><span className={shared.stack}><span>{productsOf(task)}</span><span>{t('ful.parcels.pieces', { count: task.quantity })}</span></span></td>
                    <td>
                      <span className={shared.stack}>
                        <span>{task.regionName ?? placeOf(task) ?? '—'}</span>
                        <span>{task.districtName ?? ''}{mode ? <span className={styles.narrow}>{task.districtName ? ' · ' : ''}{mode.toLocaleLowerCase()}</span> : null}</span>
                      </span>
                    </td>
                    <td className={styles.wide}>{task.deliveryMode ? <DeliveryChip mode={task.deliveryMode} /> : '—'}</td>
                    <td><ScanChip at={scannedAt.get(task.orderId)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className={shared.empty}>{t(packed.length ? 'ful.parcels.emptyFilter' : 'ful.parcels.empty')}</p>}
    </section>
  );
}

function DeliveryChip({ mode }: { mode: NonNullable<PickTask['deliveryMode']> }) {
  const { t } = useTranslation();
  return <span className={styles.chip}>{t(mode === 'DOOR' ? 'ful.parcels.door' : 'ful.parcels.center')}</span>;
}

/** «Skanerlandi 14:24» yoki «Skanerlanmagan». */
function ScanChip({ at }: { at: string | undefined }) {
  const { t } = useTranslation();
  if (!at) return <span className={styles.scanState} data-state="pending"><Clock aria-hidden />{t('ful.parcels.notScanned')}</span>;
  return (
    <span className={styles.scanCell}>
      <span className={styles.scanState} data-state="scanned"><CircleCheck aria-hidden />{t('ful.parcels.scannedChip')}</span>
      <span>{clock(at)}</span>
    </span>
  );
}

/** «Oldingi topshirish aktlari» — taklif endpoint; backend bermasa ko'rsatilmaydi. */
function PreviousActs({ onPrint }: { onPrint: (act: HandoverAct) => void }) {
  const { t } = useTranslation();
  const query = useHandoverActsQuery();
  const acts = query.data ?? [];
  if (!acts.length) return null;
  return (
    <section className={shared.card} data-testid="previous-acts">
      <div className={shared.cardTitle}><h2>{t('ful.acts.title')}</h2></div>
      <div className={shared.scroll}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>{t('ful.acts.col.act')}</th>
              <th>{t('ful.acts.col.closed')}</th>
              <th className={shared.num}>{t('ful.acts.col.parcels')}</th>
              <th className={shared.num}><span className={shared.visuallyHidden}>PDF</span></th>
            </tr>
          </thead>
          <tbody>
            {acts.map((act) => (
              <tr key={act.id}>
                <td><strong>{t('ful.act.number', { id: act.id })}</strong></td>
                <td>{act.createdAt}</td>
                <td className={shared.num}>{act.parcelCount}</td>
                <td className={shared.num}><button type="button" className={shared.linkButton} onClick={() => onPrint(act)}><FileText aria-hidden />PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
