import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import type { ProductVariantPayload } from '../model/productTypes';

export async function createProductVariant(productId: string, payload: ProductVariantPayload): Promise<string> {
  const { data } = await httpClient.post<unknown>(`/products/${encodeURIComponent(productId)}/variants`, payload);
  const value = unwrapApiData(data);
  if (!value || typeof value !== 'object' || !('id' in value) || (typeof value.id !== 'string' && typeof value.id !== 'number')) {
    throw new Error('Yaratilgan variant IDsi olinmadi');
  }
  return String(value.id);
}

export async function updateProductVariant(productId: string, variantId: string, payload: ProductVariantPayload): Promise<void> {
  await httpClient.patch(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, payload);
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  await httpClient.delete(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`);
}
