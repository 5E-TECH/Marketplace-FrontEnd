import { useCallback, useSyncExternalStore } from 'react';

const remainingSeconds = (deadline: number | null) =>
  deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * `deadline` (ms) gacha qolgan soniyalar: «amal qiladi: 04:12», «Qayta urinishgacha 12:40».
 * Sahifa faqat soniya o'zgarganda qayta chiziladi; 0 da to'xtaydi.
 */
export function useCountdown(deadline: number | null): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (deadline === null) return () => undefined;
      const timer = window.setInterval(onChange, 250);
      return () => window.clearInterval(timer);
    },
    [deadline],
  );
  return useSyncExternalStore(subscribe, () => remainingSeconds(deadline), () => remainingSeconds(deadline));
}

/** 252 → «04:12». */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
