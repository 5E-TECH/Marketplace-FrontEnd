import { unwrapApiData } from '../../../shared/api/apiResponse';
import { fetchFile, type FetchedFile } from '../../../shared/api/download';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import type { DeliveryMode, HandoverAct, ParcelElchiState, PickLine, PickList, PickTask, ScanResult, TaskStatus } from '../model/fulfillmentTypes';

/**
 * Ombor: yig'ish, qadoq, yorliq va Elchi'ga topshirish (FE-17) — BE-19 `warehouse/*` (ADMIN, WAREHOUSE, SUPERADMIN).
 * Taklif maydonlari — docs/api-taklif/fe-17-ombor-yigish.md; mock — `src/mocks/handlers/fulfillment.ts`.
 * Yo'llar chaqiruvda literal: `npm run contract:check` ularni tekshiradi.
 */
const TASK_STATUSES: readonly TaskStatus[] = ['TO_PICK', 'PICKED', 'PACKED', 'HANDED_OVER', 'CANCELLED'];
const ELCHI_STATES: readonly ParcelElchiState[] = ['PENDING', 'CREATED', 'FAILED', 'CANCELLED', 'CANCEL_FAILED'];

const textOrNull = (record: UnknownRecord, key: string) => readText(record, key) || null;
const numberOrNull = (record: UnknownRecord, key: string) => {
  const value = record[key];
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

function readLine(value: unknown): PickLine {
  const record = asRecord(value);
  return {
    productName: readText(record, 'productName'),
    sku: textOrNull(record, 'sku'),
    barcode: textOrNull(record, 'barcode'),
    quantity: readNumber(record, ['quantity']),
    pickedQty: readNumber(record, ['pickedQty']),
    cell: textOrNull(record, 'cell'),
    weightKg: numberOrNull(record, 'weightKg'),
  };
}

function readTask(value: unknown): PickTask {
  const record = asRecord(value);
  const status = TASK_STATUSES.find((item) => item === record.status);
  if (!readText(record, 'taskId') || !status) throw new Error('Yig‘ish vazifasi noto‘g‘ri formatda');
  const parcel = asRecord(record.parcel);
  // BE-34 dan oldingi javobda `lines` yo'q — birinchi qator eski maydonlardan.
  const lines = readItems(record.lines)?.map(readLine) ?? [readLine(record)];
  const mode: DeliveryMode | null = record.deliveryMode === 'DOOR' || record.deliveryMode === 'CENTER' ? record.deliveryMode : null;
  return {
    taskId: readText(record, 'taskId'),
    orderId: readText(record, 'orderId'),
    orderNumber: readText(record, 'orderNumber'),
    status,
    pickDate: readText(record, 'pickDate'),
    overdue: record.overdue === true,
    quantity: readNumber(record, ['quantity']),
    pickedQty: readNumber(record, ['pickedQty']),
    lines,
    parcel: {
      elchiState: ELCHI_STATES.find((item) => item === parcel.elchiState) ?? null,
      shipmentId: textOrNull(parcel, 'shipmentId'),
      labelReady: parcel.labelReady === true,
      error: textOrNull(parcel, 'error'),
      qrCodeToken: textOrNull(parcel, 'qrCodeToken'),
    },
    customerName: textOrNull(record, 'customerName'),
    regionName: textOrNull(record, 'regionName'),
    districtName: textOrNull(record, 'districtName'),
    deliveryMode: mode,
    codAmount: numberOrNull(record, 'codAmount'),
    confirmedAt: textOrNull(record, 'confirmedAt'),
    packedAt: textOrNull(record, 'packedAt'),
  };
}

/** OMB-4: kunlik yig'ish ro'yxati; `date` berilmasa — bugun. Oldingi kunlardan qolganlar ham (`overdue`). */
export async function getPickList(date: string | undefined, signal?: AbortSignal): Promise<PickList> {
  const { data } = await httpClient.get<unknown>('/warehouse/pick-list', { params: date ? { date } : {}, signal });
  const record = asRecord(unwrapApiData(data));
  const items = readItems(record, 'items');
  if (!items) throw new Error('Yig‘ish ro‘yxati noto‘g‘ri formatda');
  const counts = asRecord(record.counts);
  return {
    date: readText(record, 'date'),
    items: items.map(readTask),
    counts: {
      toPick: readNumber(counts, ['toPick']),
      picked: readNumber(counts, ['picked']),
      packed: readNumber(counts, ['packed']),
      overdue: readNumber(counts, ['overdue']),
    },
    truncated: record.truncated === true,
  };
}

/** OMB-2: tovar skani (shtrix-kod yoki SKU). Boshqa tovar — 409 `WRONG_ITEM` (FE-17 TC1). */
export async function scanTask({ taskId, code }: { taskId: string; code: string }): Promise<ScanResult> {
  const { data } = await httpClient.post<unknown>(`/warehouse/tasks/${encodeURIComponent(taskId)}/scan`, { code });
  const record = asRecord(unwrapApiData(data));
  return {
    taskId: readText(record, 'taskId'),
    orderId: readText(record, 'orderId'),
    status: TASK_STATUSES.find((item) => item === record.status) ?? 'TO_PICK',
    pickedQty: readNumber(record, ['pickedQty']),
    quantity: readNumber(record, ['quantity']),
  };
}

/** «Qadoqlandi» — hamma dona to'g'ri skanerlangandan keyin. */
export async function packTask(taskId: string): Promise<void> {
  await httpClient.post(`/warehouse/tasks/${encodeURIComponent(taskId)}/pack`);
}

/** Posilka yorlig'i PDF (100×60): Elchi trek raqami, QR, tasdiqlangan manzil (FE-17 TC2). */
export function fetchLabel(orderId: string, fallbackName: string): Promise<FetchedFile> {
  return fetchFile(`/warehouse/orders/${encodeURIComponent(orderId)}/label`, fallbackName);
}

function readAct(value: unknown): HandoverAct {
  const record = asRecord(unwrapApiData(value));
  if (!readText(record, 'id')) throw new Error('Topshirish akti noto‘g‘ri formatda');
  return {
    id: readText(record, 'id'),
    parcelCount: readNumber(record, ['parcelCount']),
    createdBy: readText(record, 'createdBy'),
    createdAt: readText(record, 'createdAt'),
    items: (readItems(record.items) ?? []).map((item) => {
      const row = asRecord(item);
      return {
        parcelId: readText(row, 'parcelId'),
        orderId: readText(row, 'orderId'),
        orderNumber: readText(row, 'orderNumber'),
        shipmentId: readText(row, 'shipmentId'),
        qrCodeToken: readText(row, 'qrCodeToken'),
      };
    }),
  };
}

/**
 * OMB-5: topshirish akti — skanerlangan QR lar bitta so'rovda; bittasi tayyor bo'lmasa butun akt rad (409, sabablar
 * xabarda). O'sha QR to'plami qayta yuborilsa — o'sha akt.
 */
export async function createHandoverAct(qrTokens: readonly string[]): Promise<HandoverAct> {
  const { data } = await httpClient.post<unknown>('/warehouse/handover-acts', { qrTokens });
  return readAct(data);
}

export async function getHandoverAct(id: string, signal?: AbortSignal): Promise<HandoverAct> {
  const { data } = await httpClient.get<unknown>(`/warehouse/handover-acts/${encodeURIComponent(id)}`, { signal });
  return readAct(data);
}

/** Taklif: oldingi aktlar (yangisi tepada). Backendda yo'q bo'lsa — bo'sh ro'yxat. */
export async function getHandoverActs(signal?: AbortSignal): Promise<HandoverAct[]> {
  const { data } = await httpClient.get<unknown>('/warehouse/handover-acts', { params: { page: 1, limit: 20 }, signal });
  return (readItems(unwrapApiData(data), 'items') ?? []).map(readAct);
}

/** Topshirish akti PDF (imzo uchun). */
export function fetchActPdf(id: string, fallbackName: string): Promise<FetchedFile> {
  return fetchFile(`/warehouse/handover-acts/${encodeURIComponent(id)}/pdf`, fallbackName);
}

