import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import { createHandoverAct, getHandoverAct, getHandoverActs, getPickList, packTask, scanTask } from './fulfillmentApi';

/** Kalitlar bitta joyda: skan, qadoq va akt — ro'yxat va qoldiq birga yangilanadi. */
export const fulfillmentKeys = {
  all: ['fulfillment'] as const,
  pickList: (date: string) => ['fulfillment', 'pick-list', date] as const,
  acts: ['fulfillment', 'acts'] as const,
  act: (id: string) => ['fulfillment', 'acts', id] as const,
};

/** Kunlik ro'yxat jonli: operator tasdiqlagan buyurtma 30 soniyada omborchiga chiqadi. */
export function usePickListQuery(date: string) {
  return useLiveQuery({ queryKey: fulfillmentKeys.pickList(date), queryFn: ({ signal }) => getPickList(date, signal), placeholderData: keepPreviousData });
}

function useFulfillmentRefresh() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: fulfillmentKeys.all }),
    // Qadoq va topshirish qoldiqqa ta'sir qiladi (band → chiqim).
    client.invalidateQueries({ queryKey: ['admin-inventory'] }),
  ]);
}

export function useScanTaskMutation() {
  const refresh = useFulfillmentRefresh();
  return useMutation({ mutationFn: scanTask, onSettled: refresh });
}

export function usePackTaskMutation() {
  const refresh = useFulfillmentRefresh();
  return useMutation({ mutationFn: packTask, onSuccess: refresh });
}

export function useCreateHandoverActMutation() {
  const refresh = useFulfillmentRefresh();
  return useMutation({ mutationFn: createHandoverAct, onSuccess: refresh });
}

export function useHandoverActQuery(id: string | null) {
  return useQuery({ queryKey: fulfillmentKeys.act(id ?? ''), queryFn: ({ signal }) => getHandoverAct(id ?? '', signal), enabled: Boolean(id) });
}

/** Taklif endpoint: yo'q bo'lsa (404) — jadval ko'rsatilmaydi, qayta urinilmaydi. */
export function useHandoverActsQuery() {
  return useQuery({ queryKey: fulfillmentKeys.acts, queryFn: ({ signal }) => getHandoverActs(signal), retry: false });
}
