/**
 * Ochiq topshirish akti (ombor-topshirish): BE-19 da akt bitta so'rov bilan tuziladi (`POST /warehouse/handover-acts`),
 * shuning uchun skanerlangan QR lar va jurnal shu qurilmaning brauzerida saqlanadi — sahifa yangilansa yoki aloqa
 * uzilsa ham yo'qolmaydi; «Aktni yakunlash» da serverga ketadi va o'chiriladi.
 */
export type HandoverScanKind = 'ADDED' | 'DUPLICATE' | 'NOT_PACKED' | 'PRODUCT_CODE' | 'UNKNOWN';

export interface HandoverScan {
  key: string;
  at: string;
  code: string;
  kind: HandoverScanKind;
  orderNumber: string | null;
  productName: string | null;
  /** ADDED: aktdagi o'rni; DUPLICATE: avval qo'shilgan vaqt. */
  position: number | null;
  firstAt: string | null;
}

export interface HandoverToken {
  token: string;
  /** Ro'yxatdan topilgan buyurtma (QR tokeni taklif maydoni kelsa); topilmasa — yakunlashda server tekshiradi. */
  orderId: string | null;
  at: string;
}

export interface HandoverDraft {
  startedAt: string;
  tokens: HandoverToken[];
  journal: HandoverScan[];
  journalTotal: number;
}

const KEY = 'elchi.handover.draft';
const JOURNAL_LIMIT = 100;

export const emptyHandoverDraft = (): HandoverDraft => ({ startedAt: new Date().toISOString(), tokens: [], journal: [], journalTotal: 0 });

export function loadHandoverDraft(): HandoverDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<HandoverDraft> | null;
    if (!value || typeof value.startedAt !== 'string' || !Array.isArray(value.tokens)) return null;
    return { ...emptyHandoverDraft(), ...value, journal: Array.isArray(value.journal) ? value.journal.slice(0, JOURNAL_LIMIT) : [] };
  } catch {
    return null;
  }
}

export function saveHandoverDraft(draft: HandoverDraft) {
  try {
    if (!draft.tokens.length && !draft.journal.length) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify({ ...draft, journal: draft.journal.slice(0, JOURNAL_LIMIT) }));
  } catch {
    // Saqlab bo'lmasa (xususiy rejim) — qoralama faqat xotirada.
  }
}

export function clearHandoverDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // e'tiborsiz
  }
}
