/**
 * Qabul qoralamasi (FE-16): BE-17 da skan API yo'q — qabul bitta so'rov bilan yakunlanadi. Shuning uchun sanoq,
 * jurnal, partiya, yacheyka va izoh shu qurilmaning brauzerida saqlanadi: sahifa yangilansa yoki aloqa uzilsa ham
 * yo'qolmaydi, «Qabulni yakunlash» da serverga yuboriladi va o'chiriladi.
 */
export type JournalKind = 'ACCEPTED' | 'DEFECT' | 'UNKNOWN' | 'FOREIGN' | 'DUPLICATE';

export interface JournalEntry {
  key: string;
  at: string;
  barcode: string;
  kind: JournalKind;
  /** Hisoblangan qator (ACCEPTED, DEFECT). */
  itemId: string | null;
  /** Hisobdan keyingi son: «Qabul 98», «Brak 2». */
  total: number | null;
  /** Hisoblangan yoki boshqa postavkadagi mahsulot nomi. */
  productName: string | null;
  /** FOREIGN: kod qaysi postavkaniki. */
  otherShipment: string | null;
}

export interface DraftLot {
  batch: string;
  expiryDate: string;
}

export interface ReceivingDraft {
  shipmentId: string;
  startedAt: string;
  /** Qator bo'yicha: yaroqli va brak. */
  counts: Record<string, { accepted: number; defect: number }>;
  lots: Record<string, DraftLot>;
  cells: Record<string, string>;
  note: string;
  /** Yangisi tepada; ko'rinadigan qismi cheklangan, `journalTotal` — hammasi. */
  journal: JournalEntry[];
  journalTotal: number;
}

const PREFIX = 'elchi.inbound.receiving.';
const JOURNAL_LIMIT = 200;
export const storageKey = (shipmentId: string) => `${PREFIX}${shipmentId}`;

export const emptyDraft = (shipmentId: string): ReceivingDraft => ({
  shipmentId, startedAt: new Date().toISOString(), counts: {}, lots: {}, cells: {}, note: '', journal: [], journalTotal: 0,
});

export function loadDraft(shipmentId: string): ReceivingDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(shipmentId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ReceivingDraft> | null;
    if (!value || value.shipmentId !== shipmentId || typeof value.startedAt !== 'string') return null;
    return {
      ...emptyDraft(shipmentId),
      ...value,
      journal: Array.isArray(value.journal) ? value.journal.slice(0, JOURNAL_LIMIT) : [],
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: ReceivingDraft) {
  try {
    window.localStorage.setItem(storageKey(draft.shipmentId), JSON.stringify({ ...draft, journal: draft.journal.slice(0, JOURNAL_LIMIT) }));
  } catch {
    // Saqlab bo'lmasa (xususiy rejim) sanoq faqat xotirada qoladi — sahifa yopilmasa yetarli.
  }
}

export function clearDraft(shipmentId: string) {
  try {
    window.localStorage.removeItem(storageKey(shipmentId));
  } catch {
    // e'tiborsiz
  }
}

/** Shu qurilmada boshlangan qabullar: postavka ID → boshlangan vaqt. */
export function startedDrafts(): Map<string, string> {
  const result = new Map<string, string>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      const draft = loadDraft(key.slice(PREFIX.length));
      if (draft) result.set(draft.shipmentId, draft.startedAt);
    }
  } catch {
    // e'tiborsiz
  }
  return result;
}
