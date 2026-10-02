import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readPagination, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import type {
  AdminCatalogWarning,
  AdminInventoryPage,
  AdminMovementListParams,
  AdminStockItem,
  AdminStockListParams,
  AdminStockMovement,
  AdminVariantInfo,
} from '../model/adminInventoryTypes';

const nullableText = (row: UnknownRecord, key: string) => readText(row, key) || null;

function parseVariantInfo(row: UnknownRecord): AdminVariantInfo {
  return {
    variantId: readText(row, 'variantId'),
    productName: nullableText(row, 'productName'),
    variantName: nullableText(row, 'variantName'),
    sku: nullableText(row, 'sku'),
    catalogMissing: row.catalogMissing === true,
  };
}

function parseStockItem(value: unknown): AdminStockItem {
  const row = asRecord(value);
  const shopId = readText(row, 'shopId');
  if (!shopId || !readText(row, 'variantId')) throw new Error('Qoldiq qatori noto‘g‘ri formatda');
  return {
    ...parseVariantInfo(row),
    shopId,
    warehouseId: readText(row, 'warehouseId'),
    warehouseName: readText(row, 'warehouseName'),
    // Eski backend maydonni bermasa ombor faol deb hisoblanadi (u faqat faollarni qaytarardi).
    warehouseActive: row.warehouseActive !== false,
    onHand: readNumber(row, ['onHand']),
    reserved: readNumber(row, ['reserved']),
    available: readNumber(row, ['available']),
    lowStockThreshold: readNumber(row, ['lowStockThreshold']),
  };
}

function parseMovement(value: unknown): AdminStockMovement {
  const row = asRecord(value);
  const id = readText(row, 'id');
  if (!id) throw new Error('Qoldiq harakati noto‘g‘ri formatda');
  return {
    ...parseVariantInfo(row),
    id,
    shopId: readText(row, 'shopId'),
    warehouseName: readText(row, 'warehouseName'),
    warehouseActive: row.warehouseActive !== false,
    type: readText(row, 'type'),
    quantity: readNumber(row, ['quantity']),
    onHandAfter: readNumber(row, ['onHandAfter']),
    reservedAfter: readNumber(row, ['reservedAfter']),
    referenceType: nullableText(row, 'referenceType'),
    referenceId: nullableText(row, 'referenceId'),
    reason: nullableText(row, 'reason'),
    createdAt: readText(row, 'createdAt'),
  };
}

function parseWarnings(record: UnknownRecord): AdminCatalogWarning[] {
  const list = Array.isArray(record.warnings) ? record.warnings : [];
  return list.map(asRecord).map((row) => ({ shopId: readText(row, 'shopId'), reason: readText(row, 'reason') })).filter((row) => row.shopId);
}

/** Yo‘llar chaqiruvda literal: `npm run contract:check` ularni OpenAPI bilan solishtiradi. */
function readPage<T>(data: unknown, params: { page: number; limit: number }, parse: (value: unknown) => T): AdminInventoryPage<T> {
  const value = unwrapApiData(data);
  const record = asRecord(value);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Qoldiq ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(parse);
  return {
    items,
    ...readPagination(record, { page: params.page, limit: params.limit, itemCount: items.length }),
    warnings: parseWarnings(record),
    searchTruncated: record.searchTruncated === true,
  };
}

export async function getAdminStock(params: AdminStockListParams, signal?: AbortSignal): Promise<AdminInventoryPage<AdminStockItem>> {
  const { data } = await httpClient.get<unknown>('/admin/inventory/stock', { params, signal });
  return readPage(data, params, parseStockItem);
}

export async function getAdminStockMovements(params: AdminMovementListParams, signal?: AbortSignal): Promise<AdminInventoryPage<AdminStockMovement>> {
  const { data } = await httpClient.get<unknown>('/admin/inventory/movements', { params, signal });
  return readPage(data, params, parseMovement);
}
