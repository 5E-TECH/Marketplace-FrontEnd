import { httpClient } from '../../../shared/api/httpClient';
import { parseProduct, parseProductPage } from '../../products/api/productApi';
import type { AdminProduct, AdminProductListParams, AdminProductPage } from '../model/adminProductTypes';

export async function getAdminProducts(
  params: AdminProductListParams,
  signal?: AbortSignal,
): Promise<AdminProductPage> {
  const { data } = await httpClient.get<unknown>('/admin/products', {
    signal,
    params: {
      page: params.page,
      limit: params.limit,
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.blocked === 'boolean' ? { blocked: params.blocked } : {}),
      ...(params.shopId ? { shopId: params.shopId } : {}),
    },
  });
  return parseProductPage(data, params);
}

export async function getAdminProduct(
  productId: string,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  const { data } = await httpClient.get<unknown>(
    `/admin/products/${encodeURIComponent(productId)}`,
    { signal },
  );
  return parseProduct(data);
}

export async function suspendAdminProduct(productId: string): Promise<void> {
  await httpClient.post(`/admin/products/${encodeURIComponent(productId)}/suspend`);
}

export async function reactivateAdminProduct(productId: string): Promise<void> {
  await httpClient.post(`/admin/products/${encodeURIComponent(productId)}/reactivate`);
}
