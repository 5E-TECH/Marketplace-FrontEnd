import { http } from 'msw';
import { saleUntil } from '../../features/inbound/lib/expiry';
import { SHIPMENT_STATUSES, type ShipmentAuthorRole } from '../../features/inbound/model/inboundTypes';
import { db } from '../db';
import type { MockLot, MockShipment, MockShipmentItem } from '../fixtures/inbound';
import { samplePdf } from '../samplePdf';
import { API, fail, ok, pageOf, tashkentDate } from '../utils';
import { currentMockUser } from './auth';

/**
 * Ombor: postavka e'loni va qabuli (FE-16) — BE-17 (PR #132) qoidalari: e'lonni omborchi, admin yoki superadmin
 * optovik nomidan ochadi (mahsulot shu optovikniki, CPA, faol); qabul — faqat omborchi va superadmin, hamma qator
 * bitta so'rovda; qoldiqqa yaroqli soni (kelgan − brak); muddat kiritilsa — partiya, sotuvdan chiqish = muddat − 60
 * kun; farq yoki brak — DISCREPANCY; takroriy qabul — o'sha natija. Taklif maydonlari — docs/api-taklif/fe-16-ombor.md.
 */
const STAFF_ROLES = ['ADMIN', 'SUPERADMIN', 'WAREHOUSE'];
const ID = /^[1-9]\d{0,18}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CELL = /^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/;

function guard(request: Request, cookies: Record<string, string>, roles = STAFF_ROLES) {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), user: null };
  if (!roles.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu amal sizning rolingizga ruxsat etilmagan'), user: null };
  return { denied: null, user };
}

const inbound = () => db.inbound;
const findShipment = (id: unknown) => inbound().shipments.find((item) => item.id === String(id));
/** Mahsulot SKU si: FE-16 fixture'ida yo'q bo'lsa — admin mahsulotidan (Namuna Savdo) yaratiladi. */
function skuOf(productId: string) {
  const found = inbound().skus.find((item) => item.productId === productId);
  if (found) return found;
  const product = db.adminProducts.find((item) => item.id === productId);
  if (!product) return undefined;
  const created = {
    productId, variantId: `${productId}01`, name: product.name, barcode: `4780012${productId}000`, cell: null, wholesalerId: product.shopId,
    status: product.status === 'ACTIVE' && product.cpaEnabled ? 'ACTIVE' as const : 'PENDING_REVIEW' as const, expiryTracked: product.isBad,
    onHand: 0, reserved: 0, defect: 0, reservedTomorrow: 0,
  };
  inbound().skus.push(created);
  return created;
}
/** JSON qiymati — satr yoki son bo'lsa matn, aks holda bo'sh. */
const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

/** Sotuvdan chiqqan (sotuv oxiri o'tgan) partiya «mavjud»ga kirmaydi. */
const isBlocked = (lot: MockLot, today = tashkentDate()) => saleUntil(lot.expiryDate) < today;
const lotDto = (lot: MockLot) => ({ ...lot, sellableUntil: saleUntil(lot.expiryDate), blocked: isBlocked(lot) });
const blockedOf = (variantId: string) => inbound().lots.filter((lot) => lot.variantId === variantId && isBlocked(lot)).reduce((sum, lot) => sum + lot.quantity, 0);

/** Admin mahsulotlari ro'yxatiga qo'shimcha: boshqa optoviklarning (Namuna Farm) SKU lari — `shopId` bo'yicha. */
export function inboundProductRecords(shopId: string) {
  return inbound().skus.filter((item) => item.wholesalerId === shopId).map((item) => ({
    id: item.productId, shopId: item.wholesalerId, name: item.name, status: item.status, isBlocked: false, cpaEnabled: true,
    approvedPrice: null, isBad: item.expiryTracked, expiryTracked: item.expiryTracked, images: [], createdAt: '2027-01-05T05:00:00.000Z',
  }));
}

