import { http } from 'msw';
import { db } from '../db';
import type { MockTask } from '../fixtures/fulfillment';
import { samplePdf } from '../samplePdf';
import { API, fail, ok, tashkentDate } from '../utils';
import { currentMockUser } from './auth';

/**
 * Ombor: yig'ish, qadoq, yorliq va Elchi'ga topshirish (FE-17) — BE-19 qoidalari: ro'yxat `pick_date <= date`,
 * faqat TO_PICK, PICKED, PACKED (vazifa ID tartibida); skan — shtrix-kod yoki SKU, boshqa tovar 409 WRONG_ITEM;
 * qadoq — PICKED dan; yorliq — Elchi posilkasi bo'lsa; akt — hammasi qadoqlangan va Elchi posilkasi bor, aks holda
 * butun akt 409; o'sha QR to'plami — o'sha akt. Taklif maydonlari — docs/api-taklif/fe-17-ombor-yigish.md.
 */
const ROLES = ['ADMIN', 'SUPERADMIN', 'WAREHOUSE'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function guard(request: Request, cookies: Record<string, string>) {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), user: null };
  if (!ROLES.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim ombor va admin uchun'), user: null };
  return { denied: null, user };
}

const data = () => db.fulfillment;
const orderNumber = (orderId: string) => `L-${orderId}`;
const findTask = (id: unknown) => data().tasks.find((item) => item.taskId === String(id));
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const codeOf = (line: { barcode: string; sku: string }) => line.barcode || line.sku;

function taskView(task: MockTask, day: string) {
  const quantity = task.lines.reduce((sum, line) => sum + line.quantity, 0);
  const pickedQty = task.lines.reduce((sum, line) => sum + line.pickedQty, 0);
  const [first] = task.lines;
  return {
    taskId: task.taskId, orderId: task.orderId, orderNumber: orderNumber(task.orderId), status: task.status, pickDate: task.pickDate,
    overdue: task.pickDate < day, productName: first.name, sku: first.sku, barcode: first.barcode, quantity, pickedQty,
    lines: task.lines.map((line) => ({ productName: line.name, sku: line.sku, barcode: line.barcode, quantity: line.quantity, pickedQty: line.pickedQty, cell: line.cell, weightKg: line.weightKg })),
    parcel: {
      elchiState: task.elchiState, shipmentId: task.shipmentId, labelReady: Boolean(task.shipmentId && task.qrCodeToken),
      error: task.elchiState === 'FAILED' ? 'DISTRICT_NOT_FOUND: Tuman topilmadi' : null, qrCodeToken: task.qrCodeToken,
    },
    customerName: task.customerName, regionName: task.regionName, districtName: task.districtName, deliveryMode: task.deliveryMode,
    codAmount: task.codAmount, confirmedAt: task.confirmedAt, packedAt: task.packedAt,
  };
}

function actView(id: string) {
  const act = data().acts.find((item) => item.id === id);
  if (!act) return null;
  const items = act.orderIds.map((orderId) => data().tasks.find((task) => task.orderId === orderId)).filter((task): task is MockTask => Boolean(task));
  return {
    id: act.id, parcelCount: items.length, createdBy: act.createdBy, createdAt: act.createdAt,
    items: items.map((task) => ({ parcelId: task.parcelId, orderId: task.orderId, orderNumber: orderNumber(task.orderId), shipmentId: task.shipmentId ?? '', qrCodeToken: task.qrCodeToken ?? '' })),
  };
}

