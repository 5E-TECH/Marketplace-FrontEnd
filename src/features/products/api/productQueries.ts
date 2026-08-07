import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductUpsertPayload } from '../model/productTypes';
import type { Product } from '../model/productTypes';
import { createProduct, deleteProduct, getMyProducts, getProduct, updateProduct } from './productApi';

export const productKeys = {
  all: ['products'] as const,
  mine: () => [...productKeys.all, 'my'] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

export function useMyProductsQuery() {
  return useQuery({
    queryKey: productKeys.mine(),
    queryFn: ({ signal }) => getMyProducts(signal),
  });
}

export function useProductQuery(id?: string) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getProduct(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: productKeys.mine() });
    },
  });
}

export function useUpdateProductMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductUpsertPayload) => updateProduct(id, payload),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: productKeys.mine() });
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Product[]>(productKeys.mine(), (products = []) =>
        products.filter((product) => product.id !== id),
      );
      queryClient.removeQueries({ queryKey: productKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: productKeys.mine() });
    },
  });
}
