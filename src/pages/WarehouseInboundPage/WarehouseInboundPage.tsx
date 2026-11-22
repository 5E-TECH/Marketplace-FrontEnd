import { App, Button } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import {
  useCompleteShipmentMutation,
  useInboundWholesalersQuery,
  useShipmentQuery,
  useShipmentsQuery,
  useStartReceivingMutation,
  useUndoScanMutation,
} from '../../features/inbound/api/inboundQueries';
import { inboundActPath } from '../../features/inbound/lib/shipmentLabels';
import { AWAITING_STATUSES, COMPLETED_STATUSES, type InboundProductOption, type InboundShipment } from '../../features/inbound/model/inboundTypes';
import { useReceiving } from '../../features/inbound/model/useReceiving';
import type { ScanFieldHandle } from '../../features/warehouse/ui/ScanField';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { AwaitingView } from './components/AwaitingView';
import { LotDialog, type LotRequest } from './components/LotDialog';
import { FindByNameDialog, FinishDialog, UndoScanDialog } from './components/ReceiveDialogs';
import { ActCard, LotsTable, ReceivingCard } from './components/ReceivingPanel';
import { ScanCard } from './components/ScanCard';
import { QueueCard, ScanJournal } from './components/SideCards';
import { UndeclaredDialog, type UndeclaredPreset } from './components/UndeclaredDialog';
import styles from './WarehouseInboundPage.module.css';

const PHONE = '(max-width: 767.98px)';

/**
 * «Postavka qabuli» (FE-16; ombor-qabul, umumiy-aloqa-uzildi «Ombor — skan navbati»): kutilayotgan postavkani skaner
 * bilan sanash. Qabul boshlanmagan bo'lsa — ro'yxat (birinchi skan mos postavkani o'zi ochadi); boshlangan bo'lsa —
 * sanoq, jurnal, farq akti va yakunlash. Optovik kabinetisiz: arizani omborchi ham ochadi (arizasiz postavka).
 */
