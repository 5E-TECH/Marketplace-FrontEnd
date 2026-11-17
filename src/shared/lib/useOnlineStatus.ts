import { useSyncExternalStore } from 'react';

/**
 * Brauzer internet holati va u oxirgi marta qachon o'zgargani («14:37 dan beri»).
 * Holat modul darajasida — bir nechta komponent bir xil vaqtni ko'radi.
 */
interface OnlineSnapshot {
  online: boolean;
  changedAt: number;
  /** Aloqa tiklangan vaqt (oflayndan keyin); hech uzilmagan bo'lsa `null`. */
  restoredAt: number | null;
}

let snapshot: OnlineSnapshot = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  changedAt: Date.now(),
  restoredAt: null,
};
const listeners = new Set<() => void>();

function update(online: boolean) {
  if (snapshot.online === online) return;
  const now = Date.now();
  snapshot = { online, changedAt: now, restoredAt: online ? now : snapshot.restoredAt };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };
}

function onOnline() {
  update(true);
}
function onOffline() {
  update(false);
}

export function useOnlineStatus(): OnlineSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
