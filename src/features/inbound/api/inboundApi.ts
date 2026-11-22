import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readPagination, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import {
  SHIPMENT_STATUSES,
  type CompletePayload,
  type DeclareShipmentsPayload,
  type InboundProductOption,
  type InboundShipment,
  type InboundSku,
  type InboundWholesaler,
  type LotListParams,
  type LotPayload,
  type LotsOverview,
  type StockLot,
  type WarehouseStockRow,
  type WriteOffPayload,
  type ScanPayload,
  type ScanResponse,
  type ShipmentActor,
  type ShipmentLot,
  type ShipmentListParams,
  type ShipmentPage,
  type ShipmentScan,
  type ShipmentScanPage,
} from '../model/inboundTypes';

/**
 * Postavka e'loni va qabuli (FE-16). Endpointlar backendda hali yo'q — BE-17 (taklif:
 * docs/api-taklif/fe-16-ombor.md, `contract/pending-endpoints.json`); mock — `src/mocks/handlers/warehouse.ts`.
 * Yo'llar chaqiruvda literal: `npm run contract:check` ularni OpenAPI va pending ro'yxati bilan solishtiradi.
 */
const textOrNull = (record: UnknownRecord, key: string) => readText(record, key) || null;

const AUTHOR_ROLES = ['WHOLESALER', 'ADMIN', 'SUPERADMIN', 'WAREHOUSE'] as const;

function readActor(value: unknown): ShipmentActor | null {
  const record = asRecord(value);
  const name = readText(record, 'name');
  const role = AUTHOR_ROLES.find((item) => item === record.role);
  return name && role ? { name, role } : null;
}

function readSku(value: unknown): InboundSku {
  const record = asRecord(value);
  const variantId = readText(record, 'variantId');
  if (!variantId) throw new Error('Postavka mahsuloti noto‘g‘ri formatda');
  return {
    productId: readText(record, 'productId'),
    variantId,
    name: readText(record, 'name'),
    barcode: textOrNull(record, 'barcode'),
    expiryTracked: record.expiryTracked === true,
    categoryName: textOrNull(record, 'categoryName'),
    cell: textOrNull(record, 'cell'),
  };
}

function readLot(value: unknown): ShipmentLot {
  const record = asRecord(value);
  return {
    id: readText(record, 'id'),
    number: readText(record, 'number'),
    expiresAt: textOrNull(record, 'expiresAt'),
    quantity: readNumber(record, ['quantity']),
    sellable: record.sellable !== false,
  };
}

export function readShipment(value: unknown): InboundShipment {
  const record = asRecord(unwrapApiData(value));
  const status = SHIPMENT_STATUSES.find((item) => item === record.status);
  const createdBy = readActor(record.createdBy);
  const wholesaler = asRecord(record.wholesaler);
  if (!readText(record, 'id') || !status || !createdBy || !readText(wholesaler, 'id')) throw new Error('Postavka noto‘g‘ri formatda');
  return {
    id: readText(record, 'id'),
    number: readText(record, 'number'),
    status,
    wholesaler: { id: readText(wholesaler, 'id'), name: readText(wholesaler, 'name'), tin: textOrNull(wholesaler, 'tin') },
    sku: readSku(record.sku),
    declared: readNumber(record, ['declared']),
    accepted: readNumber(record, ['accepted']),
    defect: readNumber(record, ['defect']),
    expectedAt: readText(record, 'expectedAt'),
    note: textOrNull(record, 'note'),
    waybillNumber: textOrNull(record, 'waybillNumber'),
    createdAt: readText(record, 'createdAt'),
    createdBy,
    inTransitAt: textOrNull(record, 'inTransitAt'),
    receivingStartedAt: textOrNull(record, 'receivingStartedAt'),
    completedAt: textOrNull(record, 'completedAt'),
    completedBy: readActor(record.completedBy),
    actNote: textOrNull(record, 'actNote'),
    cancelledAt: textOrNull(record, 'cancelledAt'),
    cancelReason: textOrNull(record, 'cancelReason'),
    lots: (readItems(record.lots) ?? []).map(readLot),
  };
}

function readCounts(value: unknown, fallback: number): ShipmentPage['counts'] {
  const record = asRecord(value);
  const counts = { ALL: readNumber(record, ['ALL'], fallback) } as ShipmentPage['counts'];
  SHIPMENT_STATUSES.forEach((status) => { counts[status] = readNumber(record, [status]); });
  return counts;
}

function readScan(value: unknown): ShipmentScan {
  const record = asRecord(value);
  const result = (['ACCEPTED', 'DEFECT', 'UNKNOWN', 'FOREIGN'] as const).find((item) => item === record.result);
  if (!readText(record, 'id') || !result) throw new Error('Skan noto‘g‘ri formatda');
  return {
    id: readText(record, 'id'),
    at: readText(record, 'at'),
    barcode: readText(record, 'barcode'),
    mode: record.mode === 'DEFECT' ? 'DEFECT' : 'ACCEPT',
    result,
    total: typeof record.total === 'number' ? record.total : null,
    productName: textOrNull(record, 'productName'),
    lotNumber: textOrNull(record, 'lotNumber'),
  };
}

