import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createIdempotencyKey } from '../../../shared/api/requestOptions';
import { isDuplicateRead, type ScanRead } from '../lib/scanRules';
import type { InboundShipment, ReceivePayload, ScanMode, ShipmentItem } from './inboundTypes';
import { emptyDraft, loadDraft, saveDraft, type DraftLot, type JournalEntry, type JournalKind, type ReceivingDraft } from './receivingDraft';

export type ScanProblem = { code: string; kind: 'UNKNOWN' | 'FOREIGN'; productName: string | null; otherShipment: string | null };

export interface ItemCounts {
  declared: number;
  accepted: number;
  defect: number;
}

interface ReceivingOptions {
  /** Boshqa kutilayotgan postavkalar — kod boshqa postavkaniki ekanini aytish uchun. */
  others: readonly InboundShipment[];
  /** Muddatli tovarda partiya yo'q — oyna ochiladi, kod partiya saqlangach hisoblanadi. */
  onLotRequired: (item: ShipmentItem, code: string | null) => void;
}

const entry = (kind: JournalKind, barcode: string, extra: Partial<JournalEntry> = {}): JournalEntry => ({
  key: createIdempotencyKey(), at: new Date().toISOString(), barcode, kind, itemId: null, total: null, productName: null, otherShipment: null, ...extra,
});

const log = (current: ReceivingDraft, item: JournalEntry): ReceivingDraft => ({ ...current, journal: [item, ...current.journal], journalTotal: current.journalTotal + 1 });

/**
 * Qabul jarayoni (ombor-qabul; FE-16 TC2, TC3). Sanoq brauzerda (BE-17 da skan API yo'q, qabul — bitta so'rov):
 * - takror o'qish (1 s ichida bir xil kod) tashlanadi va jurnalga «Takroriy skan» bo'lib yoziladi;
 * - kod postavkada yo'q — maydon qizil, ogohlantirish, jurnalda «Yozilmadi»; boshqa postavkaniki bo'lsa — aytiladi;
 * - «Brak» faqat keyingi bitta skan uchun, keyin «Qabul»ga qaytadi;
 * - hammasi qoralamada (`receivingDraft`): aloqa uzilsa ham sanoq davom etadi, yakunlashda yuboriladi.
 */
