import { http, HttpResponse } from 'msw';
import type { CreativeType, ModerationSummary, OfferContent, ProductListTab } from '../../features/adminProducts/model/adminProductTypes';
import { creativesOf } from '../catalog';
import { db } from '../db';
import { categorySlug, SLUG_PATTERN } from '../../features/categories/lib/categorySlug';
import { categoryTree, GLOBAL_POLICY, MOCK_SHOP, mockDelivery, mockPricing, TARIFF, type MockAdminProduct, type MockCategory } from '../fixtures/adminProducts';
import { API, fail, ok, pageOf } from '../utils';
import { currentMockUser } from './auth';
import { inboundProductRecords, warehouseStockRows, wholesalerDtos } from './warehouse';

/**
 * Admin: mahsulotlar, moderatsiya, offer sozlash (FE-12). Qoidalar backenddagidek (BE-07 `product.service.ts`,
 * BE-09 `pricing.service.ts`, BE-08 PR #127); taklif qilinganlari — docs/api-taklif/fe-12-admin-moderatsiya.md.
 */

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];

const guard = (request: Request, cookies: Record<string, string>, roles = ADMIN_ROLES) => {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), actor: '' };
  if (!roles.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim admin uchun'), actor: '' };
  return { denied: null, actor: user.name };
};

const findProduct = (id: unknown) => db.adminProducts.find((product) => product.id === String(id));

/** Mock ichki maydonlarisiz; ro'yxatda — taklif qilingan qo'shimchalar (narx, qoldiq, natija, video). */
const INTERNAL_KEYS = ['deliveryMode', 'fixedMaxSalePrice', 'stock', 'results', 'hasVideo'] as const;

function productResponse(product: MockAdminProduct, list = false) {
  const dto: Partial<MockAdminProduct> = { ...product };
  INTERNAL_KEYS.forEach((key) => delete dto[key]);
  if (!list) return { ...dto, results: product.results };
  const pricing = mockPricing(product);
  return {
    ...dto,
    stock: product.stock,
    results: product.results,
    hasVideo: creativesOf(product.id).some((creative) => creative.type === 'VIDEO'),
    listPrice: {
      customer: product.approvedPrice ?? pricing.calculation.recommended, recommended: product.approvedPrice === null,
      delivery: mockDelivery(product).visibleCenter, deliveryMode: product.deliveryMode,
    },
  };
}

function audit(entityId: string, action: string, actorName: string | null, meta: Record<string, unknown> = {}) {
  db.productAudit.unshift({ id: `A-${entityId}-${Date.now()}-${db.productAudit.length}`, entityId, at: new Date().toISOString(), actorName, action, meta });
}

function touch(product: MockAdminProduct, statusChangedBy?: string) {
  const now = new Date().toISOString();
  product.updatedAt = now;
  if (statusChangedBy !== undefined) {
    product.statusChangedAt = now;
    product.statusChangedBy = statusChangedBy;
  }
}

const tabOf = (product: MockAdminProduct): ProductListTab => (product.isBlocked ? 'BLOCKED' : product.status === 'ARCHIVED' || product.status === 'OUT_OF_STOCK' ? 'ACTIVE' : product.status);

function summary(): ModerationSummary {
  const byStatus: ModerationSummary['byStatus'] = { ALL: 0, PENDING_REVIEW: 0, ACTIVE: 0, REJECTED: 0, BLOCKED: 0, DRAFT: 0 };
  db.adminProducts.forEach((product) => {
    byStatus.ALL += 1;
    byStatus[tabOf(product)] += 1;
  });
  return {
    productsPending: byStatus.PENDING_REVIEW,
    // Narx qarori kutayotganlar (FE-13): tasdiqlangan narxi yo'q, arxivlanmagan.
    pricesPending: db.adminProducts.filter((product) => product.approvedPrice === null && product.status !== 'ARCHIVED').length,
    byStatus,
    outOfStock: db.adminProducts.filter((product) => product.status === 'ACTIVE' && product.stock?.available === 0).length,
    expirySoon: 0,
  };
}

