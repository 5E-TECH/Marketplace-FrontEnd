import { http } from 'msw';
import { daysLeft, isSellableExpiry, MIN_SHELF_DAYS } from '../../features/inbound/lib/expiry';
import {
  AWAITING_STATUSES,
  SHIPMENT_STATUSES,
  type InboundShipment,
  type LotState,
  type ScanMode,
  type StockLot,
  type ShipmentActor,
  type ShipmentAuthorRole,
  type ShipmentScan,
  type ShipmentStatus,
} from '../../features/inbound/model/inboundTypes';
import { db } from '../db';
import type { MockInbound, MockSku } from '../fixtures/inbound';

type MockLotAction = MockInbound['lotActions'][string];
import { API, fail, ok, pageOf, tashkentDate } from '../utils';
import { currentMockUser } from './auth';

/**
 * Ombor: postavka e'loni va qabuli (FE-16). Backendda BE-17 da quriladi — qoidalar taklifdagidek
 * (docs/api-taklif/fe-16-ombor.md): e'lonni admin yoki omborchi optovik nomidan ochadi (shartnoma va
 * tasdiqlangan mahsulot shart), qabul skan bilan (takror — idempotencyKey), muddatli tovarda partiya,
 * yakunlashda qoldiqqa faqat qabul qilingan son, 60 kundan kam qolgan partiya «mavjud»ga qo'shilmaydi.
 */
const STAFF_ROLES = ['ADMIN', 'SUPERADMIN', 'WAREHOUSE'];