/** `GET /admin/inventory/stock` — omborchi ko'rinishi (BE-16, BE-17 `cell`, `blocked`) + taklif maydonlari. */
export function warehouseStockRows(shopId?: string | null) {
  const data = inbound();
  return data.skus.filter((item) => (item.onHand > 0 || item.defect > 0) && (!shopId || item.wholesalerId === shopId)).map((item) => {
    const blocked = blockedOf(item.variantId);
    return {
      shopId: item.wholesalerId, shopName: data.wholesalers.find((entry) => entry.id === item.wholesalerId)?.name ?? null,
      warehouseId: '1', warehouseName: 'Toshkent ombori', warehouseActive: true, variantId: item.variantId, productId: item.productId,
      productName: item.name, variantName: null, sku: `SKU-${item.productId}`, catalogMissing: false, barcode: item.barcode, cell: item.cell,
      onHand: item.onHand, reserved: item.reserved, available: Math.max(0, item.onHand - item.reserved - blocked), blocked, lowStockThreshold: 5,
      defect: item.defect, reservedToday: item.reserved - item.reservedTomorrow, reservedTomorrow: item.reservedTomorrow,
    };
  });
}

function nextId() {
  return Math.max(0, ...inbound().shipments.map((item) => Number(item.id))) + 1;
}