/** Toshkent vaqti «YYYY-MM-DD HH:MI» (BE-19 `createdAt`). */
function tashkentStamp(date = new Date()) {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${tashkentDate(date.getTime())} ${time}`;
}

export const fulfillmentHandlers = [
  http.get(`${API}/warehouse/pick-list`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const param = new URL(request.url).searchParams.get('date');
    if (param && !DAY.test(param)) return fail(400, 'VALIDATION_ERROR', 'date YYYY-MM-DD bo‘lishi kerak');
    const day = param ?? tashkentDate();
    const items = data().tasks
      .filter((task) => task.pickDate <= day && ['TO_PICK', 'PICKED', 'PACKED'].includes(task.status))
      .sort((a, b) => a.pickDate.localeCompare(b.pickDate) || Number(a.taskId) - Number(b.taskId))
      .map((task) => taskView(task, day));
    return ok({
      date: day,
      items,
      counts: {
        toPick: items.filter((item) => item.status === 'TO_PICK').length,
        picked: items.filter((item) => item.status === 'PICKED').length,
        packed: items.filter((item) => item.status === 'PACKED').length,
        overdue: items.filter((item) => item.overdue).length,
      },
      truncated: false,
    });
  }),

  http.post(`${API}/warehouse/tasks/:id/scan`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const task = findTask(params.id);
    if (!task) return fail(404, 'NOT_FOUND', 'Vazifa topilmadi');
    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    const code = text(body.code);
    if (!code || code.length > 100) return fail(400, 'VALIDATION_ERROR', 'Kod bo‘sh yoki juda uzun');
    if (task.status !== 'TO_PICK') return fail(409, 'INVALID_STATE', `Vazifa holati ${task.status} — skanerlab bo‘lmaydi`);
    const line = task.lines.find((item) => codeOf(item) === code && item.pickedQty < item.quantity);
    if (!line) {
      const known = task.lines.some((item) => codeOf(item) === code);
      return fail(409, 'WRONG_ITEM', known ? `«${code}» — bu tovardan hamma dona yig‘ilgan` : `Boshqa tovar: «${code}» bu buyurtmaga tegishli emas`);
    }
    line.pickedQty += 1;
    const pickedQty = task.lines.reduce((sum, item) => sum + item.pickedQty, 0);
    const quantity = task.lines.reduce((sum, item) => sum + item.quantity, 0);
    if (pickedQty === quantity) task.status = 'PICKED';
    return ok({ taskId: task.taskId, orderId: task.orderId, status: task.status, pickedQty, quantity });
  }),

  http.post(`${API}/warehouse/tasks/:id/pack`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const task = findTask(params.id);
    if (!task) return fail(404, 'NOT_FOUND', 'Vazifa topilmadi');
    if (task.status === 'PACKED') return ok({ taskId: task.taskId, orderId: task.orderId, status: task.status });
    if (task.status !== 'PICKED') return fail(409, 'INVALID_STATE', 'Hali yig‘ilmagan — qadoqlab bo‘lmaydi');
    Object.assign(task, { status: 'PACKED', packedAt: new Date().toISOString() });
    return ok({ taskId: task.taskId, orderId: task.orderId, status: task.status });
  }),

  http.get(`${API}/warehouse/orders/:id/label`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const task = data().tasks.find((item) => item.orderId === String(params.id));
    if (!task) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    if (!task.shipmentId || !task.qrCodeToken) return fail(409, 'CONFLICT', 'Elchi posilkasi hali yaratilmagan');
    const pdf = samplePdf([`Elchi Pochta · ${task.deliveryMode === 'DOOR' ? 'Eshikkacha' : 'Markazgacha'}`, `Trek: ${task.shipmentId}`, `Buyurtma ${orderNumber(task.orderId)}`, `${task.customerName}`, `${task.regionName}, ${task.districtName}`, `QR: ${task.qrCodeToken}`]);
    return new Response(pdf.buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="yorliq-${orderNumber(task.orderId)}.pdf"` } });
  }),

  http.post(`${API}/warehouse/handover-acts`, async ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { qrTokens?: unknown };
    const tokens = Array.isArray(body.qrTokens) ? [...new Set(body.qrTokens.map(text).filter(Boolean))] : [];
    if (!tokens.length || tokens.length > 200) return fail(400, 'VALIDATION_ERROR', '1 dan 200 gacha QR kerak');
    const rows = tokens.map((token) => data().tasks.find((task) => task.qrCodeToken === token));
    // Takror so'rov: aynan o'sha posilkalar bitta aktda topshirilgan — o'sha akt.
    const same = data().acts.find((act) => act.orderIds.length === tokens.length && rows.every((task) => task && act.orderIds.includes(task.orderId)));
    if (same) return ok(actView(same.id), 201);
    const problems = [
      ...tokens.filter((_, index) => !rows[index]).map((token) => `${token}: posilka topilmadi`),
      ...rows.filter((task): task is MockTask => Boolean(task) && task?.status !== 'PACKED').map((task) => `${orderNumber(task.orderId)}: qadoqlanmagan (${task.status})`),
      ...rows.filter((task): task is MockTask => Boolean(task) && !task?.shipmentId).map((task) => `${orderNumber(task.orderId)}: Elchi posilkasi yo‘q`),
    ];
    if (problems.length) return fail(409, 'INVALID_STATE', `Akt tuzilmadi: ${problems.join('; ')}`);
    const id = String(231 + data().acts.length);
    const tasks = rows.filter((task): task is MockTask => Boolean(task));
    tasks.forEach((task) => { task.status = 'HANDED_OVER'; });
    data().acts.unshift({ id, createdBy: user.id, createdAt: tashkentStamp(), orderIds: tasks.map((task) => task.orderId) });
    return ok(actView(id), 201);
  }),

  // Taklif: oldingi aktlar ro'yxati (BE-19 da yo'q).
  http.get(`${API}/warehouse/handover-acts`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    return denied ?? ok({ items: data().acts.map((act) => actView(act.id)), total: data().acts.length, page: 1, limit: 20 });
  }),

  http.get(`${API}/warehouse/handover-acts/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const act = actView(String(params.id));
    return act ? ok(act) : fail(404, 'NOT_FOUND', 'Akt topilmadi');
  }),

  http.get(`${API}/warehouse/handover-acts/:id/pdf`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const act = actView(String(params.id));
    if (!act) return fail(404, 'NOT_FOUND', 'Akt topilmadi');
    const pdf = samplePdf([`Elchi'ga topshirish akti ${act.id}`, `${act.parcelCount} posilka · ${act.createdAt}`, ...act.items.map((item) => `${item.orderNumber} · ${item.shipmentId}`)]);
    return new Response(pdf.buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="topshirish-akti-${act.id}.pdf"` } });
  }),
];
