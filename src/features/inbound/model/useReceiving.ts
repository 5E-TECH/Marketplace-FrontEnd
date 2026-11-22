import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorMessage, isConnectionError } from '../../../shared/api/apiError';
import { createIdempotencyKey } from '../../../shared/api/requestOptions';
import { useOnlineStatus } from '../../../shared/lib/useOnlineStatus';
import { reportScanQueue } from '../../warehouse/lib/scanQueueStatus';
import { postScan } from '../api/inboundApi';
import { inboundKeys, useShipmentScansQuery } from '../api/inboundQueries';
import { isDuplicateRead, type ScanRead } from '../lib/scanRules';
import type { InboundProductOption, InboundShipment, ScanMode, ShipmentScan, ShipmentScanPage } from './inboundTypes';

/** Navbatdagi skan: serverga hali yetmagan (yuborilmoqda yoki aloqa yo'q). Brauzerda saqlanadi. */
export interface QueuedScan {
  key: string;
  barcode: string;
  mode: ScanMode;
  lotId?: string;
  at: string;
}

/** Jurnal qatori: serverdagi skan, navbatdagi yoki brauzerda tushib qolgan takror. */
export type JournalEntry =
  | { source: 'server'; scan: ShipmentScan }
  | { source: 'queued'; scan: QueuedScan; kind: 'COUNT' | 'UNKNOWN' | 'FOREIGN'; total: number | null; productName: string | null }
  | { source: 'duplicate'; key: string; at: string; barcode: string };

export type ScanProblem = { code: string; kind: 'UNKNOWN' | 'FOREIGN'; productName: string | null };

const RETRY_MS = 4_000;
const storageKey = (shipmentId: string) => `elchi.inbound.queue.${shipmentId}`;