const CREATIVE_TYPES: Record<CreativeType, { mimes: string[]; maxSize: number }> = {
  VIDEO: { mimes: ['video/mp4', 'video/webm'], maxSize: 100 * 1024 * 1024 },
  IMAGE: { mimes: ['image/jpeg', 'image/png', 'image/webp'], maxSize: 10 * 1024 * 1024 },
};
const MAX_CREATIVES = 20;
const extensionOf = (mime: string) => mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
type CategoryBody = Partial<MockCategory>;

/** Slug: berilgani (taklif, fe-12 §9) yoki nomdan (backend `toSlug`); qolipga mos va takrorlanmas bo'lishi kerak. */
function slugError(slug: string, ignoredId?: string) {
  if (!slug || !SLUG_PATTERN.test(slug)) return fail(400, 'VALIDATION_ERROR', 'Slug faqat lotin harf, raqam va chiziqchadan iborat bo‘lsin');
  if (db.categories.some((item) => item.slug === slug && item.id !== ignoredId)) return fail(409, 'CONFLICT', 'Bunday slug bilan kategoriya mavjud');
  return null;
}

/** BAD va muddat belgisi (taklif): faqat yuborilgani o'zgaradi, `null` — otadan. */
function applyFlags(category: MockCategory, body: CategoryBody) {
  if (body.isBad !== undefined) category.isBad = body.isBad;
  if (body.expiryTracked !== undefined) category.expiryTracked = body.expiryTracked;
}

const layerUpdatedAt = (id: string) => db.policyAudit.find((entry) => entry.entityId === id && entry.meta.scope === 'CATEGORY')?.createdAt ?? null;

