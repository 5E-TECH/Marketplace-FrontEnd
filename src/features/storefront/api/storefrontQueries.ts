import { useQuery } from '@tanstack/react-query';
import { getStorefrontProduct, getStorefrontShop } from './storefrontApi';
import type { StorefrontShopParams } from '../model/storefrontTypes';

const storefrontKeys = {
  all: ['storefront'] as const,
  shop: (slug: string, params: StorefrontShopParams) =>
    [...storefrontKeys.all, 'shop', slug, params] as const,
  product: (id: string) => [...storefrontKeys.all, 'product', id] as const,
};

export function useStorefrontShopQuery(slug: string, params: StorefrontShopParams) {
  return useQuery({
    queryKey: storefrontKeys.shop(slug, params),
    queryFn: ({ signal }) => getStorefrontShop(slug, params, signal),
    enabled: Boolean(slug),
    placeholderData: (previous) => previous,
  });
}

export function useStorefrontProductQuery(id: string) {
  return useQuery({
    queryKey: storefrontKeys.product(id),
    queryFn: ({ signal }) => getStorefrontProduct(id, signal),
    enabled: Boolean(id),
  });
}