function loadQueue(shipmentId: string): QueuedScan[] {
  try {
    const raw = window.localStorage.getItem(storageKey(shipmentId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedScan[]).filter((item) => item && typeof item.key === 'string' && typeof item.barcode === 'string') : [];
  } catch {
    return [];
  }
}

function saveQueue(shipmentId: string, queue: readonly QueuedScan[]) {
  try {
    if (queue.length) window.localStorage.setItem(storageKey(shipmentId), JSON.stringify(queue));
    else window.localStorage.removeItem(storageKey(shipmentId));
  } catch {
    // Saqlab bo'lmasa navbat faqat xotirada qoladi — sahifa yopilmasa yetarli.
  }
}

interface ReceivingOptions {
  /** Hamma SKU lar — kod boshqa mahsulotniki ekanini brauzerda bilish uchun (javobni kutmasdan). */
  catalog: readonly InboundProductOption[];
  /** Muddatli tovarda partiya yo'q — oyna ochiladi, skan partiya saqlangach yuboriladi. */
  onLotRequired: (code: string) => void;
  onError: (message: string) => void;
}

/**
 * Qabul jarayoni (ombor-qabul; FE-16 TC2, TC3; umumiy-aloqa-uzildi «Ombor — skan navbati»):
 * - takror o'qish (1 s ichida bir xil kod) tashlanadi va jurnalga «Takroriy skan» bo'lib yoziladi;
 * - kod mahsulotniki bo'lmasa — maydon qizil, ogohlantirish, jurnalda «Yozilmadi» (serverga ham yoziladi);
 * - skanlar navbat orqali ketma-ket yuboriladi (idempotencyKey): aloqa uzilsa sanoq brauzerda davom etadi,
 *   navbat `localStorage` da saqlanadi va aloqa tiklanganda o'zi yuboriladi;
 * - «Brak» faqat keyingi bitta skan uchun, keyin «Qabul»ga qaytadi.
 */
export function useReceiving(shipment: InboundShipment, { catalog, onLotRequired, onError }: ReceivingOptions) {
  const client = useQueryClient();
  const { online } = useOnlineStatus();
  const scansQuery = useShipmentScansQuery(shipment.id);
  const [mode, setMode] = useState<ScanMode>('ACCEPT');
  const [queue, setQueue] = useState<QueuedScan[]>(() => loadQueue(shipment.id));
  const [duplicates, setDuplicates] = useState<{ key: string; at: string; barcode: string }[]>([]);
  const [problem, setProblem] = useState<ScanProblem | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [lotId, setLotId] = useState<string | undefined>(() => shipment.lots.filter((lot) => lot.expiresAt).at(-1)?.id);
  const lastRead = useRef<ScanRead | null>(null);
  const sending = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => saveQueue(shipment.id, queue), [shipment.id, queue]);

  // Karkas banneri: navbat yuborilmayapti (aloqa yo'q yoki server javob bermayapti).
  const queueStalled = queue.length > 0 && (stalled || !online);
  useEffect(() => reportScanQueue(queue.length, queueStalled), [queue.length, queueStalled]);
  useEffect(() => () => reportScanQueue(0, false), []);

  const productOf = useCallback((code: string) => catalog.find((item) => item.barcode === code) ?? null, [catalog]);
  const ownCode = shipment.sku.barcode;

  const callbacks = useRef({ onError, onLotRequired });
  useEffect(() => {
    callbacks.current = { onError, onLotRequired };
  });

  /** Serverga ketma-ket: bitta so'rov bir vaqtda, muvaffaqiyatdan keyin keyingisi; aloqa tiklanganda (`online`) davom etadi. */
  useEffect(() => {
    const head = queue[0];
    if (!head || sending.current || !online) return;
    sending.current = true;
    postScan({ id: shipment.id, barcode: head.barcode, mode: head.mode, lotId: head.lotId, scannedAt: head.at, idempotencyKey: head.key })
      .then(({ scan, shipment: next }) => {
        sending.current = false;
        client.setQueryData(inboundKeys.shipment(next.id), next);
        client.setQueryData<ShipmentScanPage>(inboundKeys.scans(next.id), (page) => ({
          items: [scan, ...(page?.items ?? []).filter((item) => item.id !== scan.id)].slice(0, 50),
          total: (page?.total ?? 0) + 1,
        }));
        setStalled(false);
        setQueue((list) => list.filter((item) => item.key !== head.key));
      })
      .catch((error: unknown) => {
        sending.current = false;
        if (isConnectionError(error)) {
          setStalled(true);
          window.setTimeout(() => setRetryTick((tick) => tick + 1), RETRY_MS);
          return;
        }
        // Qayta yuborib bo'lmaydigan xato (qabul yakunlangan, partiya kerak): skan tashlanadi.
        setQueue((list) => list.filter((item) => item.key !== head.key));
        callbacks.current.onError(getApiErrorMessage(error));
      });
  }, [client, queue, online, retryTick, shipment.id]);

  const enqueue = useCallback((code: string, scanMode: ScanMode, lot?: string) => {
    setQueue((list) => [...list, { key: createIdempotencyKey(), barcode: code, mode: scanMode, lotId: lot, at: new Date().toISOString() }]);
  }, []);

  /** Skaner Enter bosdi (yoki qo'lda kiritildi). */
  const scan = useCallback((code: string) => {
    const read = { code, at: Date.now() };
    if (isDuplicateRead(lastRead.current, read)) {
      lastRead.current = read;
      setDuplicates((list) => [{ key: createIdempotencyKey(), at: new Date(read.at).toISOString(), barcode: code }, ...list]);
      setDuplicateNotice(code);
      setProblem(null);
      return;
    }
    lastRead.current = read;
    setDuplicateNotice(null);
    if (code !== ownCode) {
      const other = productOf(code);
      setProblem({ code, kind: other ? 'FOREIGN' : 'UNKNOWN', productName: other?.name ?? null });
      enqueue(code, mode);
      return;
    }
    setProblem(null);
    if (shipment.sku.expiryTracked && !lotId) {
      callbacks.current.onLotRequired(code);
      return;
    }
    enqueue(code, mode, shipment.sku.expiryTracked ? lotId : undefined);
    if (mode === 'DEFECT') setMode('ACCEPT');
  }, [enqueue, lotId, mode, ownCode, productOf, shipment.sku.expiryTracked]);

  /** «Nom bo'yicha topish»: kodi o'qilmagan tovar shu postavka mahsuloti — bitta dona joriy rejimda. */
  const countManual = useCallback(() => {
    if (!ownCode) return;
    setProblem(null);
    lastRead.current = null;
    if (shipment.sku.expiryTracked && !lotId) {
      callbacks.current.onLotRequired(ownCode);
      return;
    }
    enqueue(ownCode, mode, shipment.sku.expiryTracked ? lotId : undefined);
    if (mode === 'DEFECT') setMode('ACCEPT');
  }, [enqueue, lotId, mode, ownCode, shipment.sku.expiryTracked]);

  /** Partiya saqlandi: shu partiyaga yoziladi, kutib turgan birinchi skan yuboriladi. */
  const lotSaved = useCallback((id: string, pendingCode: string | null) => {
    setLotId(id);
    if (pendingCode) {
      enqueue(pendingCode, mode, id);
      if (mode === 'DEFECT') setMode('ACCEPT');
    }
  }, [enqueue, mode]);

  // Navbatdagi hisoblanadigan skanlar — sanoq kutmasdan davom etadi.
  const queuedCounts = useMemo(() => {
    let accepted = 0;
    let defect = 0;
    queue.forEach((item) => {
      if (item.barcode !== ownCode) return;
      if (item.mode === 'ACCEPT') accepted += 1;
      else defect += 1;
    });
    return { accepted, defect };
  }, [queue, ownCode]);

  const counts = { declared: shipment.declared, accepted: shipment.accepted + queuedCounts.accepted, defect: shipment.defect + queuedCounts.defect };

  const journal = useMemo<JournalEntry[]>(() => {
    // Navbatdagi har skan — server sonidan keyingi taxminiy natija («Qabul 98»).
    let accepted = shipment.accepted;
    let defect = shipment.defect;
    const queued: JournalEntry[] = [];
    for (const item of queue) {
      const other = item.barcode === ownCode ? null : productOf(item.barcode);
      const kind = item.barcode === ownCode ? 'COUNT' : other ? 'FOREIGN' : 'UNKNOWN';
      let total: number | null = null;
      if (kind === 'COUNT' && item.mode === 'ACCEPT') total = accepted += 1;
      else if (kind === 'COUNT') total = defect += 1;
      queued.push({ source: 'queued', scan: item, kind, total, productName: other?.name ?? null });
    }
    const server: JournalEntry[] = (scansQuery.data?.items ?? []).map((scan) => ({ source: 'server', scan }));
    const local: JournalEntry[] = duplicates.map((item) => ({ source: 'duplicate', ...item }));
    const at = (entry: JournalEntry) => (entry.source === 'duplicate' ? entry.at : entry.scan.at);
    return [...queued, ...local, ...server].sort((a, b) => at(b).localeCompare(at(a)));
  }, [duplicates, ownCode, productOf, queue, scansQuery.data, shipment.accepted, shipment.defect]);

  const lastCounted = queue.length ? null : scansQuery.data?.items.find((item) => item.result === 'ACCEPTED' || item.result === 'DEFECT') ?? null;

  return {
    mode,
    setMode,
    scan,
    countManual,
    counts,
    journal,
    journalTotal: (scansQuery.data?.total ?? 0) + duplicates.length + queue.length,
    queueSize: queue.length,
    /** Navbat yuborilmayapti (aloqa yo'q yoki server javob bermayapti). */
    stalled: queueStalled,
    problem,
    clearProblem: () => setProblem(null),
    duplicateNotice,
    lotId,
    lotSaved,
    lastCounted,
  };
}