export function useReceiving(shipment: InboundShipment, { others, onLotRequired }: ReceivingOptions) {
  const [draft, setDraft] = useState<ReceivingDraft>(() => loadDraft(shipment.id) ?? emptyDraft(shipment.id));
  const [mode, setMode] = useState<ScanMode>('ACCEPT');
  const [problem, setProblem] = useState<ScanProblem | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const lastRead = useRef<ScanRead | null>(null);
  const lotRequired = useRef(onLotRequired);
  useEffect(() => {
    lotRequired.current = onLotRequired;
  });

  useEffect(() => saveDraft(draft), [draft]);

  const update = useCallback((change: (current: ReceivingDraft) => ReceivingDraft) => setDraft(change), []);

  const count = useCallback((item: ShipmentItem, scanMode: ScanMode, code: string) => {
    update((current) => {
      const previous = current.counts[item.id] ?? { accepted: 0, defect: 0 };
      const next = scanMode === 'ACCEPT' ? { ...previous, accepted: previous.accepted + 1 } : { ...previous, defect: previous.defect + 1 };
      return log({ ...current, counts: { ...current.counts, [item.id]: next } }, entry(scanMode === 'ACCEPT' ? 'ACCEPTED' : 'DEFECT', code, {
        itemId: item.id, productName: item.productName, total: scanMode === 'ACCEPT' ? next.accepted : next.defect,
      }));
    });
    if (scanMode === 'DEFECT') setMode('ACCEPT');
  }, [update]);

  /** Skaner Enter bosdi (yoki qo'lda kiritildi). */
  const scan = useCallback((code: string) => {
    const read = { code, at: Date.now() };
    if (isDuplicateRead(lastRead.current, read)) {
      lastRead.current = read;
      update((current) => log(current, entry('DUPLICATE', code)));
      setDuplicateNotice(code);
      setProblem(null);
      return;
    }
    lastRead.current = read;
    setDuplicateNotice(null);
    const item = shipment.items.find((row) => row.barcode === code);
    if (!item) {
      const other = others.flatMap((row) => row.items.map((line) => ({ shipment: row, line }))).find(({ line }) => line.barcode === code);
      const next: ScanProblem = { code, kind: other ? 'FOREIGN' : 'UNKNOWN', productName: other?.line.productName ?? null, otherShipment: other?.shipment.number ?? null };
      setProblem(next);
      update((current) => log(current, entry(next.kind, code, { productName: next.productName, otherShipment: next.otherShipment })));
      return;
    }
    setProblem(null);
    if (item.expiryTracked && !draft.lots[item.id]) {
      lotRequired.current(item, code);
      return;
    }
    count(item, mode, code);
  }, [count, draft.lots, mode, others, shipment.items, update]);

  /** «Nom bo'yicha topish»: kodi o'qilmagan tovar — tanlangan qatorga bitta dona joriy rejimda. */
  const countManual = useCallback((itemId: string) => {
    const item = shipment.items.find((row) => row.id === itemId);
    if (!item) return;
    setProblem(null);
    lastRead.current = null;
    if (item.expiryTracked && !draft.lots[item.id]) {
      lotRequired.current(item, item.barcode ?? '');
      return;
    }
    count(item, mode, item.barcode ?? '—');
  }, [count, draft.lots, mode, shipment.items]);

  /** Partiya saqlandi: kutib turgan kod shu qatorga hisoblanadi. */
  const lotSaved = useCallback((item: ShipmentItem, lot: DraftLot, pendingCode: string | null) => {
    update((current) => ({ ...current, lots: { ...current.lots, [item.id]: lot } }));
    if (pendingCode) count(item, mode, pendingCode);
  }, [count, mode, update]);

  /** Oxirgi hisoblangan skan (takror va noma'lumlar hisobga kirmagan). */
  const lastCounted = draft.journal.find((item) => item.kind === 'ACCEPTED' || item.kind === 'DEFECT') ?? null;

  const undoLast = useCallback(() => {
    update((current) => {
      const target = current.journal.find((item) => item.kind === 'ACCEPTED' || item.kind === 'DEFECT');
      if (!target?.itemId) return current;
      const previous = current.counts[target.itemId] ?? { accepted: 0, defect: 0 };
      const next = target.kind === 'ACCEPTED' ? { ...previous, accepted: Math.max(0, previous.accepted - 1) } : { ...previous, defect: Math.max(0, previous.defect - 1) };
      return { ...current, counts: { ...current.counts, [target.itemId]: next }, journal: current.journal.filter((item) => item.key !== target.key), journalTotal: Math.max(0, current.journalTotal - 1) };
    });
  }, [update]);

  const itemCounts = useCallback((item: ShipmentItem): ItemCounts => ({
    declared: item.declared, accepted: draft.counts[item.id]?.accepted ?? 0, defect: draft.counts[item.id]?.defect ?? 0,
  }), [draft.counts]);

  const counts = useMemo<ItemCounts>(() => shipment.items.reduce(
    (sum, item) => ({ declared: sum.declared + item.declared, accepted: sum.accepted + (draft.counts[item.id]?.accepted ?? 0), defect: sum.defect + (draft.counts[item.id]?.defect ?? 0) }),
    { declared: 0, accepted: 0, defect: 0 },
  ), [draft.counts, shipment.items]);

  /** Yacheyka: qoralamadagi yoki qoldiqdagi (`defaults`). */
  const cellOf = useCallback((item: ShipmentItem, defaults: Record<string, string | null>) => draft.cells[item.id] ?? item.cell ?? defaults[item.variantId] ?? '', [draft.cells]);

  /** BE-17 `receive`: har qator — kelgan (qabul + brak), brak, partiya, muddat, yacheyka. */
  const payload = useCallback((defaults: Record<string, string | null>): ReceivePayload => ({
    items: shipment.items.map((item) => {
      const value = draft.counts[item.id] ?? { accepted: 0, defect: 0 };
      const lot = draft.lots[item.id];
      return {
        itemId: item.id,
        receivedQty: value.accepted + value.defect,
        defectiveQty: value.defect,
        ...(lot ? { batch: lot.batch, expiryDate: lot.expiryDate } : {}),
        cell: cellOf(item, defaults).trim(),
      };
    }),
    comment: draft.note.trim() || undefined,
  }), [cellOf, draft.counts, draft.lots, draft.note, shipment.items]);

  return {
    mode,
    setMode,
    scan,
    countManual,
    counts,
    itemCounts,
    journal: draft.journal,
    journalTotal: draft.journalTotal,
    problem,
    clearProblem: () => setProblem(null),
    duplicateNotice,
    lots: draft.lots,
    lotSaved,
    lastCounted,
    undoLast,
    note: draft.note,
    setNote: (note: string) => update((current) => ({ ...current, note })),
    cellOf,
    setCell: (itemId: string, cell: string) => update((current) => ({ ...current, cells: { ...current.cells, [itemId]: cell } })),
    payload,
  };
}
