import { App, Button } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useAwaitingShipments, useReceivedToday, useReceiveShipmentMutation, useWarehouseStockQuery } from '../../features/inbound/api/inboundQueries';
import { isSellableExpiry } from '../../features/inbound/lib/expiry';
import { inboundActPath } from '../../features/inbound/lib/shipmentLabels';
import type { InboundShipment, ShipmentItem } from '../../features/inbound/model/inboundTypes';
import { clearDraft, emptyDraft, saveDraft, startedDrafts } from '../../features/inbound/model/receivingDraft';
import { useReceiving } from '../../features/inbound/model/useReceiving';
import type { ScanFieldHandle } from '../../features/warehouse/ui/ScanField';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { useOnlineStatus } from '../../shared/lib/useOnlineStatus';
import { tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { AwaitingView } from './components/AwaitingView';
import { LotDialog, type LotRequest } from './components/LotDialog';
import { FindByNameDialog, FinishDialog, UndoScanDialog } from './components/ReceiveDialogs';
import { ActCard, ReceivingCard, type ItemView } from './components/ReceivingPanel';
import { ScanCard } from './components/ScanCard';
import { QueueCard, ScanJournal } from './components/SideCards';
import { UndeclaredDialog, type UndeclaredPreset } from './components/UndeclaredDialog';
import styles from './WarehouseInboundPage.module.css';

const PHONE = '(max-width: 767.98px)';

/**
 * «Postavka qabuli» (FE-16; ombor-qabul): kutilayotgan postavkani skaner bilan sanash. Qabul boshlanmagan bo'lsa —
 * ro'yxat (birinchi skan mos postavkani o'zi ochadi); boshlangan bo'lsa — sanoq, jurnal, farq akti va yakunlash.
 * BE-17 da qabul bitta so'rov: sanoq shu qurilmada saqlanadi (`receivingDraft`) va yakunlashda yuboriladi.
 * Optovik kabinetisiz: arizani omborchi ham ochadi (arizasiz postavka).
 */
export default function WarehouseInboundPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery(PHONE);
  const today = tashkentDate();
  const [params, setParams] = useSearchParams();
  const scanRef = useRef<ScanFieldHandle>(null);
  const awaitingQuery = useAwaitingShipments();
  const doneQuery = useReceivedToday(today);
  const awaiting = awaitingQuery.items;
  const done = doneQuery.items;
  const [drafts, setDrafts] = useState(startedDrafts);
  const [undeclared, setUndeclared] = useState<UndeclaredPreset | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [listNote, setListNote] = useState<string | null>(null);
  const [listProblem, setListProblem] = useState<string | null>(null);
  const [firstCode, setFirstCode] = useState<string | null>(null);
  const [lastDone, setLastDone] = useState<string | null>(null);

  // Boshqa joyda qabul qilingan (yoki yo'qolgan) postavkaning qoralamasi brauzerdan o'chiriladi; ekranda — faqat kutilayotganlar.
  useEffect(() => {
    if (awaitingQuery.hasData) [...drafts.keys()].filter((id) => !awaiting.some((item) => item.id === id)).forEach(clearDraft);
  }, [awaiting, awaitingQuery.hasData, drafts]);

  // Joriy qabul: manzildagi yoki — sahifa ochilganda — shu qurilmada boshlangani (eng oxirgisi). Qabul yakunlangach
  // ro'yxatda qoladi (toast va «Bugun qabul qilingan»): boshqa boshlangan postavkaga o'zi o'tmaydi.
  const [resume, setResume] = useState(true);
  const requested = params.get('shipment');
  const inProgress = awaiting.filter((item) => drafts.has(item.id)).sort((a, b) => (drafts.get(b.id) ?? '').localeCompare(drafts.get(a.id) ?? ''))[0];
  const activeId = requested ?? (resume ? inProgress?.id : undefined) ?? null;
  const active = awaiting.find((item) => item.id === activeId) ?? null;
  const started = useMemo(() => new Set(awaiting.filter((item) => drafts.has(item.id)).map((item) => item.id)), [awaiting, drafts]);

  const focusScan = () => window.setTimeout(() => scanRef.current?.focus(), 0);

  const open = useCallback((shipment: InboundShipment, code: string | null = null) => {
    if (!drafts.has(shipment.id)) saveDraft(emptyDraft(shipment.id));
    setDrafts(startedDrafts());
    setFirstCode(code);
    setMatched([]);
    setListNote(null);
    setParams({ shipment: shipment.id }, { replace: true });
  }, [drafts, setParams]);

  /** Ro'yxat ko'rinishida skan: bitta mos postavka — qabul o'zi ochiladi; bir nechta — ro'yxatda belgilanadi. */
  const onListScan = (code: string) => {
    setListProblem(null);
    const matches = awaiting.filter((item) => item.items.some((line) => line.barcode === code));
    if (matches.length === 1) return open(matches[0], code);
    setListNote(null);
    if (matches.length > 1) {
      setMatched(matches.map((item) => item.id));
      setListNote(t('inb.recv.manyMatches', { count: matches.length }));
      return undefined;
    }
    setMatched([]);
    setListProblem(code);
    return undefined;
  };

  const onFinished = (shipment: InboundShipment) => {
    const key = `finished-${shipment.id}`;
    const time = shipment.receivedAt ? tashkentClock(Date.parse(shipment.receivedAt)) : tashkentClock();
    notification.success({
      key,
      title: t('inb.finish.done', { number: shipment.number }),
      description: shipment.status === 'RECEIVED' ? t('inb.finish.doneExact', { time }) : t('inb.finish.doneText', { time }),
      placement: phone ? 'top' : 'bottomRight',
      duration: 6,
      actions: <Button size="small" onClick={() => { notification.destroy(key); window.open(inboundActPath(shipment.id), '_blank', 'noopener'); }}>{t('inb.finish.openAct')}</Button>,
    });
    clearDraft(shipment.id);
    setDrafts(startedDrafts());
    setLastDone(shipment.id);
    setFirstCode(null);
    setResume(false);
    setParams({}, { replace: true });
  };

  const undeclaredDialog = (
    <UndeclaredDialog
      key={undeclared ? `${undeclared.wholesalerId ?? ''}-${undeclared.productId ?? ''}` : 'closed'}
      preset={undeclared}
      awaiting={awaiting}
      onClose={() => { setUndeclared(null); focusScan(); }}
      onStartExpected={(shipment) => { setUndeclared(null); open(shipment); }}
      onDeclared={() => { setUndeclared(null); focusScan(); }}
    />
  );

  if (awaitingQuery.isError && !awaitingQuery.hasData) return <LoadError error={awaitingQuery.error} onRetry={() => void awaitingQuery.refetch()} />;
  if (awaitingQuery.isPending) return <PageLoader compact />;

  if (active) {
    return (
      <>
        <ReceivingView
          key={active.id}
          shipment={active}
          phone={phone}
          today={today}
          awaiting={awaiting}
          done={done}
          started={started}
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
        problem={listProblem ? { code: listProblem, kind: 'UNKNOWN', productName: null, otherShipment: null } : null}
        onProblemClear={() => setListProblem(null)}
        message={listNote ? <p className={styles.listNote} role="status">{listNote}</p> : null}
      />
      <AwaitingView
        phone={phone}
        awaiting={awaiting}
        done={done}
        today={today}
        matched={matched}
        started={started}
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
  awaiting: readonly InboundShipment[];
  done: readonly InboundShipment[];
  started: ReadonlySet<string>;
  initialCode: string | null;
  scanRef: RefObject<ScanFieldHandle | null>;
  onOpen: (shipment: InboundShipment) => void;
  onUndeclared: () => void;
  onFinished: (shipment: InboundShipment) => void;
}

/** Qabul ochiq (ombor-qabul asosiy taxta): skan, sanoq, jurnal, farq akti, kutilayotganlar. */
function ReceivingView({ shipment, phone, today, awaiting, done, started, initialCode, scanRef, onOpen, onUndeclared, onFinished }: ReceivingViewProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const { online } = useOnlineStatus();
  const receive = useReceiveShipmentMutation();
  const stock = useWarehouseStockQuery();
  const [lotRequest, setLotRequest] = useState<LotRequest | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const focusScan = () => window.setTimeout(() => scanRef.current?.focus(), 0);
  const placement = phone ? 'top' as const : 'bottomRight' as const;
  const others = useMemo(() => awaiting.filter((item) => item.id !== shipment.id), [awaiting, shipment.id]);
  const receiving = useReceiving(shipment, { others, onLotRequired: (item, code) => setLotRequest({ item, code }) });

  // Ro'yxatdagi birinchi skan qabulni ochgan bo'lsa — o'sha skan shu postavkaga yoziladi.
  const firstScan = useRef(initialCode);
  useEffect(() => {
    if (firstScan.current) receiving.scan(firstScan.current);
    firstScan.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat birinchi chizishda
  }, []);

  // Yacheyka va «mavjud» — qoldiqdan (BE-17 `cell`); qoldiq yo'q yangi SKU da yacheyka yakunlashda so'raladi.
  const stockByVariant = useMemo(() => new Map((stock.data ?? []).map((row) => [row.variantId, row])), [stock.data]);
  const defaults = useMemo(() => Object.fromEntries(shipment.items.map((item) => [item.variantId, stockByVariant.get(item.variantId)?.cell ?? null])), [shipment.items, stockByVariant]);
  const items: ItemView[] = shipment.items.map((item) => ({
    item,
    counts: receiving.itemCounts(item),
    lot: receiving.lots[item.id] ?? null,
    cell: receiving.cellOf(item, defaults),
    cellKnown: Boolean(item.cell ?? defaults[item.variantId]),
  }));
  const blocked = items.filter((view) => view.lot && !isSellableExpiry(view.lot.expiryDate, today)).reduce((sum, view) => sum + view.counts.accepted, 0);
  const sellable = receiving.counts.accepted - blocked;
  const rows = shipment.items.map((item) => stockByVariant.get(item.variantId)).filter((row) => row !== undefined);
  const available = rows.length ? rows.reduce((sum, row) => sum + row.available, 0) : null;
  const undoCounts = receiving.lastCounted?.itemId ? items.find((view) => view.item.id === receiving.lastCounted?.itemId)?.counts ?? null : null;

  const openLot = (item: ShipmentItem) => setLotRequest({ item, code: null });

  // Javob keshni yangilaydi va bu ko'rinish yopiladi (postavka endi kutilmaydi) — `mutate` callbacki chaqirilmay qoladi;
  // va'da esa baribir bajariladi, natija sahifaga (`onFinished`) beriladi.
  const confirmFinish = () => {
    receive.mutateAsync({ id: shipment.id, ...receiving.payload(defaults) })
      .then((next) => {
        setFinishOpen(false);
        onFinished(next);
      })
      .catch((error: unknown) => notification.error({ title: t('inb.finish.error'), description: getApiErrorMessage(error), placement }));
  };

  const finishButton = (
    <button type="button" className={`${styles.primary} ${styles.barPrimary}`} disabled={!online} onClick={() => setFinishOpen(true)}>
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
          <ReceivingCard shipment={shipment} counts={receiving.counts} items={items} phone={phone} today={today} blocked={blocked} onLot={openLot} />
          <ActCard
            shipment={shipment}
            counts={receiving.counts}
            items={items}
            phone={phone}
            receiver={shortPersonName(user?.name ?? '')}
            today={today}
            note={receiving.note}
            onNoteChange={receiving.setNote}
            onFinish={() => setFinishOpen(true)}
            offline={!online}
          />
        </div>
        <div className={styles.aside}>
          <ScanJournal
            shipment={shipment}
            entries={receiving.journal}
            total={receiving.journalTotal}
            canUndo={receiving.lastCounted !== null}
            onUndo={() => setUndoOpen(true)}
          />
          <QueueCard current={shipment} awaiting={awaiting} done={done} started={started} today={today} onOpen={onOpen} onUndeclared={onUndeclared} />
        </div>
      </div>

      {/* Pastki panel sahifaning bevosita bolasi — ustunlar tartibiga (order) aralashmaydi. */}
      {phone ? <PageActionBar>{finishButton}</PageActionBar> : null}
      <LotDialog
        key={lotRequest ? `${lotRequest.item.id}-${lotRequest.code ?? ''}` : 'closed'}
        shipment={shipment}
        request={lotRequest}
        current={lotRequest ? receiving.lots[lotRequest.item.id] ?? null : null}
        today={today}
        onClose={() => { setLotRequest(null); focusScan(); }}
        onSaved={(item, lot, code) => { receiving.lotSaved(item, lot, code); setLotRequest(null); focusScan(); }}
      />
      <FindByNameDialog
        open={findOpen}
        shipment={shipment}
        mode={receiving.mode}
        onClose={() => { setFindOpen(false); focusScan(); }}
        onCount={(itemId) => { setFindOpen(false); receiving.countManual(itemId); focusScan(); }}
      />
      <UndoScanDialog
        shipment={shipment}
        scan={undoOpen ? receiving.lastCounted : null}
        counts={undoCounts}
        onClose={() => { setUndoOpen(false); focusScan(); }}
        onConfirm={() => {
          receiving.undoLast();
          setUndoOpen(false);
          notification.success({ title: t('inb.undo.done'), placement, duration: 3 });
          focusScan();
        }}
      />
      <FinishDialog
        open={finishOpen}
        shipment={shipment}
        counts={receiving.counts}
        items={items}
        available={available}
        sellable={sellable}
        note={receiving.note}
        onNoteChange={receiving.setNote}
        onCellChange={receiving.setCell}
        saving={receive.isPending}
        onClose={() => { setFinishOpen(false); focusScan(); }}
        onConfirm={confirmFinish}
      />
    </div>
  );
}