function guard(request: Request, cookies: Record<string, string>): { denied: Response; actor?: undefined } | { denied: null; actor: ShipmentActor } {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan') };
  if (!STAFF_ROLES.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim ombor va admin uchun') };
  return { denied: null, actor: { name: user.name, role: user.role as ShipmentAuthorRole } };
}

const inbound = () => db.inbound;
const findShipment = (id: unknown) => inbound().shipments.find((item) => item.id === String(id));
const skuByBarcode = (barcode: string) => inbound().skus.find((item) => item.barcode === barcode);
const skuByVariant = (variantId: string) => inbound().skus.find((item) => item.variantId === variantId);
const isCompleted = (shipment: InboundShipment) => shipment.completedAt !== null;
const now = () => new Date().toISOString();

function counts(items: readonly InboundShipment[]) {
  const result = { ALL: items.length } as Record<ShipmentStatus | 'ALL', number>;
  SHIPMENT_STATUSES.forEach((status) => { result[status] = items.filter((item) => item.status === status).length; });
  return result;
}

function listFilter(url: URL) {
  const params = url.searchParams;
  const search = params.get('search')?.trim().toLowerCase() ?? '';
  return (item: InboundShipment) =>
    (!params.get('wholesalerId') || item.wholesaler.id === params.get('wholesalerId')) &&
    (!params.get('authorRole') || (params.get('authorRole') === 'WHOLESALER') === (item.createdBy.role === 'WHOLESALER')) &&
    (!params.get('expectedFrom') || item.expectedAt >= String(params.get('expectedFrom'))) &&
    (!params.get('expectedTo') || item.expectedAt <= String(params.get('expectedTo'))) &&
    (!params.get('completedOn') || (item.completedAt !== null && tashkentDate(Date.parse(item.completedAt)) === params.get('completedOn'))) &&
    (!search || [item.number, item.sku.name, item.sku.barcode ?? '', item.wholesaler.name].some((value) => value.toLowerCase().includes(search)));
}

const SORTS: Record<string, (a: InboundShipment, b: InboundShipment) => number> = {
  '-createdAt': (a, b) => b.createdAt.localeCompare(a.createdAt),
  expectedAt: (a, b) => a.expectedAt.localeCompare(b.expectedAt) || a.createdAt.localeCompare(b.createdAt),
  '-completedAt': (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
};

/** Optovik kartasi va forma uchun: SKU lar, ombordagi son va kutilayotgan postavkalar. */
function wholesalerView(id: string) {
  const data = inbound();
  const wholesaler = data.wholesalers.find((item) => item.id === id);
  if (!wholesaler) return null;
  const skus = data.skus.filter((item) => item.wholesalerId === id);
  const awaiting = data.shipments.filter((item) => item.wholesaler.id === id && AWAITING_STATUSES.includes(item.status));
  return {
    id: wholesaler.id, name: wholesaler.name, tin: wholesaler.tin, status: wholesaler.status, contractSigned: wholesaler.contractSigned,
    contractNumber: wholesaler.contractNumber, contractDate: wholesaler.contractDate,
    cabinet: wholesaler.cabinetSeenMinutesAgo === null ? null : { lastSeenAt: new Date(Date.now() - wholesaler.cabinetSeenMinutesAgo * 60_000).toISOString() },
    onHand: skus.reduce((sum, item) => sum + item.onHand, 0),
    awaiting: { shipments: awaiting.length, quantity: awaiting.reduce((sum, item) => sum + item.declared, 0) },
    products: skus.map((item) => ({
      productId: item.productId, variantId: item.variantId, name: item.name, barcode: item.barcode, expiryTracked: item.expiryTracked,
      categoryName: item.categoryName, cell: item.cell, status: item.status, reviewSince: item.reviewSince,
      onHand: item.onHand, available: Math.max(0, item.onHand - item.reserved - item.blocked),
    })),
  };
}

function nextNumber() {
  return Math.max(0, ...inbound().shipments.map((item) => Number(item.id))) + 1;
}

function journal(shipment: InboundShipment) {
  return (inbound().scans[shipment.id] ??= []);
}

/** Bir xil idempotencyKey — saqlangan javob (tarmoq uzilib, qayta yuborilgan so'rov ikki marta yozilmaydi). */
function replay(key: unknown) {
  return typeof key === 'string' && key ? inbound().replies.get(key) : undefined;
}

function remember<T>(key: unknown, value: T): T {
  if (typeof key === 'string' && key) inbound().replies.set(key, value);
  return value;
}

/** Yakunlash: qoldiqqa faqat qabul qilingan; brak alohida; muddati yaqin partiya «mavjud»ga qo'shilmaydi. */
function settleStock(shipment: InboundShipment) {
  const target = skuByVariant(shipment.sku.variantId);
  if (!target) return;
  target.onHand += shipment.accepted;
  target.defect += shipment.defect;
  target.blocked += shipment.lots.filter((lot) => !lot.sellable).reduce((sum, lot) => sum + lot.quantity, 0);
}


/** Ombordagi partiyalar: yakunlangan muddatli postavkalardan; holat — bugungi sanaga ko'ra va amallardan. */
function stockLots(): StockLot[] {
  const today = tashkentDate();
  const data = inbound();
  const lots: StockLot[] = [];
  data.shipments.filter((item) => item.completedAt && item.sku.expiryTracked).forEach((shipment) => {
    shipment.lots.filter((lot) => lot.expiresAt && lot.quantity > 0).forEach((lot) => {
      const expiresAt = lot.expiresAt ?? today;
      const action = data.lotActions[lot.id] as MockLotAction | undefined;
      const left = daysLeft(expiresAt, today);
      const state: LotState = action?.state ?? (left < 0 ? 'EXPIRED' : left < MIN_SHELF_DAYS ? 'BLOCKED' : 'ON_SALE');
      lots.push({
        id: lot.id, number: lot.number, state, quantity: action ? lot.quantity - (action.state === 'WRITTEN_OFF' ? action.quantity : 0) : lot.quantity, expiresAt,
        sku: shipment.sku, wholesaler: shipment.wholesaler, sharesCellWith: null,
        notifiedAt: state === 'ON_SALE' ? null : shipment.completedAt,
      });
    });
  });
  // Bir yacheykada (SKU yacheykasi) sotuvdagi va sotuvdan chiqarilgan partiya — ogohlantirish uchun.
  lots.forEach((lot) => {
    if (lot.state !== 'BLOCKED') return;
    const neighbour = lots.find((other) => other.sku.variantId === lot.sku.variantId && other.state === 'ON_SALE');
    lot.sharesCellWith = neighbour?.number ?? null;
  });
  return lots.filter((lot) => lot.quantity > 0 && lot.state !== 'WRITTEN_OFF').sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/** `GET /admin/inventory/stock` — omborchi ko'rinishi (BE-16 + taklif maydonlari). */
export function warehouseStockRows() {
  const data = inbound();
  return data.skus.filter((item) => item.onHand > 0 || item.defect > 0).map((item) => {
    const wholesaler = data.wholesalers.find((entry) => entry.id === item.wholesalerId);
    const done = data.shipments.filter((shipment) => shipment.completedAt && shipment.sku.variantId === item.variantId)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    const lots = item.expiryTracked
      ? stockLots().filter((lot) => lot.sku.variantId === item.variantId).map((lot) => ({ number: lot.number, expiresAt: lot.expiresAt, sellable: lot.state === 'ON_SALE' }))
      : done.slice(0, 2).reverse().map((shipment) => ({ number: shipment.number, expiresAt: null, sellable: true }));
    return {
      shopId: item.wholesalerId, shopName: wholesaler?.name ?? null, warehouseId: '1', warehouseName: 'Toshkent ombori', warehouseActive: true,
      variantId: item.variantId, productName: item.name, variantName: null, sku: item.barcode, catalogMissing: false,
      barcode: item.barcode, cell: item.cell, onHand: item.onHand, reserved: item.reserved,
      available: Math.max(0, item.onHand - item.reserved - item.blocked), defect: item.defect, lowStockThreshold: 5,
      reservedToday: item.reserved - item.reservedTomorrow, reservedTomorrow: item.reservedTomorrow, lots,
    };
  });
}

export const warehouseHandlers = [
  http.get(`${API}/warehouse/wholesalers`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok({ items: inbound().wholesalers.map((item) => wholesalerView(item.id)) });
  }),

  http.get(`${API}/warehouse/inbound-shipments`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const statuses = (url.searchParams.get('status') ?? '').split(',').filter(Boolean);
    const filtered = inbound().shipments.filter(listFilter(url));
    const items = filtered.filter((item) => !statuses.length || statuses.includes(item.status)).sort(SORTS[url.searchParams.get('sort') ?? ''] ?? SORTS['-createdAt']);
    return ok({ ...pageOf(items, url), counts: counts(filtered) });
  }),

  http.post(`${API}/warehouse/inbound-shipments`, async ({ request, cookies }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { wholesalerId?: unknown; expectedAt?: unknown; note?: unknown; waybillNumber?: unknown; items?: unknown; idempotencyKey?: unknown };
    const replayed = replay(body.idempotencyKey);
    if (replayed) return ok(replayed, 201);
    const wholesaler = inbound().wholesalers.find((item) => item.id === String(body.wholesalerId));
    if (!wholesaler) return fail(404, 'NOT_FOUND', 'Optovik topilmadi');
    if (!wholesaler.contractSigned) return fail(409, 'CONTRACT_REQUIRED', 'Shartnoma yuklanmagan — bu optovik uchun ariza kiritib bo‘lmaydi');
    const expectedAt = typeof body.expectedAt === 'string' ? body.expectedAt : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedAt) || expectedAt < tashkentDate()) return fail(400, 'VALIDATION_ERROR', 'Kelish sanasi bugun yoki keyin bo‘lsin');
    const rows = Array.isArray(body.items) ? (body.items as { variantId?: unknown; quantity?: unknown }[]) : [];
    if (!rows.length) return fail(400, 'VALIDATION_ERROR', 'Kamida bitta mahsulot kiriting');
    for (const row of rows) {
      const target = skuByVariant(String(row.variantId));
      if (!target || target.wholesalerId !== wholesaler.id) return fail(400, 'VALIDATION_ERROR', 'Mahsulot bu optovikniki emas');
      if (target.status !== 'ACTIVE') return fail(409, 'PRODUCT_NOT_APPROVED', `${target.name} tasdiqlanmagan — postavka qilib bo‘lmaydi`);
      if (!Number.isInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 100_000) return fail(400, 'VALIDATION_ERROR', 'Miqdor 1 dan 100 000 gacha');
    }
    const created = rows.map((row) => {
      const number = nextNumber();
      const target = skuByVariant(String(row.variantId)) as MockSku;
      const shipment: InboundShipment = {
        id: String(number), number: `P-${String(number).padStart(4, '0')}`, status: 'DECLARED',
        wholesaler: { id: wholesaler.id, name: wholesaler.name, tin: wholesaler.tin },
        sku: { productId: target.productId, variantId: target.variantId, name: target.name, barcode: target.barcode, expiryTracked: target.expiryTracked, categoryName: target.categoryName, cell: target.cell },
        declared: Number(row.quantity), accepted: 0, defect: 0, expectedAt,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
        waybillNumber: typeof body.waybillNumber === 'string' && body.waybillNumber.trim() ? body.waybillNumber.trim() : null,
        createdAt: now(), createdBy: actor, inTransitAt: null, receivingStartedAt: null, completedAt: null, completedBy: null,
        actNote: null, cancelledAt: null, cancelReason: null, lots: [],
      };
      inbound().shipments.push(shipment);
      return shipment;
    });
    return ok(remember(body.idempotencyKey, { items: created }), 201);
  }),

  http.get(`${API}/warehouse/inbound-shipments/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    return shipment ? ok(shipment) : fail(404, 'NOT_FOUND', 'Postavka topilmadi');
  }),

  http.post(`${API}/warehouse/inbound-shipments/:id/cancel`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    const { reason } = (await request.json().catch(() => ({}))) as { reason?: unknown };
    if (typeof reason !== 'string' || !reason.trim()) return fail(400, 'VALIDATION_ERROR', 'Sababni tanlang');
    if (shipment.status !== 'DECLARED' || shipment.receivingStartedAt) return fail(409, 'INVALID_STATE', 'Faqat «E’lon qilindi» holatidagi, qabuli boshlanmagan ariza bekor qilinadi');
    Object.assign(shipment, { status: 'CANCELLED', cancelledAt: now(), cancelReason: reason.trim() });
    return ok(shipment);
  }),

  http.post(`${API}/warehouse/inbound-shipments/:id/receiving`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    if (!AWAITING_STATUSES.includes(shipment.status)) return fail(409, 'INVALID_STATE', 'Bu postavka qabul kutmayapti');
    shipment.receivingStartedAt ??= now();
    return ok(shipment);
  }),

  http.get(`${API}/warehouse/inbound-shipments/:id/scans`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    const list = journal(shipment);
    return ok({ items: [...list].reverse().slice(0, 50), total: list.length });
  }),

  http.post(`${API}/warehouse/inbound-shipments/:id/scans`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    const body = (await request.json().catch(() => ({}))) as { barcode?: unknown; mode?: unknown; lotId?: unknown; scannedAt?: unknown; idempotencyKey?: unknown };
    const replayed = replay(body.idempotencyKey);
    if (replayed) return ok(replayed);
    if (!shipment.receivingStartedAt || isCompleted(shipment) || !AWAITING_STATUSES.includes(shipment.status)) return fail(409, 'INVALID_STATE', 'Qabul boshlanmagan yoki yakunlangan');
    const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : '';
    if (!barcode) return fail(400, 'VALIDATION_ERROR', 'Shtrix-kod bo‘sh');
    const mode: ScanMode = body.mode === 'DEFECT' ? 'DEFECT' : 'ACCEPT';
    const at = typeof body.scannedAt === 'string' && !Number.isNaN(Date.parse(body.scannedAt)) ? body.scannedAt : now();
    const list = journal(shipment);
    const base = { id: `S-${shipment.id}-${list.length + 1}`, at, barcode, mode };
    const owner = skuByBarcode(barcode);
    let scan: ShipmentScan;
    if (!owner) scan = { ...base, result: 'UNKNOWN', total: null, productName: null, lotNumber: null };
    else if (owner.variantId !== shipment.sku.variantId) scan = { ...base, result: 'FOREIGN', total: null, productName: owner.name, lotNumber: null };
    else {
      const lot = shipment.sku.expiryTracked ? shipment.lots.find((item) => item.id === body.lotId) : shipment.lots[0];
      if (shipment.sku.expiryTracked && !lot) return fail(409, 'LOT_REQUIRED', 'Avval partiya va yaroqlilik muddatini kiriting');
      if (mode === 'ACCEPT') {
        shipment.accepted += 1;
        if (lot) lot.quantity += 1;
        else shipment.lots.push({ id: `L-${shipment.id}`, number: shipment.number, expiresAt: null, quantity: 1, sellable: true });
      } else shipment.defect += 1;
      scan = { ...base, result: mode === 'ACCEPT' ? 'ACCEPTED' : 'DEFECT', total: mode === 'ACCEPT' ? shipment.accepted : shipment.defect, productName: null, lotNumber: lot?.number ?? shipment.number };
    }
    list.push(scan);
    return ok(remember(body.idempotencyKey, { scan, shipment: structuredClone(shipment) }));
  }),

  http.delete(`${API}/warehouse/inbound-shipments/:id/scans/:scanId`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    if (isCompleted(shipment)) return fail(409, 'INVALID_STATE', 'Qabul yakunlangach skanlar o‘zgarmaydi');
    const list = journal(shipment);
    const last = [...list].reverse().find((item) => item.result === 'ACCEPTED' || item.result === 'DEFECT');
    if (!last || last.id !== params.scanId) return fail(409, 'NOT_LAST_SCAN', 'Faqat oxirgi hisoblangan skan bekor qilinadi');
    list.splice(list.indexOf(last), 1);
    if (last.result === 'ACCEPTED') {
      shipment.accepted -= 1;
      const lot = shipment.lots.find((item) => item.number === last.lotNumber) ?? shipment.lots[0];
      if (lot) lot.quantity = Math.max(0, lot.quantity - 1);
    } else shipment.defect -= 1;
    return ok(shipment);
  }),

  http.post(`${API}/warehouse/inbound-shipments/:id/lots`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    if (!shipment.sku.expiryTracked) return fail(409, 'INVALID_STATE', 'Bu mahsulotda muddat kuzatilmaydi');
    const { number, expiresAt } = (await request.json().catch(() => ({}))) as { number?: unknown; expiresAt?: unknown };
    if (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return fail(400, 'VALIDATION_ERROR', 'Muddatni kiriting: bu toifadagi tovar faqat muddat bilan qabul qilinadi');
    if (daysLeft(expiresAt, tashkentDate()) < 0) return fail(400, 'VALIDATION_ERROR', 'Muddati o‘tgan tovar qabul qilinmaydi');
    const lotNumber = typeof number === 'string' && number.trim() ? number.trim() : `${shipment.number}-${shipment.lots.length + 1}`;
    if (shipment.lots.some((lot) => lot.number === lotNumber)) return fail(409, 'DUPLICATE_LOT', 'Bu partiya raqami bor');
    shipment.lots.push({ id: `L-${shipment.id}-${shipment.lots.length + 1}`, number: lotNumber, expiresAt, quantity: 0, sellable: isSellableExpiry(expiresAt, tashkentDate()) });
    return ok(shipment, 201);
  }),

  http.post(`${API}/warehouse/inbound-shipments/:id/complete`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    if (isCompleted(shipment)) return ok(shipment);
    if (!shipment.receivingStartedAt) return fail(409, 'INVALID_STATE', 'Qabul boshlanmagan');
    const { note, confirmShortage } = (await request.json().catch(() => ({}))) as { note?: unknown; confirmShortage?: unknown };
    const counted = shipment.accepted + shipment.defect;
    if (!counted) return fail(409, 'NOTHING_COUNTED', 'Hali hech narsa sanalmagan');
    if (counted < shipment.declared && confirmShortage !== true) return fail(409, 'SHORTAGE_NOT_CONFIRMED', `${shipment.declared - counted} dona kam: qayta sanang yoki kam deb yakunlang`);
    const exact = shipment.accepted === shipment.declared && shipment.defect === 0;
    Object.assign(shipment, {
      status: exact ? 'RECEIVED' : 'DISCREPANCY', completedAt: now(), completedBy: actor,
      actNote: typeof note === 'string' && note.trim() ? note.trim() : null,
    });
    settleStock(shipment);
    return ok(shipment);
  }),
  http.get(`${API}/warehouse/lots`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? '';
    const all = stockLots().filter((lot) =>
      (!url.searchParams.get('wholesalerId') || lot.wholesaler.id === url.searchParams.get('wholesalerId')) &&
      (!search || [lot.number, lot.sku.name, lot.sku.barcode ?? ''].some((value) => value.toLowerCase().includes(search))));
    const state = url.searchParams.get('state');
    const untracked = inbound().skus.filter((item) => !item.expiryTracked && item.status === 'ACTIVE').map((item) => ({ variantId: item.variantId, name: item.name }));
    return ok({
      items: state ? all.filter((lot) => lot.state === state) : all,
      counts: { ALL: all.length, APPROACHING: all.filter((lot) => lot.state === 'APPROACHING').length, BLOCKED: all.filter((lot) => lot.state === 'BLOCKED').length, EXPIRED: all.filter((lot) => lot.state === 'EXPIRED').length },
      rules: { minShelfDays: MIN_SHELF_DAYS, notifyDays: null },
      untracked,
    });
  }),

  http.post(`${API}/warehouse/lots/:id/:action`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const lot = stockLots().find((item) => item.id === String(params.id));
    if (!lot) return fail(404, 'NOT_FOUND', 'Partiya topilmadi');
    const body = (await request.json().catch(() => ({}))) as { quantity?: unknown; reason?: unknown; note?: unknown };
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > lot.quantity) return fail(400, 'VALIDATION_ERROR', `Ko‘pi bilan ${lot.quantity} dona — partiyada shuncha bor`);
    if (params.action === 'write-off') {
      if (typeof body.note !== 'string' || !body.note.trim()) return fail(400, 'VALIDATION_ERROR', 'Izoh majburiy');
      inbound().lotActions[lot.id] = { state: 'WRITTEN_OFF', quantity };
      const target = skuByVariant(lot.sku.variantId);
      if (target) {
        target.onHand = Math.max(0, target.onHand - quantity);
        target.blocked = Math.max(0, target.blocked - (lot.state === 'BLOCKED' ? quantity : 0));
      }
      return ok({ ...lot, state: 'WRITTEN_OFF', quantity: lot.quantity - quantity });
    }
    if (params.action === 'return') {
      if (lot.state !== 'EXPIRED' && lot.state !== 'BLOCKED') return fail(409, 'INVALID_STATE', 'Faqat sotuvdan chiqarilgan yoki muddati o‘tgan partiya qaytariladi');
      inbound().lotActions[lot.id] = { state: 'RETURNING', quantity };
      return ok({ ...lot, state: 'RETURNING' });
    }
    return fail(404, 'NOT_FOUND', 'Amal topilmadi');
  }),
];
