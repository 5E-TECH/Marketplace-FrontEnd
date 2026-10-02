import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminShipments, getAdminWebhooks, reprovisionShop } from './adminDeliveryApi';
import type { AdminShipmentListParams, AdminWebhookListParams } from '../model/adminDeliveryTypes';

export const adminDeliveryKeys = {
  all: ['admin-delivery'] as const,
  shipments: (params: AdminShipmentListParams) => [...adminDeliveryKeys.all, 'shipments', params] as const,
  webhooks: (params: AdminWebhookListParams) => [...adminDeliveryKeys.all, 'webhooks', params] as const,
};

export const useAdminShipmentsQuery = (params: AdminShipmentListParams, enabled = true) => useQuery({
  queryKey: adminDeliveryKeys.shipments(params),
  queryFn: ({ signal }) => getAdminShipments(params, signal),
  placeholderData: (previous) => previous,
  enabled,
});

export const useAdminWebhooksQuery = (params: AdminWebhookListParams, enabled = true) => useQuery({
  queryKey: adminDeliveryKeys.webhooks(params),
  queryFn: ({ signal }) => getAdminWebhooks(params, signal),
  placeholderData: (previous) => previous,
  enabled,
});

export function useReprovisionShopMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: reprovisionShop,
    onSuccess: () => client.invalidateQueries({ queryKey: adminDeliveryKeys.all }),
  });
}
