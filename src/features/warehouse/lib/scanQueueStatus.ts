import { useSyncExternalStore } from 'react';

/**
 * Skan navbati holati karkas banneri uchun (umumiy-aloqa-uzildi «Ombor — skan navbati»): navbat bo'sh bo'lmasa va
 * yuborilmayotgan bo'lsa — internet banneri o'rniga «3 ta skan yuborilmadi»; navbat bo'shagach 4 soniya
 * «Aloqa tiklandi. Navbatdagi 3 ta skan yuborildi».
 */
export interface ScanQueueStatus {
  queued: number;
  stalled: boolean;
  /** Oxirgi marta to'xtab qolgan navbat yuborib bo'lingan vaqt va soni. */
  flushed: { count: number; at: number } | null;
}

let state: ScanQueueStatus = { queued: 0, stalled: false, flushed: null };
let stalledMax = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScanQueueStatus(): ScanQueueStatus {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Qabul sahifasi navbat o'zgarganda chaqiradi; sahifa yopilganda — `{ queued: 0, stalled: false }`. */
export function reportScanQueue(queued: number, stalled: boolean): void {
  if (stalled) stalledMax = Math.max(stalledMax, queued);
  let flushed = state.flushed;
  if (queued === 0 && stalledMax > 0) {
    flushed = { count: stalledMax, at: Date.now() };
    stalledMax = 0;
  }
  if (queued === state.queued && stalled === state.stalled && flushed === state.flushed) return;
  state = { queued, stalled, flushed };
  listeners.forEach((listener) => listener());
}
