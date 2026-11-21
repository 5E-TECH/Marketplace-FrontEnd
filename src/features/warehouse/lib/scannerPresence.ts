import { useSyncExternalStore } from 'react';

/**
 * Sahifadagi skan maydoni holati — yuqori qatordagi «Skaner: tayyor» uchun (karkas-E 1.7, omborchi [taklif]).
 * Brauzer klaviatura emulyatsiyali skaner ulanganini bila olmaydi: «tayyor» — skan maydoni fokusda;
 * fokus yo'qolsa «Skaner: maydonga bosing». Maydon yo'q sahifada holat chiqmaydi.
 */
interface ScannerPresence {
  fields: number;
  focused: boolean;
}

let state: ScannerPresence = { fields: 0, focused: false };
const listeners = new Set<() => void>();

function publish(next: ScannerPresence) {
  if (next.fields === state.fields && next.focused === state.focused) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScannerPresence(): ScannerPresence {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Maydon chizilganda; qaytgan funksiya — olib tashlanganda. */
export function registerScanField(): () => void {
  publish({ ...state, fields: state.fields + 1 });
  return () => publish({ fields: Math.max(0, state.fields - 1), focused: state.fields > 1 && state.focused });
}

export function setScanFieldFocused(focused: boolean): void {
  publish({ ...state, focused });
}
