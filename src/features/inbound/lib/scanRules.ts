import type { InboundShipment } from '../model/inboundTypes';

/**
 * Skaner qoidalari (FE-16 TC3). Klaviatura emulyatsiyali skaner kodni yozib Enter bosadi; ba'zan bitta
 * tovarni ketma-ket ikki marta o'qiydi. Oldingi o'qishdan shu oraliqda kelgan bir xil kod — takror,
 * hisobga kirmaydi. Oraliq TZ'da yo'q (ombor-qabul.holatlar: «[soniya — TZ'da yo'q]») — taklif: 1 s.
 */
export const DUPLICATE_WINDOW_MS = 1_000;

export interface ScanRead {
  code: string;
  /** `Date.now()` — o'qilgan vaqt. */
  at: number;
}

/** Bo'sh joy va qator oxiri olib tashlanadi; kod o'zgarmaydi (harf ham bo'lishi mumkin). */
export const normalizeBarcode = (raw: string) => raw.replace(/\s+/g, '');

/** Takrormi: oldingi o'qish (takror bo'lsa ham) bilan bir xil kod va oraliq ichida — zanjir bitta hisoblanadi. */
export const isDuplicateRead = (previous: ScanRead | null, next: ScanRead) =>
  previous !== null && previous.code === next.code && next.at - previous.at < DUPLICATE_WINDOW_MS;

export interface ShipmentTally {
  /** Sanaldi: qabul + brak. */
  counted: number;
  /** Farq = qabul − e'lon (aktdagi «Farq»). */
  diff: number;
  /** E'londan kam sanalgan: hali topilmagan. */
  shortage: number;
  /** E'londan ortiq sanalgan. */
  surplus: number;
}

export function shipmentTally({ declared, accepted, defect }: Pick<InboundShipment, 'declared' | 'accepted' | 'defect'>): ShipmentTally {
  const counted = accepted + defect;
  return { counted, diff: accepted - declared, shortage: Math.max(0, declared - counted), surplus: Math.max(0, counted - declared) };
}
