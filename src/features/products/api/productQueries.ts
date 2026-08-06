import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../shared/api/queryClient';
import type { ProductUpsertPayload } from '../model/productTypes';
import { createProduct, deleteProduct, getMyProducts, getProduct, updateProduct } from './productApi';

export const productKeys = {
  all: ['products'] as const,
  mine: () => [...productKeys.all, 'my'] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

export function useMyProductsQuery() {
  return useQuery({ queryKey: productKeys.mine(), queryFn: getMyProducts });
}

export function useProductQuery(id?: string) {
  return useQuery({ queryKey: productKeys.detail(id ?? ''), queryFn: () => getProduct(id as string), enabled: Boolean(id) });
}

export function useCreateProductMutation() {
  return useMutation({
    mutationFn: createProduct,
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: productKeys.mine() });
    },
  });
}

export function useUpdateProductMutation(id: string) {
  return useMutation({
    mutationFn: (payload: ProductUpsertPayload) => updateProduct(id, payload),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: productKeys.mine() });
    },
  });
}

export function useDeleteProductMutation() {
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: productKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: productKeys.mine() });
    },
  });
}
