import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveAdminReturn,
  approveSellerReturn,
  getAdminReturn,
  getAdminReturns,
  getSellerReturn,
  getSellerReturns,
  refundAdminReturn,
  rejectAdminReturn,
  rejectSellerReturn,
  reviewSellerReturn,
} from './returnApi';
import type { AdminReturnListParams, ReturnRequestDetail, ReturnScope, SellerReturnListParams } from '../model/returnTypes';

const returnKeys = {
  all: (scope: ReturnScope) => ['returns', scope] as const,
  list: (scope: ReturnScope, params: SellerReturnListParams | AdminReturnListParams) => ['returns', scope, 'list', params] as const,
  detail: (scope: ReturnScope, id: string) => ['returns', scope, 'detail', id] as const,
};

export const useSellerReturnsQuery = (params: SellerReturnListParams) => useQuery({
  queryKey: returnKeys.list('seller', params),
  queryFn: ({ signal }) => getSellerReturns(params, signal),
  placeholderData: (previous) => previous,
});

export const useAdminReturnsQuery = (params: AdminReturnListParams) => useQuery({
  queryKey: returnKeys.list('admin', params),
  queryFn: ({ signal }) => getAdminReturns(params, signal),
  placeholderData: (previous) => previous,
});

export const useReturnQuery = (scope: ReturnScope, id: string | null) => useQuery({
  queryKey: returnKeys.detail(scope, id ?? ''),
  queryFn: ({ signal }) => (scope === 'admin' ? getAdminReturn : getSellerReturn)(id!, signal),
  enabled: Boolean(id),
});

/**
 * Amal javobi yangilangan so'rovni qaytaradi: detail darhol yangilanadi, ro'yxat qayta yuklanadi.
 * Xato bo'lsa (masalan, admin shu orada qarorni o'zgartirgan — 400) so'rov qayta olinadi:
 * panelda eskirgan holat va tugmalar qolmaydi.
 */
function useReturnActionMutation<Payload>(scope: ReturnScope, mutationFn: (payload: Payload) => Promise<ReturnRequestDetail>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (detail) => {
      client.setQueryData(returnKeys.detail(scope, detail.id), detail);
      await client.invalidateQueries({ queryKey: [...returnKeys.all(scope), 'list'] });
    },
    onError: () => client.invalidateQueries({ queryKey: returnKeys.all(scope) }),
  });
}

export const useReviewSellerReturnMutation = () => useReturnActionMutation('seller', reviewSellerReturn);
export const useApproveSellerReturnMutation = () => useReturnActionMutation('seller', approveSellerReturn);
export const useRejectSellerReturnMutation = () => useReturnActionMutation('seller', rejectSellerReturn);
export const useApproveAdminReturnMutation = () => useReturnActionMutation('admin', approveAdminReturn);
export const useRejectAdminReturnMutation = () => useReturnActionMutation('admin', rejectAdminReturn);
export const useRefundAdminReturnMutation = () => useReturnActionMutation('admin', refundAdminReturn);
