import { useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useId, useSyncExternalStore } from 'react';

/**
 * Jonli ma'lumot (FE-02): navbat, bronlar, statistika. Backendda hozircha SSE yo'q —
 * so'rov davriy qaytariladi (polling). Sahifa faqat `useLiveQuery` ni biladi: SSE
 * kelganda ichi almashtiriladi, sahifalar o'zgarmaydi.
 *
 * Har jonli so'rov holati umumiy ro'yxatda: biri ketma-ket yiqilsa, karkas «Ma’lumot
 * yangilanmayapti… Oxirgi yangilanish: 14:37 [Yangilash]» bannerini ko'rsatadi
 * (umumiy-aloqa-uzildi §1).
 */
export const LIVE_INTERVAL_MS = 30_000;

interface LiveEntry {
  failing: boolean;
  lastSuccessAt: number;
  refetch: () => void;
}

const entries = new Map<string, LiveEntry>();
const listeners = new Set<() => void>();
let summary: LiveSummary = { failing: false, lastSuccessAt: 0 };

export interface LiveSummary {
  /** Kamida bitta jonli so'rov ketma-ket yiqilmoqda. */
  failing: boolean;
  /** Yiqilganlar orasida eng eski muvaffaqiyatli yangilanish (ekrandagi ma'lumot shu vaqtniki). */
  lastSuccessAt: number;
}

function publish() {
  const failing = [...entries.values()].filter((entry) => entry.failing);
  const next: LiveSummary = {
    failing: failing.length > 0,
    lastSuccessAt: failing.length ? Math.min(...failing.map((entry) => entry.lastSuccessAt || Date.now())) : 0,
  };
  if (next.failing === summary.failing && next.lastSuccessAt === summary.lastSuccessAt) return;
  summary = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveSummary(): LiveSummary {
  return useSyncExternalStore(subscribe, () => summary, () => summary);
}

/** «Yangilash» — yiqilgan jonli so'rovlarni bir marta qayta so'raydi. */
export function refetchFailingLiveQueries(): void {
  entries.forEach((entry) => {
    if (entry.failing) entry.refetch();
  });
}

type LiveQueryOptions<T> = Omit<UseQueryOptions<T, Error, T, QueryKey>, 'refetchInterval'> & {
  /** Qayta so'rash oralig'i; sukut 30 s. */
  intervalMs?: number;
};

export function useLiveQuery<T>({ intervalMs = LIVE_INTERVAL_MS, ...options }: LiveQueryOptions<T>): UseQueryResult<T> {
  const id = useId();
  const query = useQuery({
    ...options,
    refetchInterval: intervalMs,
    // Fon tabda ham yangilanadi: operator boshqa oynada ishlasa ham bron va navbat eskirmasin.
    refetchIntervalInBackground: true,
  });

  // Ma'lumot bor, lekin oxirgi so'rov yiqildi — «jonli ulanish uzildi».
  const failing = query.isError && query.data !== undefined;
  const { dataUpdatedAt, refetch } = query;

  useEffect(() => {
    entries.set(id, { failing, lastSuccessAt: dataUpdatedAt, refetch: () => void refetch() });
    publish();
  }, [id, failing, dataUpdatedAt, refetch]);

  useEffect(() => () => {
    entries.delete(id);
    publish();
  }, [id]);

  return query;
}
