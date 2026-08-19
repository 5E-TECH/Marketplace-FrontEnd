import { httpClient } from '../../../shared/api/httpClient';
import type { ProductVariantPayload } from '../model/productTypes';

export async function createProductVariant(productId: string, payload: ProductVariantPayload): Promise<void> {
  await httpClient.post(`/products/${encodeURIComponent(productId)}/variants`, payload);
}

export async function updateProductVariant(productId: string, variantId: string, payload: ProductVariantPayload): Promise<void> {
  await httpClient.patch(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, payload);
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  await httpClient.delete(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`);
}
