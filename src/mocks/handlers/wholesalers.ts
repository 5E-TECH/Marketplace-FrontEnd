import { http } from 'msw';
import { hasContract } from '../../features/wholesalers/lib/wholesalerRules';
import type { WholesalerAttention, WholesalerStats } from '../../features/wholesalers/model/wholesalerTypes';
import { db } from '../db';
import type { MockInboundWholesaler } from '../fixtures/inbound';
import { MOCK_PRODUCT_SALES, MOCK_RETURNS_SPLIT, mockWholesalerMoney } from '../fixtures/wholesalerFinance';
import { samplePdf } from '../samplePdf';
import { API, fail, ok, pageOf } from '../utils';
import { currentMockUser } from './auth';
import { warehouseStockRows } from './warehouse';

/**
 * Optoviklar (FE-25): BE-07 `admin/wholesalers` qoidalari (`wholesaler.service.ts`) — admin kiritadi, holat darhol
 * «Faol», STIR takror — 409, PATCH faqat faol ↔ to'xtatilgan; BE-30 — ariza ko'rib chiqish, kabinet egasi, hujjatlar.
 * Taklif maydonlari (rahbar, yig'ma raqamlar, kabinet, shartnoma skani, «Diqqat talab qiladi») —
 * docs/api-taklif/fe-25-admin-optovik.md. Ro'yxatni omborchi ham o'qiydi (FE-16: arizasiz postavka).
 */
const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];
const ID = /^[1-9]\d{0,18}$/;

function guard(request: Request, cookies: Record<string, string>, roles = ADMIN_ROLES) {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), user: null };
  if (!roles.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim admin uchun'), user: null };
  return { denied: null, user };
}

const list = () => db.inbound.wholesalers;
const find = (id: unknown) => list().find((item) => item.id === String(id));
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function stats(id: string): WholesalerStats {
  const products = db.adminProducts.filter((item) => item.shopId === id);
  const skus = db.inbound.skus.filter((item) => item.wholesalerId === id);
  const stock = warehouseStockRows(id);
  const availableOf = (productId: string) => stock.find((row) => row.productId === productId)?.available ?? 0;
  const ownIds = new Set(products.map((item) => item.id));
  const onSale = [...products.filter((item) => item.status === 'ACTIVE' && !item.isBlocked).map((item) => item.id),
    ...skus.filter((item) => item.status === 'ACTIVE' && !ownIds.has(item.productId)).map((item) => item.productId)];
  const shipments = db.inbound.shipments.filter((item) => item.wholesalerId === id);
  const waiting = shipments.filter((item) => item.status === 'DECLARED' || item.status === 'IN_TRANSIT');
  const defect = [...shipments].sort((a, b) => Number(b.id) - Number(a.id)).find((item) => item.items.some((row) => (row.defectiveQty ?? 0) > 0));
  const productIds = [...new Set([...ownIds, ...skus.map((item) => item.productId)])];
  const sales = productIds.map((productId) => MOCK_PRODUCT_SALES[productId]).filter(Boolean);
  const defectTotal = skus.reduce((sum, item) => sum + item.defect, 0);
  const defectReceiving = shipments.reduce((sum, item) => sum + item.items.reduce((total, row) => total + (row.defectiveQty ?? 0), 0), 0);
  const returned = sales.reduce((sum, item) => sum + item.returned, 0);
  const split = MOCK_RETURNS_SPLIT[id];
  const money = mockWholesalerMoney(id);
  return {
    products: { total: new Set([...ownIds, ...skus.map((item) => item.productId)]).size, onSale: onSale.length, noStock: onSale.filter((productId) => availableOf(productId) === 0).length },
    stock: {
      onHand: stock.reduce((sum, row) => sum + row.onHand, 0),
      available: stock.reduce((sum, row) => sum + row.available, 0),
      reserved: stock.reduce((sum, row) => sum + row.reserved, 0),
    },
    shipments: {
      total: shipments.length,
      waiting: waiting.length,
      waitingQty: waiting.reduce((sum, item) => sum + item.items.reduce((total, row) => total + row.declaredQty, 0), 0),
      waitingCodes: waiting.map((item) => item.number).sort(),
      lastDefect: defect ? { code: defect.number, quantity: defect.items.reduce((sum, row) => sum + (row.defectiveQty ?? 0), 0) } : null,
    },
    payable: { amount: money?.payable ?? 0, held: money?.held ?? 0 },
    goods: {
      inTransit: sales.reduce((sum, item) => sum + item.inTransit, 0),
      sold: sales.reduce((sum, item) => sum + item.sold, 0),
      soldAmount: money?.written ?? 0,
      returned,
      returnedSorting: split?.sorting ?? returned,
      returnedInElchi: split?.inElchi ?? 0,
      defect: defectTotal,
      defectReceiving: Math.min(defectReceiving, defectTotal),
      defectReturns: Math.max(0, defectTotal - defectReceiving),
    },
    money,
  };
}

