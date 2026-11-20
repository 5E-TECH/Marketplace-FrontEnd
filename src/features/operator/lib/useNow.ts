import { useSyncExternalStore } from 'react';

/**
 * Bitta umumiy soniya ticker'i: bron sanog'i, «23 daqiqadan keyin», eslatmalar.
 * Har komponent o'z `setInterval` ini ochmaydi — sahifada bitta taymer.
 */
let now = Date.now();
let timer: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => now;

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