export const warehouseHandlers = [
  http.get(`${API}/admin/inventory/shipments`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const wholesalerId = url.searchParams.get('wholesalerId');
    if (status && !SHIPMENT_STATUSES.some((item) => item === status)) return fail(400, 'VALIDATION_ERROR', 'status noto‘g‘ri');
    const items = inbound().shipments
      .filter((item) => (!status || item.status === status) && (!wholesalerId || item.wholesalerId === wholesalerId))
      .sort((a, b) => Number(b.id) - Number(a.id));
    const { items: list, total, page, limit } = pageOf(items, url, 20);
    return ok({ items: list, total, page, limit });
  }),

  http.get(`${API}/admin/inventory/shipments/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    return shipment ? ok(shipment) : fail(404, 'NOT_FOUND', 'Postavka topilmadi');
  }),

  http.post(`${API}/admin/inventory/shipments`, async ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { wholesalerId?: unknown; expectedAt?: unknown; note?: unknown; items?: unknown };
    const wholesaler = inbound().wholesalers.find((item) => item.id === text(body.wholesalerId));
    if (!wholesaler) return fail(400, 'VALIDATION_ERROR', 'Optovik topilmadi');
    const expectedAt = typeof body.expectedAt === 'string' ? body.expectedAt : '';
    if (!DAY.test(expectedAt)) return fail(400, 'VALIDATION_ERROR', 'expectedAt YYYY-MM-DD bo‘lishi kerak');
    const rows = Array.isArray(body.items) ? (body.items as { productId?: unknown; quantity?: unknown }[]) : [];
    if (!rows.length) return fail(400, 'VALIDATION_ERROR', 'Kamida bitta mahsulot kerak');
    if (new Set(rows.map((row) => text(row.productId))).size !== rows.length) return fail(400, 'VALIDATION_ERROR', 'Mahsulot takrorlangan');
    for (const row of rows) {
      if (!Number.isSafeInteger(row.quantity) || Number(row.quantity) < 1) return fail(400, 'VALIDATION_ERROR', 'Soni musbat butun son bo‘lishi kerak');
      const product = skuOf(text(row.productId));
      if (!product || product.status !== 'ACTIVE') return fail(400, 'VALIDATION_ERROR', `Mahsulot ${text(row.productId)} topilmadi yoki faol varianti yo‘q`);
      if (product.wholesalerId !== wholesaler.id) return fail(400, 'VALIDATION_ERROR', `Mahsulot ${product.productId} boshqa optovikniki`);
    }
    const id = String(nextId());
    const created: MockShipment = {
      id, number: `P-${id.padStart(4, '0')}`, wholesalerId: wholesaler.id, wholesalerName: wholesaler.name, status: 'DECLARED', expectedAt,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
      declaredBy: user.id, declaredByName: user.name, declaredByRole: user.role as ShipmentAuthorRole,
      receivedBy: null, receivedByName: null, receivedAt: null, receiveComment: null, createdAt: new Date().toISOString(),
      items: rows.map((row, index): MockShipmentItem => {
        const product = skuOf(text(row.productId));
        return {
          id: `${id}${index + 1}`, productId: text(row.productId), productName: product?.name ?? '', variantId: product?.variantId ?? '', sku: `SKU-${text(row.productId)}`,
          barcode: product?.barcode ?? null, declaredQty: Number(row.quantity), receivedQty: null, defectiveQty: null, batch: null, expiryDate: null, cell: null,
          expiryTracked: product?.expiryTracked ?? false,
        };
      }),
    };
    inbound().shipments.unshift(created);
    return ok(created, 201);
  }),

  http.post(`${API}/admin/inventory/shipments/:id/in-transit`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    if (shipment.status !== 'DECLARED' && shipment.status !== 'IN_TRANSIT') return fail(409, 'CONFLICT', `Postavka holati ${shipment.status}`);
    shipment.status = 'IN_TRANSIT';
    return ok(shipment);
  }),

  http.post(`${API}/admin/inventory/shipments/:id/receive`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ['WAREHOUSE', 'SUPERADMIN']);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    // Takroriy yuborish — o'sha natija.
    if (shipment.status === 'RECEIVED' || shipment.status === 'DISCREPANCY') return ok(shipment);
    const body = (await request.json().catch(() => ({}))) as { items?: unknown; comment?: unknown };
    const lines = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    const seen = new Set<string>();
    for (const line of lines) {
      const itemId = text(line.itemId);
      if (!shipment.items.some((item) => item.id === itemId) || seen.has(itemId)) return fail(400, 'VALIDATION_ERROR', `Postavka qatori noto‘g‘ri: ${itemId}`);
      seen.add(itemId);
      const received = line.receivedQty;
      const defect = line.defectiveQty;
      if (!Number.isSafeInteger(received) || !Number.isSafeInteger(defect) || Number(received) < 0 || Number(defect) < 0 || Number(defect) > Number(received)) {
        return fail(400, 'VALIDATION_ERROR', 'Qabul va brak soni: butun, 0 dan katta, brak ≤ qabul');
      }
      if (!CELL.test(text(line.cell))) return fail(400, 'VALIDATION_ERROR', 'Yacheyka manzili kerak (masalan B-02-1)');
      if (line.expiryDate !== undefined && !DAY.test(text(line.expiryDate))) return fail(400, 'VALIDATION_ERROR', 'expiryDate YYYY-MM-DD bo‘lishi kerak');
    }
    if (seen.size !== shipment.items.length) return fail(400, 'VALIDATION_ERROR', 'Postavkaning hamma qatori qabul qilinishi kerak');
    let discrepancy = false;
    for (const line of lines) {
      const item = shipment.items.find((row) => row.id === text(line.itemId));
      if (!item) continue;
      const received = Number(line.receivedQty);
      const defect = Number(line.defectiveQty);
      const good = received - defect;
      if (received !== item.declaredQty || defect > 0) discrepancy = true;
      Object.assign(item, {
        receivedQty: received, defectiveQty: defect, cell: text(line.cell),
        batch: typeof line.batch === 'string' && line.batch.trim() ? line.batch.trim() : null,
        expiryDate: typeof line.expiryDate === 'string' ? line.expiryDate : null,
      });
      const stock = skuOf(item.productId);
      if (stock) {
        stock.onHand += good;
        stock.defect += defect;
        stock.cell = item.cell;
      }
      if (good > 0 && item.expiryDate) {
        inbound().lots.push({ id: `${item.id}0`, variantId: item.variantId, sku: item.sku, productName: item.productName, batch: item.batch, expiryDate: item.expiryDate, quantity: good });
      }
    }
    Object.assign(shipment, {
      status: discrepancy ? 'DISCREPANCY' : 'RECEIVED', receivedBy: user.id, receivedByName: user.name, receivedAt: new Date().toISOString(),
      receiveComment: typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : null,
    });
    return ok(shipment);
  }),

  // Server tuzadigan PDF — mockda kichik namuna fayl.
  http.get(`${API}/admin/inventory/shipments/:id/act.pdf`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const shipment = findShipment(params.id);
    if (!shipment) return fail(404, 'NOT_FOUND', 'Postavka topilmadi');
    if (shipment.status !== 'RECEIVED' && shipment.status !== 'DISCREPANCY') return fail(409, 'CONFLICT', 'Akt qabuldan keyin tuziladi');
    const lines = shipment.items.map((item) => `${item.productName}: ${item.declaredQty} / ${(item.receivedQty ?? 0) - (item.defectiveQty ?? 0)} / ${item.defectiveQty ?? 0}`);
    return new Response(samplePdf([`Qabul akti ${shipment.number}`, ...lines]).buffer as ArrayBuffer, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="qabul-akti-${shipment.number}.pdf"` },
    });
  }),

  http.get(`${API}/admin/inventory/lots`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const state = new URL(request.url).searchParams.get('state') ?? 'ALL';
    const today = tashkentDate();
    const lots = inbound().lots
      .filter((lot) => lot.quantity > 0 && (state === 'ALL' || (state === 'BLOCKED') === isBlocked(lot, today)))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
      .map(lotDto);
    return ok(lots);
  }),

  // BE-16 tuzatish; BE-17: partiyadan hisobdan chiqarish — `lotId` (sotuvdan chiqqan partiya bo'lsa majburiy).
  http.post(`${API}/admin/inventory/adjust`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { variantId?: unknown; delta?: unknown; reason?: unknown; lotId?: unknown; idempotencyKey?: unknown };
    const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    if (key && inbound().replies.has(key)) return ok(inbound().replies.get(key));
    const delta = Number(body.delta);
    if (!Number.isSafeInteger(delta) || delta === 0) return fail(400, 'VALIDATION_ERROR', 'delta noldan farqli bo‘lishi kerak');
    if (typeof body.reason !== 'string' || !body.reason.trim()) return fail(400, 'VALIDATION_ERROR', 'Sabab kerak');
    const stock = inbound().skus.find((item) => item.variantId === text(body.variantId));
    if (!stock) return fail(404, 'NOT_FOUND', 'Qoldiq topilmadi');
    const lot = body.lotId === undefined ? undefined : inbound().lots.find((item) => item.id === text(body.lotId) && item.variantId === stock.variantId);
    if (body.lotId !== undefined && (!ID.test(text(body.lotId)) || !lot)) return fail(400, 'VALIDATION_ERROR', 'Partiya topilmadi');
    if (delta < 0 && lot && -delta > lot.quantity) return fail(400, 'VALIDATION_ERROR', `Partiyada ${lot.quantity} dona bor`);
    if (stock.onHand + delta < stock.reserved) return fail(409, 'CONFLICT', 'Qoldiq band qilingandan kam bo‘lmaydi');
    stock.onHand += delta;
    if (lot) lot.quantity += delta;
    const result = { variantId: stock.variantId, warehouseId: '1', onHand: stock.onHand, reserved: stock.reserved, available: Math.max(0, stock.onHand - stock.reserved - blockedOf(stock.variantId)) };
    if (key) inbound().replies.set(key, result);
    return ok(result);
  }),
];

/** Testlar uchun: qabul qilingan partiya — qoldiqqa qo'shiladi; muddatiga 60 kundan kam qolgan bo'lsa «mavjud»ga kirmaydi. */
export function seedLot(productId: string, quantity: number, expiryDate: string, batch: string | null = null) {
  const stock = skuOf(productId);
  if (!stock) return;
  stock.onHand += quantity;
  inbound().lots.push({ id: String(900 + inbound().lots.length), variantId: stock.variantId, sku: `SKU-${productId}`, productName: stock.name, batch, expiryDate, quantity });
}

