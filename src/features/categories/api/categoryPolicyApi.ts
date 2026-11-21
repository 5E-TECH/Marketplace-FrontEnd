import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../generated/api-types';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto } from '../../../shared/api/readDto';
import { asRecord, readItems, readText } from '../../../shared/api/responseFields';

type Schemas = components['schemas'];

/**
 * Narx sozlamasi darajalari (BE-09, TZ 2.4, NRX-8): global → kategoriya → mahsulot. Kategoriya javobi — «qatlam»:
 * `null` qiymat yuqori darajadan (globaldan) olinadi. Ko'rish — ADMIN va SUPERADMIN, o'zgartirish — SUPERADMIN.
 */
/** Sxemada son maydonlari `object` bo'lib chiqqan (`numeric` ustunlar satr bo'lib kelishi mumkin) — sonlarga o'tkaziladi. */
export interface PolicyValues {
  markupCapPercent: number | null;
  deliveryMode: NonNullable<Schemas['PricePolicyDto']['deliveryMode']> | null;
  visibleCenter: number | null;
  visibleAddress: number | null;
}

export type PolicyLayer = PolicyValues & { scope: string; scopeId: string | null; updatedBy: string | null; updatedAt: string | null };

const POLICY_KEYS = ['markupCapPercent', 'deliveryMode', 'visibleCenter', 'visibleAddress'] as const;
const numberOrNull = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);

function readLayer(value: unknown): PolicyLayer {
  const raw = readDto<Record<string, unknown>>(value, POLICY_KEYS);
  const mode = raw.deliveryMode;
  return {
    scope: typeof raw.scope === 'string' ? raw.scope : '',
    scopeId: typeof raw.scopeId === 'string' ? raw.scopeId : null,
    markupCapPercent: numberOrNull(raw.markupCapPercent),
    deliveryMode: mode === 'SEPARATE' || mode === 'PARTIAL' || mode === 'FREE' ? mode : null,
    visibleCenter: numberOrNull(raw.visibleCenter),
    visibleAddress: numberOrNull(raw.visibleAddress),
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
}

export async function getGlobalPolicy(signal?: AbortSignal): Promise<PolicyLayer> {
  const { data } = await httpClient.get<unknown>('/admin/pricing/policy', { signal });
  return readLayer(data);
}

export async function getCategoryPolicy(id: string, signal?: AbortSignal): Promise<PolicyLayer> {
  const { data } = await httpClient.get<unknown>(`/admin/pricing/policy/categories/${encodeURIComponent(id)}`, { signal });
  return readLayer(data);
}

const policyKey = ['admin', 'pricing', 'policy'] as const;

export const useGlobalPolicyQuery = () => useQuery({ queryKey: policyKey, queryFn: ({ signal }) => getGlobalPolicy(signal), staleTime: 5 * 60_000 });

/** Har kategoriya qatlami alohida so'rov (backendda ro'yxat endpointi yo'q; kategoriyalar soni kichik). */
export function useCategoryPoliciesQuery(ids: readonly string[]) {
  return useQueries({
    queries: ids.map((id) => ({ queryKey: [...policyKey, 'category', id], queryFn: ({ signal }: { signal: AbortSignal }) => getCategoryPolicy(id, signal), staleTime: 5 * 60_000 })),
    combine: (results) => new Map(ids.map((id, index) => [id, results[index]?.data] as const)),
  });
}

/** SUPERADMIN: kategoriya qatlamini saqlash (`null` — globaldan). Ro'yxat va narx hisobi qayta so'raladi. */
export function useSaveCategoryPolicyMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: PolicyValues }) => {
      await httpClient.put(`/admin/pricing/policy/categories/${encodeURIComponent(id)}`, values);
    },
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: policyKey }), client.invalidateQueries({ queryKey: ['admin', 'products'] })]),
  });
}

/** Elchi tarifi (NRX-7): amaldagisi — `effectiveFrom` o'tgan eng yangisi. Ko'rinadigan yetkazish undan oshmaydi. */
export interface ElchiTariff {
  center: number;
  address: number;
}

export async function getElchiTariff(signal?: AbortSignal): Promise<ElchiTariff | null> {
  const { data } = await httpClient.get<unknown>('/admin/pricing/elchi-tariffs', { signal });
  const rows = readItems(unwrapApiData(data)) ?? [];
  const now = Date.now();
  const current = rows.map(asRecord).find((row) => !(Date.parse(readText(row, 'effectiveFrom')) > now));
  const center = numberOrNull(current?.centerBase);
  const extra = numberOrNull(current?.addressExtra);
  return center === null || extra === null ? null : { center, address: center + extra };
}

export const useElchiTariffQuery = () => useQuery({ queryKey: [...policyKey, 'tariff'], queryFn: ({ signal }) => getElchiTariff(signal), staleTime: 30 * 60_000 });

/** Audit yozuvidagi bitta o'zgarish (`pricing.policy.update`, meta: before/after qatlamlari). */
export interface PolicyChange {
  key: (typeof POLICY_KEYS)[number];
  before: number | string | null;
  after: number | string | null;
}

export interface PolicyHistoryEntry {
  id: string;
  at: string;
  actorName: string;
  changes: PolicyChange[];
}

const policyValue = (layer: Record<string, unknown>, key: PolicyChange['key']) => (key === 'deliveryMode' ? (typeof layer[key] === 'string' ? layer[key] : null) : numberOrNull(layer[key]));

/**
 * Kategoriya parametrlari tarixi: backend `pricing.policy.update` audit yozuvi (entityType `PricePolicy`,
 * entityId — kategoriya, `meta.scope` — CATEGORY). Audit ro'yxati faqat `action` bo'yicha filtrlaydi —
 * kategoriya ekranda ajratiladi; eng yangisi birinchi.
 */
export async function getCategoryPolicyHistory(categoryId: string, signal?: AbortSignal): Promise<PolicyHistoryEntry[]> {
  const { data } = await httpClient.get<unknown>('/admin/audit', { params: { action: 'pricing.policy.update', page: 1, limit: 100 }, signal });
  const items = readItems(unwrapApiData(data), 'items') ?? [];
  return items.map(asRecord).flatMap((row) => {
    const meta = asRecord(row.meta);
    if (readText(row, 'entityId') !== categoryId || meta.scope !== 'CATEGORY') return [];
    const before = asRecord(meta.before);
    const after = asRecord(meta.after);
    const changes = POLICY_KEYS
      .map((key) => ({ key, before: policyValue(before, key), after: policyValue(after, key) }))
      .filter((change) => change.before !== change.after);
    const actor = readText(row, 'actorName') || readText(asRecord(row.actor), 'name');
    return changes.length ? [{ id: readText(row, 'id'), at: readText(row, 'createdAt'), actorName: actor || `#${readText(row, 'actorId')}`, changes }] : [];
  });
}

export const useCategoryPolicyHistoryQuery = (categoryId: string) => useQuery({
  queryKey: [...policyKey, 'history', categoryId],
  queryFn: ({ signal }) => getCategoryPolicyHistory(categoryId, signal),
  staleTime: 60_000,
});
