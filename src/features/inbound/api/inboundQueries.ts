import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import type { InboundShipment, LotListParams, ShipmentListParams } from '../model/inboundTypes';
import {
  cancelShipment,
  completeShipment,
  createLot,
  declareShipments,
  getInboundWholesalers,
  getShipment,
  getShipmentScans,
  getLots,
  getShipments,
  getWarehouseStock,
  returnLot,
  startReceiving,
  undoScan,
  writeOffLot,
} from './inboundApi';

/** Kalitlar bitta joyda: e'lon, qabul va yakunlashdan keyin ro'yxatlar, tafsilot va qoldiq birga yangilanadi. */
export const inboundKeys = {
  all: ['inbound'] as const,
  lists: ['inbound', 'list'] as const,
  list: (params: ShipmentListParams) => ['inbound', 'list', params] as const,
  shipment: (id: string) => ['inbound', 'item', id] as const,
  scans: (id: string) => ['inbound', 'item', id, 'scans'] as const,
  wholesalers: ['inbound', 'wholesalers'] as const,
  lots: (params: LotListParams) => ['inbound', 'lots', params] as const,
};

/** Qoldiq (omborchi) — `adminInventoryKeys.all` ostida: qabul yakunlanganda birga yangilanadi. */
export const warehouseStockKey = ['admin-inventory', 'warehouse'] as const;

/** Ro'yxat jonli: admin e'lon qilsa, omborchi ro'yxatida 30 soniyada chiqadi (va aksincha — «hozir sanalmoqda»). */
export function useShipmentsQuery(params: ShipmentListParams) {
  return useLiveQuery({ queryKey: inboundKeys.list(params), queryFn: ({ signal }) => getShipments(params, signal), placeholderData: keepPreviousData });
}

export function useShipmentQuery(id: string | undefined) {
  return useQuery({ queryKey: inboundKeys.shipment(id ?? ''), queryFn: ({ signal }) => getShipment(id ?? '', signal), enabled: Boolean(id) });
}

export function useShipmentScansQuery(id: string | undefined) {
  return useQuery({ queryKey: inboundKeys.scans(id ?? ''), queryFn: ({ signal }) => getShipmentScans(id ?? '', signal), enabled: Boolean(id) });
}

/** Optoviklar va SKU lar kamdan-kam o'zgaradi. */
export function useInboundWholesalersQuery() {
  return useQuery({ queryKey: inboundKeys.wholesalers, queryFn: ({ signal }) => getInboundWholesalers(signal), staleTime: 5 * 60_000 });
}

/** Postavka o'zgarsa: tafsilot javobdan darhol, ro'yxatlar, optovik kartasi va qoldiq qayta so'raladi. */
export function useShipmentSync() {
  const client = useQueryClient();
  return (shipment: InboundShipment) => {
    client.setQueryData(inboundKeys.shipment(shipment.id), shipment);
    return Promise.all([
      client.invalidateQueries({ queryKey: inboundKeys.lists }),
      client.invalidateQueries({ queryKey: inboundKeys.wholesalers }),
      // Qoldiq (`adminInventoryKeys.all`) va mahsulot kartasidagi qoldiq.
      client.invalidateQueries({ queryKey: ['admin-inventory'] }),
      client.invalidateQueries({ queryKey: ['inbound', 'lots'] }),
    ]);
  };
}

function useShipmentMutation<T>(mutationFn: (value: T) => Promise<InboundShipment>) {
  const sync = useShipmentSync();
  return useMutation({ mutationFn, onSuccess: sync });
}

export const useCancelShipmentMutation = () => useShipmentMutation(cancelShipment);
export const useStartReceivingMutation = () => useShipmentMutation(startReceiving);
export const useCreateLotMutation = () => useShipmentMutation(createLot);
export const useCompleteShipmentMutation = () => useShipmentMutation(completeShipment);

export function useUndoScanMutation() {
  const client = useQueryClient();
  const sync = useShipmentSync();
  return useMutation({
    mutationFn: undoScan,
    onSuccess: (shipment) => Promise.all([sync(shipment), client.invalidateQueries({ queryKey: inboundKeys.scans(shipment.id) })]),
  });
}

export function useDeclareShipmentsMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: declareShipments,
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: inboundKeys.lists }),
      client.invalidateQueries({ queryKey: inboundKeys.wholesalers }),
    ]),
  });
}

export function useLotsQuery(params: LotListParams) {
  return useLiveQuery({ queryKey: inboundKeys.lots(params), queryFn: ({ signal }) => getLots(params, signal), placeholderData: keepPreviousData });
}

export function useWarehouseStockQuery() {
  return useLiveQuery({ queryKey: warehouseStockKey, queryFn: ({ signal }) => getWarehouseStock(signal) });
}

function useLotMutation<T>(mutationFn: (value: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['inbound', 'lots'] }),
      client.invalidateQueries({ queryKey: ['admin-inventory'] }),
    ]),
  });
}

export const useWriteOffLotMutation = () => useLotMutation(writeOffLot);
export const useReturnLotMutation = () => useLotMutation(returnLot);
