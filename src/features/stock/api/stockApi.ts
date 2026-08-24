import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { StockAdjustPayload, StockInboundPayload, StockItem, StockListParams, StockPage } from '../model/stockTypes';

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Stock ${key} maydoni noto‘g‘ri`);
  return value;
}

function parseItem(value: unknown): StockItem {
  if (typeof value !== 'object' || value === null) throw new Error('Stock elementi noto‘g‘ri formatda');
  const item = value as Record<string, unknown>;
  for (const key of ['variantId', 'productName', 'sku', 'warehouseId', 'warehouseName']) {
    if (typeof item[key] !== 'string') throw new Error(`Stock ${key} maydoni mavjud emas`);
  }
  return {
    variantId: item.variantId as string,
    productName: item.productName as string,
    variantName: typeof item.variantName === 'string' ? item.variantName : null,
    sku: item.sku as string,
    warehouseId: item.warehouseId as string,
    warehouseName: item.warehouseName as string,
    onHand: numberField(item, 'onHand'),
    reserved: numberField(item, 'reserved'),
    available: numberField(item, 'available'),
    lowStockThreshold: numberField(item, 'lowStockThreshold'),
  };
}

export async function getStock(params: StockListParams, signal?: AbortSignal): Promise<StockPage> {
  const { data } = await httpClient.get<unknown>('/inventory/stock', { signal, params: { page: params.page, limit: params.limit, ...(params.search ? { search: params.search } : {}), ...(params.lowOnly ? { lowOnly: true } : {}) } });
  const value = unwrapApiData(data);
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) throw new Error('Stock ro‘yxati noto‘g‘ri formatda');
  const record = value as Record<string, unknown>;
  return { items: value.items.map(parseItem), total: numberField(record, 'total'), page: numberField(record, 'page'), limit: numberField(record, 'limit'), totalPages: numberField(record, 'totalPages') };
}

export async function inboundStock(payload: StockInboundPayload): Promise<void> {
  await httpClient.post('/inventory/stock/inbound', payload);
}

export async function adjustStock(payload: StockAdjustPayload): Promise<void> {
  await httpClient.post('/inventory/stock/adjust', payload);
}