function readProductOption(value: unknown): InboundProductOption {
  const record = asRecord(value);
  const statuses = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED', 'OUT_OF_STOCK'] as const;
  return {
    ...readSku(record),
    status: statuses.find((item) => item === record.status) ?? 'DRAFT',
    reviewSince: textOrNull(record, 'reviewSince'),
    onHand: readNumber(record, ['onHand']),
    available: readNumber(record, ['available']),
  };
}

function readWholesaler(value: unknown): InboundWholesaler {
  const record = asRecord(value);
  const statuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
  const cabinet = record.cabinet && typeof record.cabinet === 'object' ? asRecord(record.cabinet) : null;
  const awaiting = asRecord(record.awaiting);
  if (!readText(record, 'id')) throw new Error('Optovik noto‘g‘ri formatda');
  return {
    id: readText(record, 'id'),
    name: readText(record, 'name'),
    tin: textOrNull(record, 'tin'),
    status: statuses.find((item) => item === record.status) ?? 'PENDING',
    contractSigned: record.contractSigned === true,
    contractNumber: textOrNull(record, 'contractNumber'),
    contractDate: textOrNull(record, 'contractDate'),
    cabinet: cabinet ? { lastSeenAt: textOrNull(cabinet, 'lastSeenAt') } : null,
    onHand: readNumber(record, ['onHand']),
    awaiting: { shipments: readNumber(awaiting, ['shipments']), quantity: readNumber(awaiting, ['quantity']) },
    products: (readItems(record.products) ?? []).map(readProductOption),
  };
}

/** `status` vergul bilan (`DECLARED,IN_TRANSIT`); bo'sh filtrlar yuborilmaydi. */
function listQuery({ status, ...rest }: ShipmentListParams) {
  const query: Record<string, string | number> = {};
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query[key] = value;
  });
  if (status?.length) query.status = status.join(',');
  return query;
}

export async function getShipments(params: ShipmentListParams, signal?: AbortSignal): Promise<ShipmentPage> {
  const { data } = await httpClient.get<unknown>('/warehouse/inbound-shipments', { params: listQuery(params), signal });
  const value = unwrapApiData(data);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Postavkalar ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(readShipment);
  const record = asRecord(value);
  return { items, ...readPagination(record, { page: params.page, limit: params.limit, itemCount: items.length }), counts: readCounts(record.counts, items.length) };
}

export async function getShipment(id: string, signal?: AbortSignal): Promise<InboundShipment> {
  const { data } = await httpClient.get<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}`, { signal });
  return readShipment(data);
}

/** Har mahsulot qatori — alohida postavka; javob — yaratilganlar. */
export async function declareShipments(payload: DeclareShipmentsPayload): Promise<InboundShipment[]> {
  const { data } = await httpClient.post<unknown>('/warehouse/inbound-shipments', payload);
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Postavka javobi noto‘g‘ri formatda');
  return items.map(readShipment);
}

export async function cancelShipment({ id, reason }: { id: string; reason: string }): Promise<InboundShipment> {
  const { data } = await httpClient.post<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/cancel`, { reason });
  return readShipment(data);
}

export async function startReceiving(id: string): Promise<InboundShipment> {
  const { data } = await httpClient.post<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/receiving`);
  return readShipment(data);
}

export async function getShipmentScans(id: string, signal?: AbortSignal): Promise<ShipmentScanPage> {
  const { data } = await httpClient.get<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/scans`, { signal });
  const value = unwrapApiData(data);
  const items = readItems(value, 'items');
  if (!items) throw new Error('Skan jurnali noto‘g‘ri formatda');
  return { items: items.map(readScan), total: readNumber(asRecord(value), ['total'], items.length) };
}

export async function postScan({ id, ...payload }: ScanPayload & { id: string }): Promise<ScanResponse> {
  const { data } = await httpClient.post<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/scans`, payload);
  const record = asRecord(unwrapApiData(data));
  return { scan: readScan(record.scan), shipment: readShipment(record.shipment) };
}

/** Faqat oxirgi hisoblangan skan; javob — yangilangan postavka. */
export async function undoScan({ id, scanId }: { id: string; scanId: string }): Promise<InboundShipment> {
  const { data } = await httpClient.delete<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/scans/${encodeURIComponent(scanId)}`);
  return readShipment(data);
}