export const adminHandlers = [
  http.get(`${API}/admin/categories`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok(categoryTree(db.categories));
  }),

  // Kategoriya CRUD (backend `category.service.ts`): slug nomdan, takror — 409; ichki kategoriyasi bor — o'chmaydi.
  http.post(`${API}/admin/categories`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as CategoryBody;
    if (!body.name?.trim()) return fail(400, 'VALIDATION_ERROR', 'Nomi majburiy');
    const slug = body.slug ?? categorySlug(body.name);
    const error = slugError(slug);
    if (error) return error;
    const category: MockCategory = {
      id: String(100 + db.categories.length), name: body.name.trim(), slug, parentId: body.parentId ?? null, iconUrl: body.iconUrl ?? null,
      sortOrder: body.sortOrder ?? 0, isActive: body.isActive ?? true, isBad: null, expiryTracked: null,
    };
    applyFlags(category, body);
    db.categories.push(category);
    return ok({ ...category, children: [] }, 201);
  }),
  http.patch(`${API}/admin/categories/:id`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const category = db.categories.find((item) => item.id === params.id);
    if (!category) return fail(404, 'NOT_FOUND', 'Kategoriya topilmadi');
    const body = (await request.json().catch(() => ({}))) as CategoryBody;
    if (body.name !== undefined || body.slug !== undefined) {
      const slug = body.slug ?? categorySlug(body.name ?? category.name);
      const error = slugError(slug, category.id);
      if (error) return error;
      Object.assign(category, { name: body.name?.trim() ?? category.name, slug });
    }
    applyFlags(category, body);
    if (body.parentId !== undefined) category.parentId = body.parentId;
    if (body.iconUrl !== undefined) category.iconUrl = body.iconUrl;
    if (body.sortOrder !== undefined) category.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) category.isActive = body.isActive;
    return ok({ ...category, children: [] });
  }),
  http.delete(`${API}/admin/categories/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    if (db.categories.some((item) => item.parentId === params.id)) return fail(409, 'CONFLICT', 'Ichki kategoriyalari bor kategoriyani o‘chirib bo‘lmaydi');
    if (db.adminProducts.some((product) => product.categoryId === params.id)) return fail(409, 'CONFLICT', 'Mahsuloti bor kategoriyani o‘chirib bo‘lmaydi');
    db.categories = db.categories.filter((item) => item.id !== params.id);
    return ok({ id: params.id, deleted: true });
  }),

  // Narx sozlamasi (BE-09): global — to'liq; kategoriya — qatlam (null — globaldan). O'zgartirish — SUPERADMIN.
  http.get(`${API}/admin/pricing/policy`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok({ scope: 'GLOBAL', scopeId: null, ...GLOBAL_POLICY, updatedBy: 'U-0008', updatedAt: '2026-11-01T05:00:00.000Z' });
  }),
  http.get(`${API}/admin/pricing/policy/categories/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const layer = db.categoryPolicies[String(params.id)] ?? {};
    const values = Object.fromEntries(Object.keys(GLOBAL_POLICY).map((key) => [key, (layer as Record<string, unknown>)[key] ?? null]));
    const updatedAt = layerUpdatedAt(String(params.id));
    return ok({ scope: 'CATEGORY', scopeId: String(params.id), ...values, updatedBy: updatedAt ? '7' : null, updatedAt });
  }),
  http.put(`${API}/admin/pricing/policy/categories/:id`, async ({ request, cookies, params }) => {
    const user = currentMockUser(request, cookies);
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
    if (user.role !== 'SUPERADMIN') return fail(403, 'FORBIDDEN', 'Narx sozlamasini faqat superadmin o‘zgartiradi');
    const body = (await request.json().catch(() => ({}))) as Partial<typeof GLOBAL_POLICY>;
    const id = String(params.id);
    const before = { ...db.categoryPolicies[id] };
    db.categoryPolicies[id] = { ...before, ...body };
    const after = { ...db.categoryPolicies[id] };
    db.policyAudit.unshift({
      id: `A-P-${id}-${db.policyAudit.length + 1}`, createdAt: new Date().toISOString(), actorId: user.id, actorName: user.name, action: 'pricing.policy.update',
      entityType: 'PricePolicy', entityId: id, meta: { scope: 'CATEGORY', before, after },
    });
    return ok({ scope: 'CATEGORY', scopeId: id, ...after });
  }),
  // Elchi tariflari (NRX-7): tarix, eng yangisi birinchi.
  http.get(`${API}/admin/pricing/elchi-tariffs`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok([{ id: '1', ...TARIFF, effectiveFrom: '2026-11-01T00:00:00.000+05:00', isDeleted: false }]);
  }),

  // Optoviklar (BE-07) — FE-16 fixture'idan; omborchi ham o'qiydi (taklif: arizasiz postavka, fe-16 §4).
  http.get(`${API}/admin/wholesalers`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, [...ADMIN_ROLES, 'WAREHOUSE']);
    return denied ?? ok(pageOf(wholesalerDtos(), new URL(request.url)));
  }),

  http.get(`${API}/admin/moderation/summary`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok(summary());
  }),

  http.get(`${API}/admin/products`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, [...ADMIN_ROLES, 'WAREHOUSE']);
    if (denied) return denied;
    const url = new URL(request.url);
    // Boshqa optovik (FE-16 fixture'i: Namuna Farm, Barakat) — o'z SKU lari.
    const shopId = url.searchParams.get('shopId');
    if (shopId && shopId !== MOCK_SHOP.id) return ok(pageOf(inboundProductRecords(shopId), url));
    const status = url.searchParams.get('status');
    const blocked = url.searchParams.get('blocked');
    const search = url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? '';
    const categoryId = url.searchParams.get('categoryId');
    const cpaEnabled = url.searchParams.get('cpaEnabled');
    const attention = url.searchParams.get('attention');
    const items = db.adminProducts
      .filter((product) => !status || product.status === status)
      .filter((product) => blocked === null || String(product.isBlocked) === blocked)
      .filter((product) => !search || `${product.name} ${product.slug}`.toLocaleLowerCase().includes(search))
      .filter((product) => !categoryId || product.categoryId === categoryId)
      .filter((product) => cpaEnabled === null || String(product.cpaEnabled) === cpaEnabled)
      .filter((product) => attention !== 'OUT_OF_STOCK' || (product.status === 'ACTIVE' && product.stock?.available === 0))
      .filter(() => attention !== 'EXPIRY_SOON')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((product) => productResponse(product, true));
    return ok(pageOf(items, url));
  }),

  http.get(`${API}/admin/products/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    return product ? ok(productResponse(product)) : fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
  }),

  // BE-07 `adminApprove`: holat, majburiy maydonlar va optovik shartnomasi tekshiriladi.
  http.post(`${API}/admin/products/:id/approve`, ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    if (product.status === 'ACTIVE') return fail(409, 'CONFLICT', 'Mahsulot allaqachon tasdiqlangan');
    if (!['PENDING_REVIEW', 'REJECTED', 'DRAFT'].includes(product.status)) return fail(409, 'CONFLICT', `${product.status} holatidagi mahsulotni tasdiqlab bo‘lmaydi`);
    if (product.basePrice === null || !product.weightGrams || !product.lengthMm || !product.widthMm || !product.heightMm) {
      return fail(400, 'VALIDATION_ERROR', 'Tasdiqdan oldin bazaviy narx, og‘irlik va o‘lchamlarni kiriting');
    }
    if (product.shop?.hasContract === false) return fail(409, 'CONFLICT', 'Optovik faol emas yoki shartnomasi kiritilmagan — tasdiqlab bo‘lmaydi');
    const from = product.status;
    product.status = 'ACTIVE';
    product.moderationNote = null;
    touch(product, actor);
    audit(product.id, 'product.approve', actor, { from, to: 'ACTIVE' });
    return ok(productResponse(product));
  }),

  http.post(`${API}/admin/products/:id/reject`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
    const text = reason?.trim() ?? '';
    if (!text || text.length > 500) return fail(400, 'VALIDATION_ERROR', 'Sabab majburiy (500 belgigacha)');
    if (product.status === 'REJECTED') return fail(409, 'CONFLICT', 'Mahsulot allaqachon rad etilgan');
    const from = product.status;
    product.status = 'REJECTED';
    product.moderationNote = text;
    touch(product, actor);
    audit(product.id, 'product.reject', actor, { from, to: 'REJECTED', reason: text });
    return ok(productResponse(product));
  }),

  http.post(`${API}/admin/products/:id/hide`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
    const text = reason?.trim() ?? '';
    if (!text || text.length > 500) return fail(400, 'VALIDATION_ERROR', 'Sabab majburiy (500 belgigacha)');
    if (product.isBlocked) return fail(409, 'CONFLICT', 'Mahsulot allaqachon yashirilgan');
    product.isBlocked = true;
    product.blockReason = text;
    touch(product, actor);
    audit(product.id, 'product.hide', actor, { reason: text });
    return ok(productResponse(product));
  }),

  http.post(`${API}/admin/products/:id/reactivate`, ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    if (!product.isBlocked) return fail(409, 'CONFLICT', 'Mahsulot bloklanmagan');
    product.isBlocked = false;
    product.blockReason = null;
    touch(product, actor);
    audit(product.id, 'product.reactivate', actor);
    return ok(productResponse(product));
  }),

  http.patch(`${API}/admin/products/:id`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const patch = (await request.json().catch(() => ({}))) as { cpaEnabled?: boolean; isBad?: boolean };
    const unknown = Object.keys(patch).filter((key) => !['cpaEnabled', 'isBad'].includes(key));
    if (unknown.length) return fail(400, 'VALIDATION_ERROR', `property ${unknown[0]} should not exist`);
    if (typeof patch.cpaEnabled === 'boolean') product.cpaEnabled = patch.cpaEnabled;
    if (typeof patch.isBad === 'boolean') product.isBad = patch.isBad;
    touch(product);
    audit(product.id, 'product.update', actor, { changes: patch });
    return ok(productResponse(product));
  }),

  http.get(`${API}/admin/products/:id/pricing`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const url = new URL(request.url);
    const number = (key: string) => (url.searchParams.has(key) ? Number(url.searchParams.get(key)) : undefined);
    return ok(mockPricing(product, { price: number('price'), affiliateFee: number('affiliateFee') }));
  }),

  http.get(`${API}/admin/products/:id/price-decisions`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const history = db.priceDecisions[product.id] ?? (product.approvedPrice === null ? [] : [{
      id: `PD-${product.id}`, productId: product.id, price: product.approvedPrice, basePrice: product.basePrice ?? 0, affiliateFee: product.affiliateFee ?? 0,
      recommended: mockPricing(product).calculation.recommended, status: 'GREEN' as const, reason: null, decidedBy: 'U-0007',
      decidedByName: 'Nodira Karimova', createdAt: product.statusChangedAt ?? product.updatedAt,
    }]);
    return ok(history);
  }),

  // BE-09 `decide`: qizil — saqlanmaydi; to'q sariq — sabab majburiy. Haq o'zgarishi ham shu yerdan (taklif, 6-bo'lim).
  http.post(`${API}/admin/products/:id/price-decision`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const body = (await request.json().catch(() => ({}))) as { price?: number; affiliateFee?: number; reason?: string };
    if (!Number.isInteger(body.price) || (body.affiliateFee !== undefined && !Number.isInteger(body.affiliateFee))) return fail(400, 'VALIDATION_ERROR', 'Narx va haq butun so‘mda');
    const pricing = mockPricing(product, { price: body.price, affiliateFee: body.affiliateFee });
    const status = pricing.evaluation?.status ?? 'GREEN';
    const reason = body.reason?.trim() || null;
    if (status === 'RED') return fail(400, 'VALIDATION_ERROR', 'Qizil narx: har bir buyurtma sotilsa ham platforma zarar ko‘radi — saqlanmaydi');
    if (status === 'ORANGE' && !reason) return fail(400, 'VALIDATION_ERROR', 'To‘q sariq narx: sabab majburiy (platforma yoki sotuvchi zarar ko‘radi)');
    const previousFee = product.affiliateFee;
    product.approvedPrice = body.price ?? product.approvedPrice;
    product.price = product.approvedPrice ?? product.price;
    product.priceStatus = status;
    product.affiliateFee = body.affiliateFee ?? product.affiliateFee;
    touch(product);
    const decision = {
      id: `PD-${product.id}-${Date.now()}`, productId: product.id, price: product.approvedPrice ?? 0, basePrice: product.basePrice ?? 0,
      affiliateFee: product.affiliateFee ?? 0, recommended: pricing.calculation.recommended, status, reason,
      decidedBy: 'U-0007', decidedByName: actor, createdAt: new Date().toISOString(),
    };
    db.priceDecisions[product.id] = [decision, ...(db.priceDecisions[product.id] ?? [])];
    audit(product.id, 'price.decision', actor, { price: decision.price, affiliateFee: decision.affiliateFee, previousFee, status, reason });
    return ok({ decision, ...pricing }, 201);
  }),

  http.get(`${API}/admin/offer-content/:productId`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const productId = String(params.productId);
    const empty: OfferContent = { productId, callScript: null, highlights: [], boxContents: [], updatedAt: new Date(0).toISOString() };
    return ok(db.offerContents[productId] ?? empty);
  }),

  // Backend `updateContent`: bo'sh qatorlar tashlanadi; skript berilmasa — o'zgarmaydi.
  http.put(`${API}/admin/offer-content/:productId`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const productId = String(params.productId);
    const body = (await request.json().catch(() => ({}))) as Partial<OfferContent>;
    if (!Array.isArray(body.highlights) || !Array.isArray(body.boxContents)) return fail(400, 'VALIDATION_ERROR', 'highlights va boxContents ro‘yxat bo‘lishi kerak');
    if (body.highlights.length > 10 || body.boxContents.length > 20) return fail(400, 'VALIDATION_ERROR', 'Qatorlar soni chegaradan ko‘p');
    if ([...body.highlights, ...body.boxContents].some((line) => line.length > 200)) return fail(400, 'VALIDATION_ERROR', 'Har qator 200 belgigacha');
    if ((body.callScript?.length ?? 0) > 5000) return fail(400, 'VALIDATION_ERROR', 'Skript 5 000 belgigacha');
    const clean = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean);
    const previous = db.offerContents[productId];
    const saved: OfferContent = {
      productId,
      callScript: body.callScript === undefined ? previous?.callScript ?? null : body.callScript?.trim() || null,
      highlights: clean(body.highlights),
      boxContents: clean(body.boxContents),
      updatedAt: new Date().toISOString(),
    };
    db.offerContents[productId] = saved;
    audit(productId, 'offer.content', actor, { script: body.callScript !== undefined });
    return ok(saved);
  }),

  http.get(`${API}/admin/products/:id/creatives`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    if (!findProduct(params.id)) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    return ok([...creativesOf(String(params.id))].sort((a, b) => a.position - b.position));
  }),

  // BE-08: imzolangan POST policy — fayl tur va hajmi tekshiriladi, kalitni server tanlaydi.
  http.post(`${API}/admin/products/:id/creatives/upload`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const body = (await request.json().catch(() => ({}))) as { type?: CreativeType; contentType?: string; size?: number };
    const rule = body.type ? CREATIVE_TYPES[body.type] : undefined;
    if (!rule || !body.contentType || !rule.mimes.includes(body.contentType)) return fail(400, 'VALIDATION_ERROR', 'Fayl turi ruxsat etilmagan');
    if (!body.size || body.size > rule.maxSize) return fail(400, 'VALIDATION_ERROR', `Fayl hajmi ${Math.round(rule.maxSize / 1024 / 1024)} MB dan oshmasin`);
    if (creativesOf(product.id).length >= MAX_CREATIVES) return fail(409, 'CONFLICT', `Mahsulotga ${MAX_CREATIVES} tagacha kreativ`);
    const objectKey = `creative-uploads/${product.id}/${crypto.randomUUID()}.${extensionOf(body.contentType)}`;
    db.uploads.set(objectKey, { productId: product.id, type: body.type as CreativeType, contentType: body.contentType, size: body.size, uploaded: false });
    return ok({
      url: `${new URL(request.url).origin}/api/v1/__mock-storage/creatives`,
      fields: { key: objectKey, 'Content-Type': body.contentType, policy: 'mock-policy', 'x-amz-signature': 'mock' },
      objectKey,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      maxSize: rule.maxSize,
    });
  }),

  // Ombor (MinIO) o'rnida: `multipart/form-data`, `key` maydoni bilan.
  http.post(`${API}/__mock-storage/creatives`, async ({ request }) => {
    const form = await request.formData().catch(() => null);
    const key = form?.get('key');
    const upload = typeof key === 'string' ? db.uploads.get(key) : undefined;
    if (!upload || !(form?.get('file') instanceof File)) return new HttpResponse('<Error><Code>AccessDenied</Code></Error>', { status: 403 });
    upload.uploaded = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/admin/products/:id/creatives`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const product = findProduct(params.id);
    if (!product) return fail(404, 'NOT_FOUND', 'Mahsulot topilmadi');
    const { objectKey } = (await request.json().catch(() => ({}))) as { objectKey?: string };
    const upload = objectKey ? db.uploads.get(objectKey) : undefined;
    if (!upload || upload.productId !== product.id || !upload.uploaded) return fail(400, 'VALIDATION_ERROR', 'Fayl yo‘q yoki mos emas');
    const library = creativesOf(product.id);
    if (library.length >= MAX_CREATIVES) return fail(409, 'CONFLICT', `Mahsulotga ${MAX_CREATIVES} tagacha kreativ`);
    const id = `${product.id}-${Date.now().toString(36)}`;
    const creative = {
      id, productId: product.id, type: upload.type, url: `https://cdn.elchi.example/creatives/${id}.${extensionOf(upload.contentType)}`,
      mimeType: upload.contentType, size: upload.size, position: library.reduce((max, item) => Math.max(max, item.position + 1), 0),
      createdAt: new Date().toISOString(), caption: null, durationSec: upload.type === 'VIDEO' ? 30 : null,
    };
    db.creatives[product.id] = [...library, creative];
    db.uploads.delete(objectKey as string);
    audit(product.id, 'creative.create', actor, { type: creative.type });
    return ok(creative, 201);
  }),

  http.delete(`${API}/admin/products/:id/creatives/:creativeId`, async ({ request, cookies, params }) => {
    const { denied, actor } = guard(request, cookies);
    if (denied) return denied;
    const library = creativesOf(String(params.id));
    const creative = library.find((item) => item.id === params.creativeId);
    if (!creative) return fail(404, 'NOT_FOUND', 'Kreativ topilmadi');
    // Sabab — taklif (fe-12 §5): tanada keladi va auditga yoziladi.
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    db.creatives[String(params.id)] = library.filter((item) => item.id !== creative.id);
    audit(String(params.id), 'creative.delete', actor, { type: creative.type, ...(body.reason ? { reason: body.reason } : {}) });
    return ok({ deleted: true });
  }),

  // Taklif (3-bo'lim): `entityType` + `entityId` bo'yicha mahsulot auditi; filtrsiz — umumiy jurnal (hozircha bo'sh).
  http.get(`${API}/admin/audit`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const entityId = url.searchParams.get('entityId');
    const action = url.searchParams.get('action');
    // Narx sozlamasi tarixi: backend `action` filtri bilan (kategoriya ekranda ajratiladi).
    if (action === 'pricing.policy.update') return ok(pageOf(db.policyAudit, url, 20));
    const items = entityId
      ? db.productAudit.filter((entry) => entry.entityId === entityId).map((entry) => ({
        id: entry.id, createdAt: entry.at, actorName: entry.actorName, action: entry.action, meta: entry.meta, entityType: 'Product', entityId: entry.entityId,
      }))
      : [];
    return ok(pageOf(items, url, 50));
  }),

  // Mahsulot kartasidagi «Qoldiq» (FE-12): bitta ombor, offerdagi sonlar. Mahsulotsiz `stock` — omborchi va admin
  // «Qoldiq» sahifasi (FE-16, BE-16: ADMIN, WAREHOUSE, SUPERADMIN); harakatlar — bo'sh ro'yxat.
  http.get(`${API}/admin/inventory/:kind`, ({ request, cookies, params }) => {
    const url = new URL(request.url);
    const user = currentMockUser(request, cookies);
    if (params.kind === 'stock' && !url.searchParams.get('productId') && user && ['ADMIN', 'SUPERADMIN', 'WAREHOUSE'].includes(user.role)) {
      return ok({ ...pageOf(warehouseStockRows(url.searchParams.get('shopId')), url, 100), warnings: [], searchTruncated: false });
    }
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const product = params.kind === 'stock' ? findProduct(url.searchParams.get('productId')) : undefined;
    const rows = product?.stock ? [{
      shopId: product.shopId, warehouseId: '1', warehouseName: 'Toshkent ombori', warehouseActive: true, variantId: `${product.id}01`,
      productName: product.name, variantName: null, sku: `4780012${product.id}677`, catalogMissing: false,
      onHand: product.stock.onHand, reserved: product.stock.reserved, available: product.stock.available, lowStockThreshold: 5, updatedAt: product.updatedAt,
    }] : [];
    return ok({ ...pageOf(rows, url), warnings: [], searchTruncated: false });
  }),
];
