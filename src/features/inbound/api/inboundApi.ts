import { unwrapApiData } from '../../../shared/api/apiResponse';
import { downloadFile, type DownloadedFile } from '../../../shared/api/download';
import { httpClient } from '../../../shared/api/httpClient';
import { createIdempotencyKey } from '../../../shared/api/requestOptions';
import { asRecord, readItems, readNumber, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import {
  SHIPMENT_STATUSES,
  type DeclarePayload,
  type InboundProductOption,
  type InboundShipment,
  type InboundWholesaler,
  type ReceivePayload,
  type ShipmentAuthorRole,
  type ShipmentItem,
  type ShipmentListParams,
  type ShipmentPage,
  type ShipmentPerson,
  type StockLot,
  type WarehouseStockRow,
  type WriteOffPayload,
} from '../model/inboundTypes';

/**
 * Postavka e'loni va qabuli (FE-16): BE-17 (PR #132) `admin/inventory/shipments`, `admin/inventory/lots`,
 * `admin/inventory/adjust`; optoviklar va mahsulotlar — BE-07. Backend PR merge bo'lguncha yo'llar
 * `contract/pending-endpoints.json` da; taklif maydonlari — docs/api-taklif/fe-16-ombor.md. Mock —
 * `src/mocks/handlers/warehouse.ts`. Yo'llar chaqiruvda literal: `npm run contract:check` ularni tekshiradi.
 */
const textOrNull = (record: UnknownRecord, key: string) => readText(record, key) || null;
const numberOrZero = (record: UnknownRecord, key: string) => readNumber(record, [key]);

const AUTHOR_ROLES: readonly ShipmentAuthorRole[] = ['WHOLESALER', 'ADMIN', 'SUPERADMIN', 'WAREHOUSE'];

function readPerson(record: UnknownRecord, idKey: string, nameKey: string, roleKey?: string): ShipmentPerson | null {
  const id = readText(record, idKey);
  if (!id) return null;
  const role = roleKey ? AUTHOR_ROLES.find((item) => item === record[roleKey]) ?? null : null;
  return { id, name: textOrNull(record, nameKey), role };
}

function readItem(value: unknown): ShipmentItem {
  const record = asRecord(value);
  const received = numberOrZero(record, 'receivedQty');
  const defect = numberOrZero(record, 'defectiveQty');
  if (!readText(record, 'id') || !readText(record, 'variantId')) throw new Error('Postavka qatori noto‘g‘ri formatda');
  return {
    id: readText(record, 'id'),
    productId: readText(record, 'productId'),
    productName: readText(record, 'productName'),
    variantId: readText(record, 'variantId'),
    sku: readText(record, 'sku'),
    barcode: textOrNull(record, 'barcode'),
    declared: numberOrZero(record, 'declaredQty'),
    // BE-17: `receivedQty` — kelgan (brak bilan birga); UI da «qabul» — yaroqlisi.
    accepted: Math.max(0, received - defect),
    defect,
    batch: textOrNull(record, 'batch'),
    expiryDate: textOrNull(record, 'expiryDate'),
    cell: textOrNull(record, 'cell'),
    expiryTracked: record.expiryTracked === true,
  };
}

export function readShipment(value: unknown): InboundShipment {
  const record = asRecord(unwrapApiData(value));
  const status = SHIPMENT_STATUSES.find((item) => item === record.status);
  const declaredBy = readPerson(record, 'declaredBy', 'declaredByName', 'declaredByRole');
  if (!readText(record, 'id') || !status || !declaredBy) throw new Error('Postavka noto‘g‘ri formatda');
  const items = (readItems(record.items) ?? []).map(readItem);
  const sum = (key: 'declared' | 'accepted' | 'defect') => items.reduce((total, item) => total + item[key], 0);
  return {
    id: readText(record, 'id'),
    number: readText(record, 'number'),
    status,
    wholesaler: { id: readText(record, 'wholesalerId'), name: textOrNull(record, 'wholesalerName') },
    expectedAt: readText(record, 'expectedAt'),
    note: textOrNull(record, 'note'),
    createdAt: readText(record, 'createdAt'),
    declaredBy,
    receivedBy: readPerson(record, 'receivedBy', 'receivedByName'),
    receivedAt: textOrNull(record, 'receivedAt'),
    receiveComment: textOrNull(record, 'receiveComment'),
    items,
    declared: sum('declared'),
    accepted: sum('accepted'),
    defect: sum('defect'),
  };
}

/** Bo'sh filtrlar yuborilmaydi. Tartib — backendda: yangisi tepada. */
export async function getShipments(params: ShipmentListParams, signal?: AbortSignal): Promise<ShipmentPage> {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
  const { data } = await httpClient.get<unknown>('/admin/inventory/shipments', { params: query, signal });
  const record = asRecord(unwrapApiData(data));
  const rawItems = readItems(record, 'items');
  if (!rawItems) throw new Error('Postavkalar ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(readShipment);
  return { items, total: readNumber(record, ['total'], items.length), page: readNumber(record, ['page'], params.page), limit: readNumber(record, ['limit'], params.limit) };
}

export async function getShipment(id: string, signal?: AbortSignal): Promise<InboundShipment> {
  const { data } = await httpClient.get<unknown>(`/admin/inventory/shipments/${encodeURIComponent(id)}`, { signal });
  return readShipment(data);
}

/** OMB-1: optovik nomidan e'lon (omborchi, admin, superadmin) — bitta postavka, bir nechta mahsulot. */
export async function declareShipment(payload: DeclarePayload): Promise<InboundShipment> {
  const { data } = await httpClient.post<unknown>('/admin/inventory/shipments', payload);
  return readShipment(data);
}

/** OMB-1, OMB-3: qabul — faqat omborchi va superadmin; hamma qator bir so'rovda. Takroriy yuborish — o'sha natija. */
export async function receiveShipment({ id, ...payload }: ReceivePayload & { id: string }): Promise<InboundShipment> {
  const { data } = await httpClient.post<unknown>(`/admin/inventory/shipments/${encodeURIComponent(id)}/receive`, payload);
  return readShipment(data);
}

/** Qabul (farq va brak) akti PDF — server tuzadi; optovikka qo'lda yuboriladi. */
export function downloadShipmentAct(id: string, fallbackName: string): Promise<DownloadedFile> {
  return downloadFile(`/admin/inventory/shipments/${encodeURIComponent(id)}/act.pdf`, fallbackName);
}

const WHOLESALER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;

/** BE-07 `GET /admin/wholesalers`. Omborchi ham o'qishi kerak (arizasiz postavka) — taklif, §4. */
export async function getInboundWholesalers(signal?: AbortSignal): Promise<InboundWholesaler[]> {
  const { data } = await httpClient.get<unknown>('/admin/wholesalers', { params: { page: 1, limit: 100 }, signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Optoviklar ro‘yxati noto‘g‘ri formatda');
  return items.map((value) => {
    const record = asRecord(value);
    const contractNumber = textOrNull(record, 'contractNumber');
    const contractDate = textOrNull(record, 'contractDate');
    return {
      id: readText(record, 'id'),
      name: readText(record, 'name'),
      tin: textOrNull(record, 'tin'),
      status: WHOLESALER_STATUSES.find((item) => item === record.status) ?? 'PENDING',
      contractNumber,
      contractDate,
      contractSigned: Boolean(contractNumber && contractDate),
      hasCabinet: Boolean(readText(record, 'ownerUserId')),
    };
  });
}

const PRODUCT_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED', 'OUT_OF_STOCK'] as const;

/** Optovik mahsulotlari (BE-07 `GET /admin/products?shopId=`) va ularning qoldig'i. */
export async function getWholesalerProducts(wholesalerId: string, signal?: AbortSignal): Promise<InboundProductOption[]> {
  const [products, stock] = await Promise.all([
    httpClient.get<unknown>('/admin/products', { params: { shopId: wholesalerId, page: 1, limit: 100 }, signal }),
    getWarehouseStock({ shopId: wholesalerId }, signal),
  ]);
  const items = readItems(unwrapApiData(products.data), 'items');
  if (!items) throw new Error('Mahsulotlar ro‘yxati noto‘g‘ri formatda');
  return items.map((value) => {
    const record = asRecord(value);
    const productId = readText(record, 'id');
    const rows = stock.filter((row) => row.productId === productId);
    return {
      productId,
      name: readText(record, 'name'),
      status: PRODUCT_STATUSES.find((item) => item === record.status) ?? 'DRAFT',
      cpaEnabled: record.cpaEnabled === true,
      expiryTracked: record.expiryTracked === true || record.isBad === true,
      onHand: rows.reduce((sum, row) => sum + row.onHand, 0),
      available: rows.reduce((sum, row) => sum + row.available, 0),
    };
  });
}

/** OMB-3: partiyalar (eng yaqin sotuvdan chiqish tepada), faqat qoldig'i borlari. */
export async function getLots(signal?: AbortSignal): Promise<StockLot[]> {
  const { data } = await httpClient.get<unknown>('/admin/inventory/lots', { params: { state: 'ALL' }, signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Partiyalar ro‘yxati noto‘g‘ri formatda');
  return items.map((value) => {
    const record = asRecord(value);
    return {
      id: readText(record, 'id'),
      variantId: readText(record, 'variantId'),
      sku: readText(record, 'sku'),
      productName: readText(record, 'productName'),
      batch: textOrNull(record, 'batch'),
      expiryDate: readText(record, 'expiryDate'),
      sellableUntil: readText(record, 'sellableUntil'),
      quantity: readNumber(record, ['quantity']),
      blocked: record.blocked === true,
    };
  });
}

/** Partiyani hisobdan chiqarish: BE-16/BE-17 tuzatish (manfiy) — aniq partiya (`lotId`) bilan. */
export async function writeOffLot({ variantId, lotId, quantity, reason }: WriteOffPayload): Promise<void> {
  await httpClient.post('/admin/inventory/adjust', { variantId, lotId, delta: -quantity, reason, idempotencyKey: createIdempotencyKey() });
}

/** «Qoldiq → Ro'yxat» va e'lon formasi: BE-16 `GET /admin/inventory/stock` (omborchiga ham ochiq) + taklif maydonlari. */
export async function getWarehouseStock(params: { shopId?: string } = {}, signal?: AbortSignal): Promise<WarehouseStockRow[]> {
  const { data } = await httpClient.get<unknown>('/admin/inventory/stock', { params: { page: 1, limit: 100, ...params }, signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Qoldiq ro‘yxati noto‘g‘ri formatda');
  return items.map((value) => {
    const record = asRecord(value);
    return {
      variantId: readText(record, 'variantId'),
      productId: textOrNull(record, 'productId'),
      name: readText(record, 'productName') || readText(record, 'variantName') || readText(record, 'sku'),
      wholesalerId: textOrNull(record, 'shopId'),
      wholesalerName: textOrNull(record, 'shopName'),
      barcode: textOrNull(record, 'barcode'),
      cell: textOrNull(record, 'cell'),
      onHand: readNumber(record, ['onHand']),
      reserved: readNumber(record, ['reserved']),
      available: readNumber(record, ['available']),
      blocked: readNumber(record, ['blocked']),
      defect: readNumber(record, ['defect']),
      reservedToday: readNumber(record, ['reservedToday']),
      reservedTomorrow: readNumber(record, ['reservedTomorrow']),
    };
  });
}