function dto(item: MockInboundWholesaler) {
  return {
    id: item.id, name: item.name, slug: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${item.id}`, status: item.status,
    legalType: item.legalType, tin: item.tin, bankName: item.bankName, bankAccount: item.bankAccount, bankMfo: item.bankMfo,
    contractNumber: item.contractNumber, contractDate: item.contractDate, phone: item.phone, address: item.address, description: item.description,
    ownerUserId: item.ownerUserId, contractVersion: item.contractVersion, contractAcceptedAt: item.contractAcceptedAt, moderationNote: item.moderationNote, createdAt: item.createdAt,
    directorName: item.directorName, createdBy: item.createdBy, statusChangedAt: item.statusChangedAt, statusChangedBy: item.statusChangedBy,
    suspendReason: item.suspendReason, bankChangeRequest: item.bankChangeRequest, cabinet: item.cabinet, contractFile: item.contractFile, stats: stats(item.id),
  };
}

/** Omborchiga BE-25 dagidek faqat shu maydonlar — bank rekvizitlari, telefon va kabinet egasisiz. */
const warehouseView = (item: MockInboundWholesaler) => ({
  id: item.id, name: item.name, status: item.status, tin: item.tin, contractNumber: item.contractNumber, contractDate: item.contractDate,
});

interface Problem { field: string; message: string }

/** `CreateWholesalerDto` tekshiruvi (class-validator xabarlari bilan); `partial` — PATCH. */
function validate(body: Record<string, unknown>, partial: boolean): Problem[] {
  const problems: Problem[] = [];
  const check = (field: string, valid: boolean, message: string) => {
    if (!(field in body) && partial) return;
    if (!valid) problems.push({ field, message });
  };
  check('name', text(body.name).length > 0, 'name bo‘sh bo‘lmasligi kerak');
  check('legalType', body.legalType === 'LEGAL_ENTITY' || body.legalType === 'SOLE_PROPRIETOR', 'legalType noto‘g‘ri');
  check('tin', /^\d{9}$/.test(text(body.tin)), 'STIR 9 raqamdan iborat bo‘lishi kerak');
  check('bankName', text(body.bankName).length > 0, 'bankName bo‘sh bo‘lmasligi kerak');
  check('bankAccount', /^\d{20}$/.test(text(body.bankAccount)), 'Hisob raqami 20 raqamdan iborat bo‘lishi kerak');
  check('bankMfo', /^\d{5}$/.test(text(body.bankMfo)), 'MFO 5 raqamdan iborat bo‘lishi kerak');
  if ('phone' in body) check('phone', /^\+998\d{9}$/.test(text(body.phone)), "phone +998XXXXXXXXX formatida bo'lishi kerak");
  // Taklif §2: shartnoma ixtiyoriy, lekin raqami va sanasi birga.
  if ('contractDate' in body) check('contractDate', /^\d{4}-\d{2}-\d{2}$/.test(text(body.contractDate)), 'contractDate YYYY-MM-DD bo‘lishi kerak');
  if ('contractNumber' in body) check('contractNumber', text(body.contractNumber).length > 0, 'contractNumber bo‘sh bo‘lmasligi kerak');
  return problems;
}

/** Audit (BE-07): har amal — kim, qachon, nima. */
function log(item: MockInboundWholesaler, actorName: string | null, action: string, meta: Record<string, unknown> = {}) {
  item.history.push({ id: `H-${item.id}-${item.history.length + 1}-${Date.now()}`, at: new Date().toISOString(), actorName, action, meta });
}

const invalid = (problems: Problem[]) => fail(400, 'VALIDATION_ERROR', problems[0].message, undefined, { details: problems });
const duplicateTin = (tin: string, exceptId?: string) => list().some((item) => item.tin === tin && item.id !== exceptId);

function attention(): WholesalerAttention[] {
  const items: WholesalerAttention[] = [];
  for (const wholesaler of list()) {
    const base = { wholesalerId: wholesaler.id, wholesalerName: wholesaler.name };
    db.inbound.shipments.filter((item) => item.wholesalerId === wholesaler.id && item.status === 'DISCREPANCY').forEach((item) => {
      const row = item.items[0];
      items.push({ ...base, kind: 'SHIPMENT_DEFECT', id: `defect-${item.id}`, shipmentId: item.id, shipmentCode: item.number, productName: row.productName,
        declared: item.items.reduce((sum, entry) => sum + entry.declaredQty, 0), received: item.items.reduce((sum, entry) => sum + (entry.receivedQty ?? 0), 0),
        defect: item.items.reduce((sum, entry) => sum + (entry.defectiveQty ?? 0), 0) });
    });
    warehouseStockRows(wholesaler.id).filter((row) => row.available === 0).forEach((row) => {
      const incoming = db.inbound.shipments.find((item) => item.status === 'IN_TRANSIT' && item.items.some((entry) => entry.productId === row.productId));
      items.push({ ...base, kind: 'OUT_OF_STOCK', id: `stock-${row.productId}`, productId: row.productId, productName: row.productName, onHand: row.onHand,
        reserved: row.reserved, incomingCode: incoming?.number ?? null, incomingQty: incoming?.items.reduce((sum, entry) => sum + entry.declaredQty, 0) ?? 0 });
    });
    const defects = db.inbound.skus.filter((item) => item.wholesalerId === wholesaler.id).reduce((sum, item) => sum + item.defect, 0);
    if (defects > 0) {
      const receiving = db.inbound.shipments.filter((item) => item.wholesalerId === wholesaler.id && item.items.some((entry) => (entry.defectiveQty ?? 0) > 0));
      const fromReceiving = receiving.reduce((sum, item) => sum + item.items.reduce((total, entry) => total + (entry.defectiveQty ?? 0), 0), 0);
      items.push({ ...base, kind: 'DEFECT_NOT_RETURNED', id: `returns-${wholesaler.id}`, quantity: defects, fromReceiving, receivingCodes: receiving.map((item) => item.number),
        fromReturns: Math.max(0, defects - fromReceiving), returnCodes: MOCK_RETURNS_SPLIT[wholesaler.id]?.returnCodes ?? [] });
    }
    const act = mockWholesalerMoney(wholesaler.id)?.lastAct;
    if (act?.status === 'READY') {
      items.push({ ...base, kind: 'SETTLEMENT_READY', id: `act-${wholesaler.id}`, settlementId: act.id, code: act.code, periodFrom: act.periodFrom, periodTo: act.periodTo, amount: act.transfer });
    }
  }
  return items;
}

export const wholesalerHandlers = [
  // Ro'yxat (BE-07): nom bo'yicha qism, STIR bo'yicha aniq qidiruv; yangisi tepada. Omborchiga qisqa ko'rinish.
  http.get(`${API}/admin/wholesalers`, ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies, [...ADMIN_ROLES, 'WAREHOUSE']);
    if (denied) return denied;
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    const items = list()
      .filter((item) => !search || item.name.toLowerCase().includes(search) || item.tin === search)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id));
    const view = user.role === 'WAREHOUSE' ? items.map(warehouseView) : items.map(dto);
    const page = pageOf(view, url);
    return ok({ ...page, totalPages: Math.ceil(page.total / page.limit) });
  }),

  // Taklif §4 — `:id` dan oldin (aks holda `attention` ID deb olinadi).
  http.get(`${API}/admin/wholesalers/attention`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok(attention());
  }),

  http.get(`${API}/admin/wholesalers/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const item = ID.test(String(params.id)) ? find(params.id) : undefined;
    return item ? ok(dto(item)) : fail(404, 'NOT_FOUND', 'Optovik topilmadi');
  }),

  http.post(`${API}/admin/wholesalers`, async ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json()) as Record<string, unknown>;
    const problems = validate(body, false);
    if (problems.length) return invalid(problems);
    if (duplicateTin(text(body.tin))) return fail(409, 'CONFLICT', 'Bu STIR bilan optovik allaqachon bor');
    const item: MockInboundWholesaler = {
      id: String(Math.max(...list().map((entry) => Number(entry.id))) + 1), name: text(body.name), tin: text(body.tin), status: 'ACTIVE',
      contractNumber: text(body.contractNumber) || null, contractDate: text(body.contractDate) || null, ownerUserId: null,
      legalType: body.legalType as MockInboundWholesaler['legalType'], directorName: text(body.directorName) || null, bankName: text(body.bankName),
      bankAccount: text(body.bankAccount), bankMfo: text(body.bankMfo), phone: text(body.phone) || null, address: text(body.address) || null,
      description: text(body.description) || null, moderationNote: null, createdAt: new Date().toISOString(), createdBy: user.name,
      contractFile: null, cabinet: null, contractVersion: null, contractAcceptedAt: null, statusChangedAt: null, statusChangedBy: null,
      suspendReason: null, bankChangeRequest: null, acts: [], history: [],
    };
    list().push(item);
    log(item, user.name, 'wholesaler.create');
    return ok(dto(item), 201);
  }),

  // PATCH (BE-07): faqat berilgan maydonlar; holat faqat faol ↔ to'xtatilgan; STIR takror — 409.
  http.patch(`${API}/admin/wholesalers/:id`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    if (!item) return fail(404, 'NOT_FOUND', 'Optovik topilmadi');
    const body = (await request.json()) as Record<string, unknown>;
    const problems = validate(body, true);
    if (problems.length) return invalid(problems);
    if ('tin' in body && duplicateTin(text(body.tin), item.id)) return fail(409, 'CONFLICT', 'Bu STIR bilan optovik allaqachon bor');
    if ('status' in body) {
      if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') return invalid([{ field: 'status', message: 'status noto‘g‘ri' }]);
      if (item.status !== 'ACTIVE' && item.status !== 'SUSPENDED') return fail(409, 'CONFLICT', `${item.status} holatidagi yozuvni bu yerda o‘zgartirib bo‘lmaydi`);
      // Taklif §1: to'xtatish sababi majburiy (backend `reason` ni bilmasa — u yuborilmaydi).
      if (body.status === 'SUSPENDED' && item.status !== 'SUSPENDED' && 'reason' in body && !text(body.reason)) return invalid([{ field: 'reason', message: 'Sabab majburiy' }]);
      if (item.status !== body.status) {
        item.statusChangedAt = new Date().toISOString();
        item.statusChangedBy = user.name;
        item.suspendReason = body.status === 'SUSPENDED' ? text(body.reason) || null : null;
      }
      item.status = body.status;
    }
    const changes: Record<string, unknown> = {};
    (['name', 'legalType', 'tin', 'bankName', 'bankAccount', 'bankMfo', 'contractNumber', 'contractDate', 'phone', 'address', 'description', 'directorName'] as const).forEach((field) => {
      if (!(field in body)) return;
      changes[field] = text(body[field]) || null;
      (item as unknown as Record<string, unknown>)[field] = text(body[field]) || null;
    });
    if ('status' in body) Object.assign(changes, { status: body.status, ...(text(body.reason) ? { reason: text(body.reason) } : {}) });
    log(item, user.name, 'wholesaler.update', { changes });
    return ok(dto(item));
  }),

  // Taklif §3: shartnoma skani + raqami va sanasi (multipart). PDF/JPEG/PNG, 10 MB gacha (BE-30 hujjatlari kabi).
  http.post(`${API}/admin/wholesalers/:id/contract`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    if (!item) return fail(404, 'NOT_FOUND', 'Optovik topilmadi');
    const form = await request.formData();
    const number = text(form.get('contractNumber'));
    const date = text(form.get('contractDate'));
    const problems = validate({ contractNumber: number, contractDate: date }, false).filter((problem) => problem.field.startsWith('contract'));
    if (problems.length) return invalid(problems);
    // jsdom (Vitest) va brauzer `File` lari boshqa-boshqa — `instanceof` emas, shakli bo'yicha.
    const file = form.get('file');
    if (file && typeof file === 'object') {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return fail(400, 'VALIDATION_ERROR', 'Faqat PDF, JPG yoki PNG', undefined, { details: [{ field: 'file', message: 'type' }] });
      if (file.size > 10 * 1024 * 1024) return fail(413, 'PAYLOAD_TOO_LARGE', 'Fayl 10 MB dan katta');
      item.contractFile = { id: `D-${item.id}${Date.now() % 1000}`, fileName: file.name, uploadedAt: new Date().toISOString(), uploadedBy: user.name };
    }
    item.contractNumber = number;
    item.contractDate = date;
    log(item, user.name, 'wholesaler.contract.upload', { contractNumber: number, contractDate: date, fileName: item.contractFile?.fileName ?? null });
    return ok(dto(item));
  }),

  // BE-30: kabinet egasi — egasi bor bo'lsa 409.
  http.post(`${API}/admin/wholesalers/:id/owner`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    if (!item) return fail(404, 'NOT_FOUND', 'Optovik topilmadi');
    if (item.ownerUserId) return fail(409, 'CONFLICT', 'Optovikning kabinet egasi allaqachon bor');
    const body = (await request.json()) as Record<string, unknown>;
    if (!/^\+998\d{9}$/.test(text(body.phone))) return invalid([{ field: 'phone', message: "phone +998XXXXXXXXX formatida bo'lishi kerak" }]);
    if (!text(body.fullName)) return invalid([{ field: 'fullName', message: 'fullName bo‘sh bo‘lmasligi kerak' }]);
    item.ownerUserId = `U-${9000 + Number(item.id)}`;
    item.cabinet = { phone: text(body.phone), invitedAt: new Date().toISOString(), openedAt: null, lastActiveAt: null };
    log(item, user.name, 'wholesaler.owner.link', { phone: text(body.phone) });
    return ok(dto(item));
  }),

  // BE-30: M2 arizasi — faqat PENDING; rad etishda sabab majburiy.
  http.post(`${API}/admin/wholesalers/:id/review`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    if (!item) return fail(404, 'NOT_FOUND', 'Optovik topilmadi');
    if (item.status !== 'PENDING') return fail(409, 'CONFLICT', 'Optovik PENDING holatida emas');
    const body = (await request.json()) as Record<string, unknown>;
    if (body.decision === 'REJECT' && !text(body.note)) return invalid([{ field: 'note', message: 'Rad etish sababi majburiy' }]);
    item.status = body.decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
    item.statusChangedAt = new Date().toISOString();
    item.moderationNote = body.decision === 'REJECT' ? text(body.note) : null;
    log(item, user.name, 'wholesaler.review', { decision: body.decision, note: text(body.note) || null });
    return ok(dto(item));
  }),

  http.get(`${API}/admin/wholesalers/:id/documents`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    if (!item) return fail(404, 'NOT_FOUND', 'Optovik topilmadi');
    const certificates = db.adminProducts.filter((product) => product.shopId === item.id && product.certificate).map((product) => ({
      id: `C-${product.id}`, wholesalerId: item.id, kind: 'CERTIFICATE' as const, productId: product.id, fileName: product.certificate?.name ?? '',
      contentType: 'application/pdf' as const, size: 240_000, createdAt: product.certificate?.uploadedAt ?? item.createdAt,
    }));
    return ok(certificates);
  }),

  http.post(`${API}/admin/wholesalers/:id/documents/:documentId/link`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok({ url: 'https://files.elchi.example/signed/document.pdf', expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  }),

  // BE-30: kabinetda imzolangan elektron shartnoma. Qog'oz nusxa (skan) — hujjat havolasi (`documents/:id/link`).
  http.post(`${API}/admin/wholesalers/:id/contract/link`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    if (!item?.contractAcceptedAt) return fail(404, 'NOT_FOUND', 'Elektron shartnoma hali imzolanmagan');
    return ok({ url: 'https://files.elchi.example/signed/contract.pdf', expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  }),

  // Taklif §5: optovikka yuboriladigan aktlar va yuborish (kabinetga va/yoki chop etib).
  http.get(`${API}/admin/wholesalers/:id/acts`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    return item ? ok(item.acts) : fail(404, 'NOT_FOUND', 'Optovik topilmadi');
  }),

  http.post(`${API}/admin/wholesalers/:id/acts/:actId/send`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const owner = find(params.id);
    const act = owner?.acts.find((entry) => entry.id === String(params.actId));
    if (!act) return fail(404, 'NOT_FOUND', 'Akt topilmadi');
    const body = (await request.json()) as { channels?: unknown };
    const channels = Array.isArray(body.channels) ? body.channels.filter((value) => value === 'CABINET' || value === 'PRINT') : [];
    if (!channels.length) return invalid([{ field: 'channels', message: 'Kamida bitta yo‘l tanlang' }]);
    act.sentAt = new Date().toISOString();
    if (owner) log(owner, user.name, 'wholesaler.act.send', { code: act.code, channels });
    return ok({ ...act, channels });
  }),

  // BE-33: optovik akt-sverkalari (moliya hisobi; kartadagi «Pul va aktlar» yorlig'i).
  http.get(`${API}/admin/finance/settlements`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, [...ADMIN_ROLES, 'FINANCE']);
    if (denied) return denied;
    const url = new URL(request.url);
    const wholesalerId = url.searchParams.get('wholesalerId');
    const items = list().filter((item) => !wholesalerId || item.id === wholesalerId).flatMap((item) => {
      const act = mockWholesalerMoney(item.id)?.lastAct;
      return act ? [{
        id: act.id, number: act.code, wholesalerId: item.id, periodStart: act.periodFrom, periodEnd: act.periodTo, returnWindowDays: 10,
        status: 'READY', totalAmount: act.transfer, exportedTotal: null, debtDeducted: 0, exportedAt: null, itemsCount: 0, createdAt: act.preparedAt, paidAt: null, paidBy: null,
      }] : [];
    });
    const page = pageOf(items, url);
    return ok({ ...page, totalPages: Math.ceil(page.total / page.limit) });
  }),

  // Audit (BE-07 `wholesaler.*`): optovik bo'yicha — shu yerda; boshqa so'rov keyingi handlerga (mahsulot auditi).
  http.get(`${API}/admin/audit`, ({ request, cookies }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('entityType') !== 'Wholesaler') return undefined;
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const item = find(url.searchParams.get('entityId'));
    const entries = (item?.history ?? []).map((entry) => ({ ...entry, createdAt: entry.at, entityType: 'Wholesaler', entityId: item?.id }));
    return ok(pageOf([...entries].reverse(), url, 50));
  }),

  // BE-33: akt-sverka PDF (moliya) — kartadagi «Pul va aktlar».
  http.get(`${API}/admin/finance/settlements/:id/act.pdf`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies, [...ADMIN_ROLES, 'FINANCE']);
    if (denied) return denied;
    return new Response(samplePdf([`Akt-sverka ${String(params.id)}`, 'Namuna Savdo MChJ', '04.01-10.01.2027']).buffer as ArrayBuffer, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="AS-${String(params.id).padStart(4, '0')}.pdf"` },
    });
  }),

  // Taklif §8: bank rekviziti o'zgarishi — tasdiqlansa yangi hisob yoziladi, rad etilsa so'rov yopiladi.
  http.post(`${API}/admin/wholesalers/:id/bank-change/:requestId/review`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const item = find(params.id);
    const change = item?.bankChangeRequest;
    if (!item || !change || change.id !== String(params.requestId)) return fail(404, 'NOT_FOUND', 'So‘rov topilmadi');
    const body = (await request.json()) as { decision?: unknown };
    if (body.decision === 'APPROVE') Object.assign(item, { bankName: change.bankName, bankMfo: change.bankMfo, bankAccount: change.bankAccount });
    item.bankChangeRequest = null;
    log(item, user.name, 'wholesaler.bank.review', { decision: body.decision });
    return ok(dto(item));
  }),
];

/** Mahsulot qo'shish (BE-07 `createForShop`): shartnomasiz optovikka — 409. */
export function mockWholesalerHasContract(id: string): boolean {
  const item = find(id);
  return Boolean(item && hasContract(item));
}