export default function WarehouseInboundPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery(PHONE);
  const today = tashkentDate();
  const [params, setParams] = useSearchParams();
  const scanRef = useRef<ScanFieldHandle>(null);
  const awaitingQuery = useShipmentsQuery({ page: 1, limit: 100, status: AWAITING_STATUSES, sort: 'expectedAt' });
  const doneQuery = useShipmentsQuery({ page: 1, limit: 100, status: COMPLETED_STATUSES, completedOn: today, sort: '-completedAt' });
  const wholesalersQuery = useInboundWholesalersQuery();
  const start = useStartReceivingMutation();
  const awaiting = useMemo(() => awaitingQuery.data?.items ?? [], [awaitingQuery.data]);
  const done = useMemo(() => doneQuery.data?.items ?? [], [doneQuery.data]);
  const wholesalers = useMemo(() => wholesalersQuery.data ?? [], [wholesalersQuery.data]);
  const catalog = useMemo(() => wholesalers.flatMap((item) => item.products), [wholesalers]);
  const [undeclared, setUndeclared] = useState<UndeclaredPreset | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [listNote, setListNote] = useState<string | null>(null);
  const [listProblem, setListProblem] = useState<string | null>(null);
  const [firstCode, setFirstCode] = useState<string | null>(null);
  const [lastDone, setLastDone] = useState<string | null>(null);

  // Joriy qabul: manzildagi yoki — sahifa ochilganda — boshlangan (eng oxirgi boshlangani). Qabul yakunlangach
  // ro'yxatda qoladi (toast va «Bugun qabul qilingan»): boshqa boshlangan postavkaga o'zi o'tmaydi.
  const [resume, setResume] = useState(true);
  const requested = params.get('shipment');
  const inProgress = awaiting.filter((item) => item.receivingStartedAt).sort((a, b) => (b.receivingStartedAt ?? '').localeCompare(a.receivingStartedAt ?? ''))[0];
  const activeId = requested ?? (resume ? inProgress?.id : undefined) ?? null;
  const activeQuery = useShipmentQuery(activeId ?? undefined);
  const active = activeQuery.data && !activeQuery.data.completedAt && activeQuery.data.receivingStartedAt ? activeQuery.data : null;

  const focusScan = () => window.setTimeout(() => scanRef.current?.focus(), 0);

  const open = useCallback((shipment: InboundShipment, code: string | null = null) => {
    // Qabul ko'rinishi mutatsiya javobidan oldin ochilishi mumkin (kesh yangilanadi) — birinchi kod oldindan.
    setFirstCode(code);
    start.mutate(shipment.id, {
      onSuccess: () => {
        setMatched([]);
        setListNote(null);
        setParams({ shipment: shipment.id }, { replace: true });
      },
      onError: (error) => {
        setFirstCode(null);
        notification.error({ title: t('inb.start.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
      },
    });
  }, [notification, phone, setParams, start, t]);

  /** Ro'yxat ko'rinishida skan: bitta mos postavka — qabul o'zi ochiladi; bir nechta — ro'yxatda belgilanadi. */
  const onListScan = (code: string) => {
    setListProblem(null);
    const matches = awaiting.filter((item) => item.sku.barcode === code);
    if (matches.length === 1) return open(matches[0], code);
    if (matches.length > 1) {
      setMatched(matches.map((item) => item.id));
      setListNote(t('inb.recv.manyMatches', { count: matches.length }));
      return undefined;
    }
    const product = catalog.find((item) => item.barcode === code);
    setMatched([]);
    if (!product) {
      setListNote(null);
      setListProblem(code);
      return undefined;
    }
    setListNote(t('inb.recv.noShipment', { product: product.name }));
    return undefined;
  };

  const onFinished = (shipment: InboundShipment) => {
    const key = `finished-${shipment.id}`;
    const time = shipment.completedAt ? tashkentClock(Date.parse(shipment.completedAt)) : tashkentClock();
    notification.success({
      key,
      title: t('inb.finish.done', { number: shipment.number }),
      description: shipment.status === 'RECEIVED' ? t('inb.finish.doneExact', { time }) : t('inb.finish.doneText', { time }),
      placement: phone ? 'top' : 'bottomRight',
      duration: 6,
      actions: <Button size="small" onClick={() => { notification.destroy(key); window.open(inboundActPath(shipment.id), '_blank', 'noopener'); }}>{t('inb.finish.openAct')}</Button>,
    });
    setLastDone(shipment.id);
    setFirstCode(null);
    setResume(false);
    setParams({}, { replace: true });
  };

  const undeclaredDialog = (
    <UndeclaredDialog
      key={undeclared ? `${undeclared.wholesalerId ?? ''}-${undeclared.variantId ?? ''}` : 'closed'}
      preset={undeclared}
      wholesalers={wholesalers}
      awaiting={awaiting}
      onClose={() => { setUndeclared(null); focusScan(); }}
      onStartExpected={(shipment) => { setUndeclared(null); open(shipment); }}
      onDeclared={() => { setUndeclared(null); focusScan(); }}
    />
  );

  if (awaitingQuery.isError && !awaitingQuery.data) return <LoadError error={awaitingQuery.error} onRetry={() => void awaitingQuery.refetch()} />;
  if (awaitingQuery.isPending || (activeId && activeQuery.isPending)) return <PageLoader compact />;

  if (active) {
    return (
      <>
        <ReceivingView
          key={active.id}
          shipment={active}
          phone={phone}
          today={today}
          catalog={catalog}
          awaiting={awaiting}
          done={done}
          initialCode={firstCode}
          scanRef={scanRef}
          onOpen={(shipment) => open(shipment)}
          onUndeclared={() => setUndeclared({})}
          onFinished={onFinished}
        />
        {undeclaredDialog}
      </>
    );
  }

  return (
    <div className={styles.page} data-testid="inbound-page" data-view="list">
      <ScanCard
        ref={scanRef}
        phone={phone}
        onScan={onListScan}
        problem={listProblem ? { code: listProblem, kind: 'UNKNOWN', productName: null } : null}
        onProblemClear={() => setListProblem(null)}
        message={listNote ? <p className={styles.listNote} role="status">{listNote}</p> : null}
      />
      <AwaitingView
        phone={phone}
        awaiting={awaiting}
        done={done}
        today={today}
        matched={matched}
        starting={start.isPending ? start.variables ?? null : null}
        lastDone={lastDone}
        onStart={(shipment) => open(shipment)}
        onUndeclared={() => setUndeclared({})}
      />
      {undeclaredDialog}
    </div>
  );
}

interface ReceivingViewProps {
  shipment: InboundShipment;
  phone: boolean;
  today: string;
  catalog: readonly InboundProductOption[];
  awaiting: readonly InboundShipment[];
  done: readonly InboundShipment[];
  initialCode: string | null;
  scanRef: RefObject<ScanFieldHandle | null>;
  onOpen: (shipment: InboundShipment) => void;
  onUndeclared: () => void;
  onFinished: (shipment: InboundShipment) => void;
}

/** Qabul ochiq (ombor-qabul asosiy taxta): skan, sanoq, jurnal, farq akti, kutilayotganlar. */
function ReceivingView({ shipment, phone, today, catalog, awaiting, done, initialCode, scanRef, onOpen, onUndeclared, onFinished }: ReceivingViewProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const undo = useUndoScanMutation();
  const complete = useCompleteShipmentMutation();
  const [lotRequest, setLotRequest] = useState<LotRequest | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [note, setNote] = useState('');
  const focusScan = () => window.setTimeout(() => scanRef.current?.focus(), 0);
  const placement = phone ? 'top' as const : 'bottomRight' as const;
  const receiving = useReceiving(shipment, {
    catalog,
    onLotRequired: (code) => setLotRequest({ code }),
    onError: (message) => notification.error({ title: t('inb.recv.error'), description: message, placement }),
  });

  // Ro'yxatdagi birinchi skan qabulni ochgan bo'lsa — o'sha skan shu postavkaga yoziladi.
  const firstScan = useRef(initialCode);
  useEffect(() => {
    if (firstScan.current) receiving.scan(firstScan.current);
    firstScan.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat birinchi chizishda
  }, []);

  const product = catalog.find((item) => item.variantId === shipment.sku.variantId) ?? null;
  const blocked = shipment.lots.filter((lot) => !lot.sellable).reduce((sum, lot) => sum + lot.quantity, 0);
  const sellable = receiving.counts.accepted - blocked;

  const confirmUndo = () => {
    if (!receiving.lastCounted) return;
    undo.mutate({ id: shipment.id, scanId: receiving.lastCounted.id }, {
      onSuccess: () => {
        setUndoOpen(false);
        notification.success({ title: t('inb.undo.done'), placement, duration: 3 });
        focusScan();
      },
      onError: (error) => notification.error({ title: t('inb.undo.error'), description: getApiErrorMessage(error), placement }),
    });
  };

  // Javob keshni yangilaydi va bu ko'rinish yopiladi (postavka yakunlandi) — `mutate` callbacki chaqirilmay qoladi;
  // va'da esa baribir bajariladi, natija sahifaga (`onFinished`) beriladi.
  const confirmFinish = (confirmShortage: boolean) => {
    complete.mutateAsync({ id: shipment.id, note: note.trim() || undefined, confirmShortage })
      .then((next) => {
        setFinishOpen(false);
        onFinished(next);
      })
      .catch((error: unknown) => notification.error({ title: t('inb.finish.error'), description: getApiErrorMessage(error), placement }));
  };

  const finishButton = (
    <button type="button" className={`${styles.primary} ${styles.barPrimary}`} disabled={receiving.queueSize > 0} onClick={() => setFinishOpen(true)}>
      {t('inb.recv.finish')}
    </button>
  );

  return (
    <div className={styles.page} data-testid="inbound-page" data-view="receiving" data-shipment-id={shipment.id}>
      <ScanCard
        ref={scanRef}
        phone={phone}
        onScan={receiving.scan}
        mode={receiving.mode}
        onModeChange={(mode) => { receiving.setMode(mode); scanRef.current?.focus(); }}
        problem={receiving.problem}
        onProblemClear={receiving.clearProblem}
        duplicate={receiving.duplicateNotice}
        accepted={receiving.counts.accepted}
        onFindByName={() => setFindOpen(true)}
      />
      <div className={styles.columns}>
        <div className={styles.main}>
          <ReceivingCard
            shipment={shipment}
            counts={receiving.counts}
            phone={phone}
            onNewLot={shipment.sku.expiryTracked && shipment.lots.some((lot) => lot.expiresAt) ? () => setLotRequest({ code: null }) : undefined}
            lots={shipment.sku.expiryTracked ? <LotsTable shipment={shipment} today={today} /> : undefined}
            blocked={blocked}
          />
          <ActCard
            shipment={shipment}
            counts={receiving.counts}
            phone={phone}
            receiver={shortPersonName(user?.name ?? '')}
            today={today}
            note={note}
            onNoteChange={setNote}
            onFinish={() => setFinishOpen(true)}
            queued={receiving.queueSize}
          />
        </div>
        <div className={styles.aside}>
          <ScanJournal
            shipment={shipment}
            entries={receiving.journal}
            total={receiving.journalTotal}
            stalled={receiving.stalled}
            canUndo={receiving.lastCounted !== null}
            onUndo={() => setUndoOpen(true)}
          />
          <QueueCard current={shipment} awaiting={awaiting} done={done} today={today} onOpen={onOpen} onUndeclared={onUndeclared} />
        </div>
      </div>

      {/* Pastki panel sahifaning bevosita bolasi — ustunlar tartibiga (order) aralashmaydi. */}
      {phone ? <PageActionBar>{finishButton}</PageActionBar> : null}
      <LotDialog
        shipment={shipment}
        request={lotRequest}
        today={today}
        onClose={() => { setLotRequest(null); focusScan(); }}
        onSaved={(lotId, code) => { receiving.lotSaved(lotId, code); setLotRequest(null); focusScan(); }}
      />
      <FindByNameDialog
        open={findOpen}
        shipment={shipment}
        catalog={catalog}
        mode={receiving.mode}
        onClose={() => { setFindOpen(false); focusScan(); }}
        onCount={() => { setFindOpen(false); receiving.countManual(); focusScan(); }}
      />
      <UndoScanDialog
        shipment={shipment}
        scan={undoOpen ? receiving.lastCounted : null}
        counts={receiving.counts}
        saving={undo.isPending}
        onClose={() => { setUndoOpen(false); focusScan(); }}
        onConfirm={confirmUndo}
      />
      <FinishDialog
        open={finishOpen}
        shipment={shipment}
        counts={receiving.counts}
        available={product?.available ?? null}
        sellable={sellable}
        note={note}
        onNoteChange={setNote}
        saving={complete.isPending}
        onClose={() => { setFinishOpen(false); focusScan(); }}
        onConfirm={confirmFinish}
      />
    </div>
  );
}
