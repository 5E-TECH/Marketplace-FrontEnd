import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import { SHIPMENT_STATUSES, type InboundShipment, type ShipmentListParams, type ShipmentStatus } from '../model/inboundTypes';
import {
  declareShipment,
  getInboundWholesalers,
  getLots,
  getShipment,
  getShipments,
  getWarehouseStock,
  getWholesalerProducts,
  receiveShipment,
  writeOffLot,
} from './inboundApi';

/** Kalitlar bitta joyda: e'lon va qabuldan keyin ro'yxatlar, tafsilot va qoldiq birga yangilanadi. */
export const inboundKeys = {
  all: ['inbound'] as const,
  lists: ['inbound', 'list'] as const,
  list: (params: ShipmentListParams) => ['inbound', 'list', params] as const,
  shipment: (id: string) => ['inbound', 'item', id] as const,
  wholesalers: ['inbound', 'wholesalers'] as const,
  products: (wholesalerId: string) => ['inbound', 'products', wholesalerId] as const,
  lots: ['inbound', 'lots'] as const,
};

/** Qoldiq (omborchi) — `adminInventoryKeys.all` ostida: qabul yakunlanganda birga yangilanadi. */
export const warehouseStockKey = ['admin-inventory', 'warehouse'] as const;

/** Ro'yxat jonli: admin e'lon qilsa, omborchi ro'yxatida 30 soniyada chiqadi. */
export function useShipmentsQuery(params: ShipmentListParams, enabled = true) {
  return useLiveQuery({ queryKey: inboundKeys.list(params), queryFn: ({ signal }) => getShipments(params, signal), placeholderData: keepPreviousData, enabled });
}

/** Holat tablari soni: backend bitta holat bilan filtrlaydi — har holatga bitta yengil so'rov (`limit=1`). */
export function useShipmentCounts(): Record<ShipmentStatus | 'ALL', number> | undefined {
  const declared = useShipmentsQuery({ page: 1, limit: 1, status: 'DECLARED' });
  const inTransit = useShipmentsQuery({ page: 1, limit: 1, status: 'IN_TRANSIT' });
  const received = useShipmentsQuery({ page: 1, limit: 1, status: 'RECEIVED' });
  const discrepancy = useShipmentsQuery({ page: 1, limit: 1, status: 'DISCREPANCY' });
  const totals = [declared.data?.total, inTransit.data?.total, received.data?.total, discrepancy.data?.total];
  if (totals.some((value) => value === undefined)) return undefined;
  const counts = { ALL: 0 } as Record<ShipmentStatus | 'ALL', number>;
  SHIPMENT_STATUSES.forEach((status, index) => {
    counts[status] = totals[index] ?? 0;
    counts.ALL += counts[status];
  });
  return counts;
}

const LIST_LIMIT = 100;

/** Ikki holatni bitta ro'yxatga: backend `status` ni bittadan qabul qiladi. */
function useShipmentsOf(statuses: readonly [ShipmentStatus, ShipmentStatus], wholesalerId?: string) {
  const first = useShipmentsQuery({ page: 1, limit: LIST_LIMIT, status: statuses[0], wholesalerId });
  const second = useShipmentsQuery({ page: 1, limit: LIST_LIMIT, status: statuses[1], wholesalerId });
  const items = useMemo(() => [...(first.data?.items ?? []), ...(second.data?.items ?? [])], [first.data, second.data]);
  return {
    items,
    isPending: first.isPending || second.isPending,
    isError: first.isError || second.isError,
    error: first.error ?? second.error,
    hasData: Boolean(first.data && second.data),
    refetch: () => Promise.all([first.refetch(), second.refetch()]),
  };
}

/** Kutilayotganlar (e'lon qilingan va yo'ldagi): kelish sanasi bo'yicha, eng yaqini tepada. */
export function useAwaitingShipments(wholesalerId?: string) {
  const result = useShipmentsOf(['DECLARED', 'IN_TRANSIT'], wholesalerId);
  const items = useMemo(
    () => [...result.items].sort((a, b) => a.expectedAt.localeCompare(b.expectedAt) || Number(a.id) - Number(b.id)),
    [result.items],
  );
  return { ...result, items };
}

/** «Bugun qabul qilingan»: qabul vaqti (Toshkent) bugun, oxirgisi tepada. */
export function useReceivedToday(today: string) {
  const result = useShipmentsOf(['RECEIVED', 'DISCREPANCY']);
  const items = useMemo(
    () => result.items
      .filter((item) => item.receivedAt && tashkentDate(Date.parse(item.receivedAt)) === today)
      .sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '')),
    [result.items, today],
  );
  return { ...result, items };
}

export function useShipmentQuery(id: string | undefined) {
  return useQuery({ queryKey: inboundKeys.shipment(id ?? ''), queryFn: ({ signal }) => getShipment(id ?? '', signal), enabled: Boolean(id) });
}

/** Optoviklar kamdan-kam o'zgaradi. */
export function useInboundWholesalersQuery(enabled = true) {
  return useQuery({ queryKey: inboundKeys.wholesalers, queryFn: ({ signal }) => getInboundWholesalers(signal), staleTime: 5 * 60_000, enabled });
}

export function useWholesalerProductsQuery(wholesalerId: string | null) {
  return useQuery({
    queryKey: inboundKeys.products(wholesalerId ?? ''),
    queryFn: ({ signal }) => getWholesalerProducts(wholesalerId ?? '', signal),
    enabled: Boolean(wholesalerId),
    staleTime: 60_000,
  });
}

/** Postavka o'zgarsa: tafsilot javobdan darhol, ro'yxatlar, mahsulot qoldig'i va partiyalar qayta so'raladi. */
function useShipmentSync() {
  const client = useQueryClient();
  return (shipment: InboundShipment) => {
    client.setQueryData(inboundKeys.shipment(shipment.id), shipment);
    return Promise.all([
      client.invalidateQueries({ queryKey: inboundKeys.lists }),
      client.invalidateQueries({ queryKey: ['inbound', 'products'] }),
      // Qoldiq (`adminInventoryKeys.all`) va mahsulot kartasidagi qoldiq.
      client.invalidateQueries({ queryKey: ['admin-inventory'] }),
      client.invalidateQueries({ queryKey: inboundKeys.lots }),
    ]);
  };
}

export function useDeclareShipmentMutation() {
  const sync = useShipmentSync();
  return useMutation({ mutationFn: declareShipment, onSuccess: sync });
}

export function useReceiveShipmentMutation() {
  const sync = useShipmentSync();
  return useMutation({ mutationFn: receiveShipment, onSuccess: sync });
}

export function useLotsQuery() {
  return useLiveQuery({ queryKey: inboundKeys.lots, queryFn: ({ signal }) => getLots(signal) });
}

export function useWarehouseStockQuery() {
  return useLiveQuery({ queryKey: warehouseStockKey, queryFn: ({ signal }) => getWarehouseStock({}, signal) });
}

export function useWriteOffLotMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: writeOffLot,
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: inboundKeys.lots }),
      client.invalidateQueries({ queryKey: ['admin-inventory'] }),
    ]),
  });
}