export async function createLot({ id, ...payload }: LotPayload & { id: string }): Promise<InboundShipment> {
  const { data } = await httpClient.post<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/lots`, payload);
  return readShipment(data);
}

export async function completeShipment({ id, ...payload }: CompletePayload & { id: string }): Promise<InboundShipment> {
  const { data } = await httpClient.post<unknown>(`/warehouse/inbound-shipments/${encodeURIComponent(id)}/complete`, payload);
  return readShipment(data);
}

/** Optoviklar va ularning SKU lari: e'lon formasi, arizasiz postavka va skan bo'yicha mahsulot topish. */
export async function getInboundWholesalers(signal?: AbortSignal): Promise<InboundWholesaler[]> {
  const { data } = await httpClient.get<unknown>('/warehouse/wholesalers', { signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Optoviklar ro‘yxati noto‘g‘ri formatda');
  return items.map(readWholesaler);
}

const LOT_STATES = ['ON_SALE', 'APPROACHING', 'BLOCKED', 'EXPIRED', 'RETURNING', 'WRITTEN_OFF'] as const;

function readStockLot(value: unknown): StockLot {
  const record = asRecord(value);
  const state = LOT_STATES.find((item) => item === record.state);
  const wholesaler = asRecord(record.wholesaler);
  if (!readText(record, 'id') || !state) throw new Error('Partiya noto‘g‘ri formatda');
  return {
    id: readText(record, 'id'),
    number: readText(record, 'number'),
    state,
    quantity: readNumber(record, ['quantity']),
    expiresAt: readText(record, 'expiresAt'),
    sku: readSku(record.sku),
    wholesaler: { id: readText(wholesaler, 'id'), name: readText(wholesaler, 'name'), tin: textOrNull(wholesaler, 'tin') },
    sharesCellWith: textOrNull(record, 'sharesCellWith'),
    notifiedAt: textOrNull(record, 'notifiedAt'),
  };
}

/** «Qoldiq → Muddat»: partiyalar (eng yaqin muddat tepada), tab sonlari, qoidalar, muddatsiz SKU lar. */
export async function getLots(params: LotListParams, signal?: AbortSignal): Promise<LotsOverview> {
  const query: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value) query[key] = String(value);
  });
  const { data } = await httpClient.get<unknown>('/warehouse/lots', { params: query, signal });
  const record = asRecord(unwrapApiData(data));
  const items = readItems(record, 'items');
  if (!items) throw new Error('Partiyalar ro‘yxati noto‘g‘ri formatda');
  const counts = asRecord(record.counts);
  const rules = asRecord(record.rules);
  return {
    items: items.map(readStockLot),
    counts: { ALL: readNumber(counts, ['ALL'], items.length), APPROACHING: readNumber(counts, ['APPROACHING']), BLOCKED: readNumber(counts, ['BLOCKED']), EXPIRED: readNumber(counts, ['EXPIRED']) },
    rules: { minShelfDays: readNumber(rules, ['minShelfDays'], 60), notifyDays: typeof rules.notifyDays === 'number' ? rules.notifyDays : null },
    untracked: (readItems(record.untracked) ?? []).map((item) => ({ variantId: readText(asRecord(item), 'variantId'), name: readText(asRecord(item), 'name') })),
  };
}

export async function writeOffLot({ id, ...payload }: WriteOffPayload & { id: string }): Promise<StockLot> {
  const { data } = await httpClient.post<unknown>(`/warehouse/lots/${encodeURIComponent(id)}/write-off`, payload);
  return readStockLot(unwrapApiData(data));
}

export async function returnLot({ id, quantity, note }: { id: string; quantity: number; note?: string }): Promise<StockLot> {
  const { data } = await httpClient.post<unknown>(`/warehouse/lots/${encodeURIComponent(id)}/return`, { quantity, note });
  return readStockLot(unwrapApiData(data));
}

/** «Qoldiq → Ro'yxat»: BE-16 `GET /admin/inventory/stock` (omborchiga ham ochiq) + taklif maydonlari. */
export async function getWarehouseStock(signal?: AbortSignal): Promise<WarehouseStockRow[]> {
  const { data } = await httpClient.get<unknown>('/admin/inventory/stock', { params: { page: 1, limit: 100 }, signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Qoldiq ro‘yxati noto‘g‘ri formatda');
  return items.map((value) => {
    const record = asRecord(value);
    return {
      variantId: readText(record, 'variantId'),
      name: readText(record, 'productName') || readText(record, 'variantName') || readText(record, 'sku'),
      wholesalerName: textOrNull(record, 'shopName'),
      barcode: textOrNull(record, 'barcode'),
      cell: textOrNull(record, 'cell'),
      onHand: readNumber(record, ['onHand']),
      reserved: readNumber(record, ['reserved']),
      available: readNumber(record, ['available']),
      defect: readNumber(record, ['defect']),
      reservedToday: readNumber(record, ['reservedToday']),
      reservedTomorrow: readNumber(record, ['reservedTomorrow']),
      lots: (readItems(record.lots) ?? []).map((lot) => {
        const item = asRecord(lot);
        return { number: readText(item, 'number'), expiresAt: textOrNull(item, 'expiresAt'), sellable: item.sellable !== false };
      }),
    };
  });
}
