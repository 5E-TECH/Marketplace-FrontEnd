import { http, HttpResponse } from 'msw';
import type { AdminLeadCard, AdminLeadListItem, LeadTab } from '../../features/adminLeads/model/adminLeadTypes';
import { LEAD_TAB_STATUSES } from '../../features/adminLeads/model/adminLeadTypes';
import { isCancelable } from '../../features/orders/lib/orderStatus';
import type { OrderListItem, OrderStatus } from '../../features/orders/model/orderTypes';
import type { LeadCard, LeadStatus } from '../../features/operator/model/operatorTypes';
import { MOCK_PRODUCTS } from '../db';
import { REGION_TREE } from '../fixtures/regions';
import { addMockOperatorLoad, affiliateOfStream, districtOf, listItem, MOCK_AFFILIATES, MOCK_OPERATORS, onMockOrdersReset, orderDetail, orderStore, type MockOrder } from '../orderStore';
import { samplePdf } from '../samplePdf';
import { API, fail, ok, seeded } from '../utils';
import { currentMockUser } from './auth';
import { mockOfferOf, mockOperatorLeads, mockOperatorState, mockOwnedByMe, mockQueueOperator, mockStreamOf, releaseMockStock, updateMockOperatorLead } from './operator';

/**
 * FE-26: admin va nazoratchi — lidlar, buyurtmalar, bekor qilish (BE-13/BE-18/BE-35/BE-42) + taklif maydonlari.
 * Lidlar — operator mock store'idagilar (operator ish joyi bilan bir xil) + tarixiy lidlar va buyurtmalar lidlari.
 */
const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();
const ADMIN = ['ADMIN', 'SUPERADMIN'];
const STAFF = ['ADMIN', 'SUPERADMIN', 'SUPERVISOR'];

const guard = (request: Request, cookies: Record<string, string>, roles: readonly string[]) => {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), user: null };
  if (!roles.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim uchun ruxsat yo‘q'), user };
  return { denied: null, user };
};
const shortName = (name: string) => {
  const [first = '', last = ''] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};
const fieldError = (field: string, message: string) => fail(400, 'VALIDATION_ERROR', message, undefined, { details: [{ field, error: message }] });

// ── Lidlar ───────────────────────────────────────────────────────────────────

interface ExtraLead {
  id: string; name: string; district: string; street: string; stream: string; status: LeadStatus; minutesAgo: number;
  operator: string | null; attempts: number; note?: string; rejectedMinutesAgo?: number; mergedInto?: string; review?: boolean; callbackInMinutes?: number;
}

/** Tarixiy lidlar (admin-lidlar namunasi) — operator navbatida yo'q. */
const EXTRA: readonly ExtraLead[] = [
  { id: 'L-1279', name: 'Malika', district: '1718401', street: 'Registon ko‘chasi, 12-uy', stream: 'p3v9tx', status: 'CALLBACK', minutesAgo: 32, operator: 'Dilnoza R.', attempts: 1, callbackInMinutes: 43 },
  { id: 'L-1272', name: 'Sardor', district: '1714401', street: 'Navoiy ko‘chasi, 3-uy', stream: 'k7m2qa', status: 'CALLBACK', minutesAgo: 77, operator: 'Dilnoza R.', attempts: 1, callbackInMinutes: 173 },
  { id: 'L-1270', name: 'Nilufar', district: '1727401', street: 'Yoshlik ko‘chasi, 5-uy', stream: 'd2h6va', status: 'REJECTED', minutesAgo: 100, operator: 'Shohruh M.', attempts: 1, note: '«Qimmat»', rejectedMinutesAgo: 90 },
  { id: 'L-1268', name: 'Javlon', district: '1710401', street: 'Mustaqillik ko‘chasi, 1-uy', stream: 'r9c4mn', status: 'INVALID', minutesAgo: 126, operator: 'Feruza Y.', attempts: 1, note: 'noto‘g‘ri raqam' },
  { id: 'L-1267', name: 'Dildora', district: '1703401', street: 'Bobur shoh ko‘chasi, 2-uy', stream: 'k7m2qa', status: 'MERGED', minutesAgo: 147, operator: 'Feruza Y.', attempts: 1, note: 'L-1163 ga birlashtirildi', mergedInto: 'L-1163' },
  { id: 'L-1019', name: 'Bekzod', district: '1706401', street: 'Navoiy ko‘chasi, 8-uy', stream: 'v5d8nq', status: 'REJECTED', minutesAgo: 6900, operator: 'Lola A.', attempts: 2, note: '«Kerak emas»', rejectedMinutesAgo: 6800 },
  { id: 'L-1067', name: 'Umid', district: '1722401', street: 'Termiz ko‘chasi, 4-uy', stream: 'p3v9tx', status: 'NO_CONTACT', minutesAgo: 4600, operator: 'Umida S.', attempts: 6, note: '6 urinish' },
  ...['L-1295', 'L-1296', 'L-1297', 'L-1298', 'L-1299', 'L-1300', 'L-1301'].map((id, index): ExtraLead => ({
    id, name: ['Azamat', 'Bobur', 'Diyor', 'Elyor', 'Farrux', 'G‘ayrat', 'Hamid'][index], district: '1726294', street: '—', stream: 'h2q7vz',
    status: 'NEW', minutesAgo: 120 - index, operator: null, attempts: 0, review: true,
  })),
];

function fromOperator(lead: LeadCard): AdminLeadListItem {
  const stream = mockStreamOf(lead.id);
  const affiliate = affiliateOfStream(stream);
  const last = lead.attempts.at(-1);
  const owned = mockOwnedByMe(lead.id) && (lead.status === 'BOOKED' || lead.status === 'CALLBACK');
  return {
    id: lead.id, createdAt: lead.createdAt, status: lead.status, source: lead.source, customerName: lead.customerName, phoneMasked: lead.phoneMasked,
    productName: lead.product.name, affiliateName: affiliate.name, operatorName: owned ? 'Dilnoza R.' : last?.operatorName ?? null, orderId: lead.orderId,
    productId: lead.product.id, regionName: lead.address?.regionName ?? null, streamCode: stream, salePrice: lead.product.salePrice, attemptsCount: lead.attemptsCount,
    operatorId: owned ? 'U-0003' : null, closedNote: lead.rejectReason ? `«${lead.rejectReason}»` : null, callbackAt: lead.status === 'CALLBACK' ? lead.nextAttemptAt : null, inReview: false,
    statusAt: lead.history.at(-1)?.at ?? lead.createdAt,
  };
}

function fromExtra(extra: ExtraLead): AdminLeadListItem {
  const place = districtOf(extra.district);
  const affiliate = affiliateOfStream(extra.stream);
  const operator = MOCK_OPERATORS.find((item) => item.name === extra.operator);
  return {
    id: extra.id, createdAt: ago(extra.minutesAgo), status: extra.status, source: 'LANDING', customerName: extra.name,
    phoneMasked: `+998 9${seeded(extra.id, 0, 9)} *** ** ${seeded(`${extra.id}:p`, 10, 99)}`, productName: MOCK_PRODUCTS[0].name, affiliateName: affiliate.name,
    operatorName: extra.operator, orderId: null, productId: MOCK_PRODUCTS[0].id, regionName: place.regionName, streamCode: extra.stream, salePrice: 262_000,
    attemptsCount: extra.attempts, operatorId: operator?.id ?? null, closedNote: extra.note ?? null,
    rejectedAt: extra.rejectedMinutesAgo !== undefined ? ago(extra.rejectedMinutesAgo) : null,
    callbackAt: extra.callbackInMinutes !== undefined ? new Date(Date.now() + extra.callbackInMinutes * MINUTE).toISOString() : null, inReview: Boolean(extra.review),
    statusAt: extra.rejectedMinutesAgo !== undefined ? ago(extra.rejectedMinutesAgo) : ago(Math.max(0, extra.minutesAgo - 10)),
  };
}

function fromOrder(order: MockOrder): AdminLeadListItem {
  const place = districtOf(order.districtSoato);
  return {
    id: order.leadId, createdAt: order.leadCreatedAt, status: 'CONFIRMED', source: 'LANDING', customerName: order.name, phoneMasked: listItem(order).phoneMasked ?? '',
    productName: order.product.name, affiliateName: order.stream.affiliateName, operatorName: order.confirmedBy.name, orderId: order.id, productId: order.product.id,
    regionName: place.regionName, streamCode: order.stream.code, salePrice: order.unitPrice, attemptsCount: 1, operatorId: order.confirmedBy.id, inReview: false,
    statusAt: order.confirmedBy.at,
  };
}

/** Admin amallari (qayta ochish, o'tkazish) tarixiy lidlarni ham o'zgartiradi. */
const extraState = new Map<string, Partial<AdminLeadListItem> & { history?: LeadCard['history'] }>();

function allLeads(): AdminLeadListItem[] {
  const seen = new Set<string>();
  const rows: AdminLeadListItem[] = [];
  for (const lead of mockOperatorLeads()) {
    seen.add(lead.id);
    const row = fromOperator(lead);
    // O'tkazilgan lid: bron yoki qo'ng'iroq yangi operatorda (bron tugab navbatga qaytsa — egasiz).
    const moved = extraState.get(lead.id);
    rows.push(moved && (row.status === 'BOOKED' || row.status === 'CALLBACK') ? { ...row, operatorName: moved.operatorName ?? row.operatorName, operatorId: moved.operatorId ?? row.operatorId } : row);
  }
  for (const extra of EXTRA) {
    if (seen.has(extra.id)) continue;
    seen.add(extra.id);
    const changed = extraState.get(extra.id);
    rows.push({ ...fromExtra(extra), ...changed, ...(changed?.history?.length ? { statusAt: changed.history.at(-1)?.at } : {}) });
  }
  for (const order of orderStore().orders.values()) {
    if (seen.has(order.leadId)) continue;
    seen.add(order.leadId);
    rows.push(fromOrder(order));
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Taklif `queuePosition`: navbat tartibi — eng yangi lid birinchi (7-qoida), tekshiruvdagilar navbatda emas.
  const queue = rows.filter((row) => row.status === 'NEW' && !row.inReview);
  return rows.map((row) => (row.status === 'NEW' && !row.inReview ? { ...row, queuePosition: queue.indexOf(row) + 1 } : row));
}

const tabOf = (lead: AdminLeadListItem): Exclude<LeadTab, 'ALL'> => {
  if (lead.inReview) return 'REVIEW';
  return (Object.entries(LEAD_TAB_STATUSES) as Array<[Exclude<LeadTab, 'ALL' | 'REVIEW'>, readonly LeadStatus[]]>).find(([, statuses]) => statuses.includes(lead.status))?.[0] ?? 'ACTIVE';
};

function filterLeads(url: URL, admin: boolean) {
  const p = url.searchParams;
  const search = (p.get('search') ?? '').trim().toLowerCase();
  const digits = search.replace(/\D/g, '');
  const from = p.get('from');
  const to = p.get('to');
  return allLeads().filter((lead) => {
    const day = lead.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (p.get('productId') && lead.productId !== p.get('productId')) return false;
    if (p.get('operatorId') && lead.operatorId !== p.get('operatorId')) return false;
    if (p.get('affiliateId') && affiliateOfStream(lead.streamCode ?? '').id !== p.get('affiliateId')) return false;
    if (p.get('source') && lead.source !== p.get('source')) return false;
    if (p.get('status') && lead.status !== p.get('status')) return false;
    if (!search) return true;
    // Telefon bo'yicha qidiruv — faqat admin (BE-42): harfsiz, kamida 7 raqam, to'liq raqamning oxiri bo'yicha.
    if (/^[\d\s()+-]+$/.test(search) && digits.length >= 7) return admin && mockFullPhone(lead.id).replace(/\D/g, '').endsWith(digits.slice(-9));
    return [lead.id, lead.customerName, lead.streamCode ?? ''].some((value) => value.toLowerCase().includes(search));
  });
}

const SORTS: Record<string, (a: AdminLeadListItem, b: AdminLeadListItem) => number> = {
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  price: (a, b) => (a.salePrice ?? 0) - (b.salePrice ?? 0),
  attempts: (a, b) => (a.attemptsCount ?? 0) - (b.attemptsCount ?? 0),
};

/** Mock: lidning to'liq raqami (admin kartasi va telefon bo'yicha qidiruv uchun). */
const mockFullPhone = (id: string) => `+998 90 ${id.slice(2, 5)} ${id.slice(-2)} ${seeded(id, 10, 99)}`;

function leadCard(id: string, admin: boolean): AdminLeadCard | null {
  const operatorLead = mockOperatorLeads().find((item) => item.id === id);
  const row = allLeads().find((item) => item.id === id);
  if (!row) return null;
  const order = [...orderStore().orders.values()].find((item) => item.leadId === id) ?? null;
  const stream = row.streamCode ?? mockStreamOf(id);
  const affiliate = affiliateOfStream(stream);
  const offer = mockOfferOf(row.productId ?? '501');
  const extra = EXTRA.find((item) => item.id === id);
  const place = extra ? districtOf(extra.district) : null;
  const base: LeadCard = operatorLead ?? {
    id, status: row.status, source: row.source, customerName: row.customerName, phoneMasked: row.phoneMasked,
    product: { id: row.productId ?? '501', name: row.productName, salePrice: row.salePrice ?? 262_000 }, quantity: 1,
    address: order ? { regionSoato: order.regionSoato, regionName: districtOf(order.districtSoato).regionName, districtSoato: order.districtSoato, districtName: districtOf(order.districtSoato).districtName, addressLine: order.addressLine, whereDeliver: order.whereDeliver, confirmedAt: order.confirmedBy.at, editedByOperator: Boolean(order.original) }
      : place && extra ? { regionSoato: place.regionSoato, regionName: place.regionName, districtSoato: extra.district, districtName: place.districtName, addressLine: extra.street, whereDeliver: 'CENTER', confirmedAt: null, editedByOperator: false } : null,
    price: { unitPrice: row.salePrice ?? 262_000, quantity: 1, subtotal: row.salePrice ?? 262_000, whereDeliver: 'CENTER', deliveryFee: 30_000, totalAmount: (row.salePrice ?? 262_000) + 30_000 },
    rejectReason: null, callScript: null, stockShortage: false, blacklistRejections: null, attemptsCount: row.attemptsCount ?? 0,
    bookedUntil: null, nextAttemptAt: row.callbackAt ?? null, orderId: order?.id ?? null,
    attempts: Array.from({ length: Math.min(row.attemptsCount ?? 0, 6) }, (_, index) => ({ at: ago((extra?.minutesAgo ?? 60) - 4 - index * 30), operatorName: row.operatorName ?? 'Dilnoza R.', outcome: ({ NO_CONTACT: 'NO_ANSWER', CONFIRMED: 'CONFIRMED', REJECTED: 'REJECTED', INVALID: 'INVALID', MERGED: 'DUPLICATE' } as const)[row.status as 'NO_CONTACT'] ?? 'CALL_LATER' as const, comment: null })),
    history: [
      { at: row.createdAt, fromStatus: null, toStatus: 'NEW', actor: 'Tizim', note: null },
      ...(row.status !== 'NEW' ? [{ at: ago((extra?.minutesAgo ?? 60) - 4), fromStatus: 'NEW' as const, toStatus: 'BOOKED' as const, actor: row.operatorName ?? 'Tizim', note: null }] : []),
      ...(!['NEW', 'BOOKED'].includes(row.status) ? [{ at: ago((extra?.minutesAgo ?? 60) - 10), fromStatus: 'BOOKED' as const, toStatus: row.status, actor: row.operatorName ?? 'Tizim', note: row.closedNote ?? null }] : []),
      ...(extraState.get(id)?.history ?? []),
    ],
    previousLeads: [],
    items: [],
    confirmMode: 'CALL',
    createdAt: row.createdAt,
  };
  const phone = mockFullPhone(id);
  const history = base.history;
  const bookedAt = [...history].reverse().find((entry) => entry.toStatus === 'BOOKED')?.at ?? null;
  const closing = !['NEW', 'BOOKED', 'CALLBACK', 'CONFIRMED'].includes(row.status) ? [...history].reverse().find((entry) => entry.toStatus === row.status) : null;
  const owned = mockOwnedByMe(id) && row.status === 'BOOKED';
  const callStartedAt = owned && bookedAt ? new Date(Math.max(Date.parse(bookedAt), Date.now() - 72_000)).toISOString() : null;
  return {
    ...base,
    status: row.status,
    phone: admin ? phone : null,
    operator: row.operatorName ? { id: row.operatorId ?? 'U-0003', name: row.operatorName, state: 'ONLINE', since: ago(80), inCall: Boolean(callStartedAt), callStartedAt } : null,
    queuePosition: row.queuePosition ?? null,
    closesAt: new Date(Date.parse(row.createdAt) + 3 * 24 * 60 * MINUTE).toISOString(),
    rejectedAt: row.rejectedAt ?? null,
    consentAt: row.createdAt,
    sameNumberLeads: base.previousLeads.length + 1,
    bookedAt,
    affiliateName: affiliate.name,
    closedBy: closing ? { name: closing.actor, at: closing.at } : null,
    productInfo: { category: offer.category, wholesalerName: 'Namuna Savdo MChJ', weightGrams: offer.weightGrams, deliveryMode: offer.deliveryMode, options: { CENTER: 30_000, ADDRESS: 50_000 } },
    stream: { code: stream, productName: row.productName, createdAt: ago(7 * 24 * 60), affiliateName: affiliate.name, affiliateId: affiliate.id, sub1: 'fb-reels-1', subs: null, utmSource: 'facebook', fbclid: true, ip: '198.51.100.23', device: 'Android · Chrome' },
    attemptLog: [
      ...attemptLog(id, row, base.attempts),
      ...(callStartedAt ? [{ at: callStartedAt, operatorName: row.operatorName ?? 'Dilnoza R.', channel: 'ofis softfoni', outcome: 'IN_CALL' as const, comment: null, durationSeconds: Math.round((Date.now() - Date.parse(callStartedAt)) / 1000), recording: 'AFTER_CALL' as const }] : []),
    ],
    postbacks: [{ at: row.createdAt, event: 'Lid keldi', attempt: 1, code: 200, state: 'SENT' as const }],
    mergedInto: extra?.mergedInto ? { id: extra.mergedInto, productName: row.productName, status: 'CALLBACK', createdAt: ago(1700), streamCode: 'd2h6va', affiliateName: 'Sherzod A.', operatorName: 'Temur K.', attemptsCount: 2 } : null,
    order: order ? { id: order.id, status: order.status, createdAt: order.createdAt, totalAmount: order.unitPrice * order.quantity + order.deliveryFee } : null,
    reopened: reopenedLeads.get(id) ?? null,
  };
}

/** Admin qayta ochgan lidlar (kartadagi «Qayta ochilgan · 14:39» belgisi). */
const reopenedLeads = new Map<string, { at: string; by: string; reason: string }>();
onMockOrdersReset(() => {
  extraState.clear();
  reopenedLeads.clear();
});

/** Suhbat bo'lgan natijalar — yozuv bor (javob bermadi, band, o'chiq — yozuvsiz). */
const CONNECTED = new Set(['CONFIRMED', 'REJECTED', 'CALL_LATER', 'THINKING', 'INVALID', 'DUPLICATE']);
/** «Yozuvsiz qo'ng'iroq — hisobotda xato» namunasi (admin-lid-karta holatlar). */
const NO_RECORDING = new Set(['L-1209']);
/** «Aloqa bo'lmadi» — 6 urinish jadvali (admin-lid-karta holatlar L-1067). */
const NO_CONTACT_LOG = [
  ['Sabina X.', 'NO_ANSWER', 0], ['Umida S.', 'BUSY', 15], ['Shohruh M.', 'PHONE_OFF', 75],
  ['Temur K.', 'NO_ANSWER', 255], ['Zarina H.', 'NO_ANSWER', 1137], ['Temur K.', 'NO_ANSWER', 2577],
] as const;

function attemptLog(id: string, row: AdminLeadListItem, attempts: LeadCard['attempts']): NonNullable<AdminLeadCard['attemptLog']> {
  const recorded = (outcome: string, at: string, index: number) => {
    const ready = CONNECTED.has(outcome) && !NO_RECORDING.has(id);
    return {
      durationSeconds: CONNECTED.has(outcome) ? seeded(`${id}:${index}`, 45, 240) : null,
      recording: CONNECTED.has(outcome) ? (ready ? 'READY' as const : 'NONE' as const) : null,
      recordingUrl: ready ? `${API}/recordings/${id}-${index + 1}/audio` : null,
      endedBy: CONNECTED.has(outcome) ? 'OPERATOR' as const : null,
      notice: CONNECTED.has(outcome) ? { from: 0, to: 3 } : null,
      keptUntil: new Date(Date.parse(at) + 90 * 24 * 60 * MINUTE).toISOString(),
    };
  };
  if (row.status === 'NO_CONTACT') {
    const start = Date.parse(row.createdAt) + 5 * MINUTE;
    return NO_CONTACT_LOG.slice(0, row.attemptsCount ?? 6).map(([operatorName, outcome, minutes], index) => {
      const at = new Date(start + minutes * MINUTE).toISOString();
      return { at, operatorName, channel: 'ofis softfoni', outcome, comment: null, ...recorded(outcome, at, index) };
    });
  }
  const source = attempts.length ? attempts : row.status === 'CONFIRMED' || row.status === 'MERGED' || row.status === 'INVALID'
    ? [{ at: new Date(Date.parse(row.statusAt ?? row.createdAt) - 4 * MINUTE).toISOString(), operatorName: row.operatorName ?? 'Dilnoza R.', outcome: row.status === 'CONFIRMED' ? 'CONFIRMED' as const : row.status === 'MERGED' ? 'DUPLICATE' as const : 'INVALID' as const, comment: null }]
    : [];
  return source.map((attempt, index) => ({
    at: attempt.at, operatorName: attempt.operatorName, channel: 'ofis softfoni', outcome: attempt.outcome,
    comment: attempt.comment ?? (attempt.outcome === 'CALL_LATER' ? '«Hozir ishda»' : null), ...recorded(attempt.outcome, attempt.at, index),
  }));
}

/** Mock yozuv: 3 soniya sukunat (WAV, 8 kHz) — tinglash oynasi uchun. */
function silentWav(seconds = 3): ArrayBuffer {
  const rate = 8000;
  const samples = rate * seconds;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); text(36, 'data'); view.setUint32(40, samples, true);
  for (let index = 0; index < samples; index += 1) view.setUint8(44 + index, 128);
  return buffer;
}

// ── Buyurtmalar ──────────────────────────────────────────────────────────────

function filterOrders(url: URL, mineOnly: string | null): { items: OrderListItem[]; counts: Partial<Record<OrderStatus | 'ALL', number>> } {
  const p = url.searchParams;
  const search = (p.get('search') ?? '').trim().toLowerCase();
  const from = p.get('dateFrom');
  const to = p.get('dateTo');
  const rows = [...orderStore().orders.values()]
    .filter((order) => !mineOnly || order.confirmedBy.name === mineOnly)
    .map(listItem)
    .filter((order) => {
      const day = order.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (p.get('productId') && order.productId !== p.get('productId')) return false;
      if (p.get('source') && order.source !== p.get('source')) return false;
      if (p.get('affiliateId') && order.affiliateId !== p.get('affiliateId')) return false;
      if (p.get('regionSoato') && districtRegion(order) !== p.get('regionSoato')) return false;
      if (p.get('whereDeliver') && order.whereDeliver !== p.get('whereDeliver')) return false;
      if (p.get('confirmedById') && MOCK_OPERATORS.find((item) => item.id === p.get('confirmedById'))?.name !== order.confirmedBy?.name) return false;
      if (!search) return true;
      // Telefon bo'yicha (≥ 7 raqam) — to'liq raqamning oxiri; aks holda lid, ism, trek.
      const digits = search.replace(/\D/g, '');
      if (/^[\d\s()+-]+$/.test(search) && digits.length >= 7) return orderPhone(order.id).replace(/\D/g, '').endsWith(digits.slice(-9));
      return [order.leadId ?? '', order.id, order.buyerName, order.trackNumber ?? ''].some((value) => value.toLowerCase().includes(search));
    })
    .sort((a, b) => (b.statusAt ?? b.createdAt).localeCompare(a.statusAt ?? a.createdAt) * (p.get('sort') === 'statusAt' ? -1 : 1));
  const counts: Partial<Record<OrderStatus | 'ALL', number>> = { ALL: rows.length };
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const status = p.get('status');
  return { items: status ? rows.filter((row) => row.status === status) : rows, counts };
}

const orderPhone = (id: string) => orderStore().orders.get(id)?.phone ?? '';
const districtRegion = (order: OrderListItem) => [...orderStore().orders.values()].find((item) => item.id === order.id)?.regionSoato ?? null;

function page<T>(items: T[], url: URL) {
  const pageNo = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  return { items: items.slice((pageNo - 1) * limit, pageNo * limit), total: items.length, page: pageNo, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
}

function cancel(orderId: string, reason: string | undefined, actor: { name: string; role: string }) {
  const order = orderStore().orders.get(orderId);
  if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
  const text = reason?.trim() ?? '';
  if (text.length < 3) return fieldError('reason', 'Sabab majburiy');
  if (order.status === 'CANCELLED') return ok({ id: order.id, status: 'CANCELLED', idempotent: true });
  if (!isCancelable(order.status)) return fail(409, 'INVALID_STATE', 'Buyurtma Elchi’ga topshirilgan — bekor qilib bo‘lmaydi');
  const at = new Date().toISOString();
  order.history.push({ fromStatus: order.status, toStatus: 'CANCELLED', accepted: true, actorType: 'USER', actorId: null, actorRole: actor.role, reason: text, createdAt: at, actorName: actor.name, note: 'band bo‘shadi' });
  order.status = 'CANCELLED';
  order.statusAt = at;
  order.statusDetail = actor.name;
  order.cancel = { by: actor.name, byRole: actor.role, at, reason: text };
  releaseMockStock(order.product.id, order.quantity);
  for (const request of orderStore().requests) {
    if (request.orderId === order.id && request.state === 'OPEN' && request.kind === 'CANCEL') Object.assign(request, { state: 'DONE', closedAt: at, closedBy: actor.name });
  }
  return ok({ id: order.id, status: 'CANCELLED', idempotent: false });
}

export const leadOrdersHandlers = [
  http.get(`${API}/admin/leads`, ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const url = new URL(request.url);
    const admin = ADMIN.includes(user.role);
    const rows = filterLeads(url, admin);
    const counts: Partial<Record<LeadTab, number>> = { ALL: rows.filter((row) => !row.inReview).length, ACTIVE: 0, CONFIRMED: 0, REJECTED: 0, CLOSED: 0, REVIEW: 0 };
    for (const row of rows) counts[tabOf(row)] = (counts[tabOf(row)] ?? 0) + 1;
    const tab = url.searchParams.get('tab') as LeadTab | null;
    // Nazoratchi «Tekshiruvda» ni ko'rmaydi (admin-lidlar «Nazoratchi ko'rinishi»).
    let visible = tab && tab !== 'ALL' ? rows.filter((row) => tabOf(row) === tab) : rows.filter((row) => !row.inReview);
    if (!admin) visible = visible.filter((row) => !row.inReview);
    const sort = url.searchParams.get('sort') ?? '-createdAt';
    const compare = SORTS[sort.replace('-', '')] ?? SORTS.createdAt;
    visible = [...visible].sort((a, b) => (sort.startsWith('-') ? -compare(a, b) : compare(a, b)));
    const review = admin ? rows.filter((row) => row.inReview) : [];
    return ok({
      ...page(visible, url),
      counts: admin ? counts : { ...counts, REVIEW: undefined },
      review: review.length ? { count: review.length, streamCode: 'h2q7vz', affiliateName: 'Firdavs O.', from: review.at(-1)?.createdAt ?? '', to: review[0]?.createdAt ?? '' } : null,
    });
  }),

  // Taklif: filtr variantlari (admin va nazoratchi) — mahsulot, operator, sotuvchi.
  http.get(`${API}/admin/leads/filter-options`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const products = new Map(allLeads().map((lead) => [lead.productId ?? '', lead.productName]));
    return ok({
      products: [...products].filter(([id]) => id).map(([id, name]) => ({ id, name })),
      operators: MOCK_OPERATORS.map(({ id, name }) => ({ id, name })),
      affiliates: MOCK_AFFILIATE_OPTIONS,
    });
  }),

  http.get(`${API}/admin/leads/:id`, ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const card = leadCard(String(params.id), ADMIN.includes(user.role));
    return card ? ok(card) : fail(404, 'NOT_FOUND', 'Lid topilmadi');
  }),

  // BE-35: faqat «Rad etildi» (dublikat emas); lid navbatga yangi lid bo'lib qaytadi — urinishlar 0, operatorsiz.
  http.post(`${API}/admin/leads/:id/reopen`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!body.reason?.trim()) return fieldError('reason', 'reason qayta ochish sababi majburiy');
    const row = allLeads().find((item) => item.id === id);
    if (!row) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    if (row.status !== 'REJECTED') return fail(409, 'LEAD_NOT_REJECTED', 'Faqat «Rad etildi» holatidagi lid qayta ochiladi');
    const entry = { at: new Date().toISOString(), fromStatus: 'REJECTED' as const, toStatus: 'NEW' as const, actor: shortName(user.name), note: `Admin qayta ochdi: ${body.reason.trim()}` };
    reopenedLeads.set(id, { at: entry.at, by: shortName(user.name), reason: body.reason.trim() });
    const updated = updateMockOperatorLead(id, (lead) => ({ ...lead, status: 'NEW', rejectReason: null, attemptsCount: 0, nextAttemptAt: entry.at, history: [...lead.history, entry] }), false);
    if (!updated) {
      extraState.set(id, { ...extraState.get(id), status: 'NEW', closedNote: null, operatorName: null, operatorId: null, attemptsCount: 0, rejectedAt: null, history: [...(extraState.get(id)?.history ?? []), entry] });
    }
    return ok({ leadId: id, status: 'NEW' });
  }),

  /**
   * BE-42 `transfer`: faqat «Ishda» operatorga (tanaffus/oflayn — 409), bron chegarasi 5 (409), tekshiruvdagi va
   * yopilgan lid — 409. Lid yangi operator broniga tushadi. Taklif (admin-lidlar «O'tkazish» oynasi): vaqti hali
   * kelmagan rejalashtirilgan qo'ng'iroq bronga kirmaydi — yangi operatorda shu vaqt bilan qoladi (backend hozir 409).
   */
  http.post(`${API}/supervisor/leads/:id/transfer`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as { operatorId?: string; reason?: string };
    const operator = MOCK_OPERATORS.find((item) => item.id === body.operatorId);
    if (!operator) return fieldError('operatorId', 'operatorId noto‘g‘ri');
    const state = mockOperatorState(operator.id);
    if (state === 'BREAK') return fail(409, 'OPERATOR_ON_BREAK', 'Tanaffusdagi operatorga o‘tkazib bo‘lmaydi');
    if (state !== 'ONLINE') return fail(409, 'OPERATOR_OFFLINE', 'Oflayn operatorga o‘tkazib bo‘lmaydi');
    const row = allLeads().find((item) => item.id === id);
    if (!row) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    if (!['BOOKED', 'CALLBACK', 'NEW'].includes(row.status) || row.inReview || (row.status === 'BOOKED' && row.operatorId === operator.id)) {
      return fail(409, 'LEAD_NOT_TRANSFERABLE', row.status === 'BOOKED' && row.operatorId === operator.id ? 'Lid allaqachon shu operatorda' : 'Bu lidni o‘tkazib bo‘lmaydi: navbatda yoki operatorda emas');
    }
    const scheduled = row.status === 'CALLBACK' && Boolean(row.callbackAt) && Date.parse(row.callbackAt ?? '') > Date.now();
    const target = mockQueueOperator(operator);
    if (!scheduled && target.activeBookings >= target.maxBookings) return fail(409, 'BOOKING_LIMIT_REACHED', `Operatorda ${target.maxBookings} ta bron bor — boshqasini tanlang`);
    const at = new Date().toISOString();
    const reason = body.reason?.trim() || null;
    const toStatus = scheduled ? 'CALLBACK' as const : 'BOOKED' as const;
    const entry = { at, fromStatus: row.status, toStatus, actor: shortName(user.name), note: `Boshqa operatorga o‘tkazildi: ${row.operatorName ?? 'navbat'} → ${operator.name}${reason ? ` (${reason})` : ''}` };
    const moved = updateMockOperatorLead(id, (lead) => ({ ...lead, status: toStatus, bookedUntil: scheduled ? null : new Date(Date.now() + 10 * MINUTE).toISOString(), history: [...lead.history, entry] }), operator.id === 'U-0003');
    extraState.set(id, { ...extraState.get(id), ...(moved ? {} : { status: toStatus }), operatorName: operator.name, operatorId: operator.id, history: moved ? extraState.get(id)?.history : [...(extraState.get(id)?.history ?? []), entry] });
    addMockOperatorLoad(operator.id, scheduled ? { scheduled: 1 } : { bookings: 1 });
    if (row.operatorId && row.operatorId !== operator.id) addMockOperatorLoad(row.operatorId, scheduled ? { scheduled: -1 } : row.status === 'BOOKED' ? { bookings: -1 } : {});
    return ok({ leadId: id, at, fromOperatorId: row.operatorId ?? null, toOperatorId: operator.id, actorId: user.id, reason });
  }),

  // Mock: qo'ng'iroq yozuvi (backendda imzolangan havola — `attemptLog[].recordingUrl`).
  http.get(`${API}/recordings/:id/audio`, () => new HttpResponse(silentWav(), { headers: { 'Content-Type': 'audio/wav' } })),

  // Taklif: bronni bo'shatish — lid navbatga qaytadi.
  http.post(`${API}/admin/leads/:id/release`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!body.reason?.trim()) return fieldError('reason', 'Sabab majburiy');
    const updated = updateMockOperatorLead(id, (lead) => (lead.status === 'BOOKED'
      ? { ...lead, status: lead.attemptsCount ? 'CALLBACK' : 'NEW', bookedUntil: null, history: [...lead.history, { at: new Date().toISOString(), fromStatus: 'BOOKED', toStatus: lead.attemptsCount ? 'CALLBACK' : 'NEW', actor: shortName(user.name), note: `Bron bo‘shatildi: ${body.reason?.trim()}` }] }
      : lead), false);
    return updated ? ok(null) : fail(404, 'NOT_FOUND', 'Lid topilmadi');
  }),

  // Taklif: CSV eksport — fon ishi; tayyor bo'lganda bildirishnoma (faqat admin, audit jurnaliga yoziladi).
  http.post(`${API}/admin/leads/export`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { columns?: string[]; phone?: string; filters?: Record<string, string> };
    if (!body.columns?.length) return fieldError('columns', 'Kamida bitta ustun tanlang');
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(body.filters ?? {})) if (value) url.searchParams.set(key, value);
    const rows = filterLeads(url, true).filter((row) => !row.inReview).length;
    return ok({ id: `EXP-${Date.now().toString(36)}`, rows, state: 'PREPARING' }, 202);
  }),

  // Taklif: buyurtmalar CSV eksporti (faqat admin) — fon ishi, bildirishnoma keladi.
  http.post(`${API}/admin/orders/export`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { columns?: string[]; filters?: Record<string, string> };
    if (!body.columns?.length) return fieldError('columns', 'Kamida bitta ustun tanlang');
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(body.filters ?? {})) if (value) url.searchParams.set(key, value);
    const { items } = filterOrders(url, null);
    return ok({ id: `EXP-${Date.now().toString(36)}`, rows: items.length, state: 'PREPARING' }, 202);
  }),

  // Posilka yorlig'i (PDF) — qayta chop etish.
  http.get(`${API}/admin/orders/:id/label`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    if (['CONFIRMED', 'PICKING', 'CANCELLED'].includes(order.status)) return fail(409, 'INVALID_STATE', 'Yorliq hali chop etilmagan — posilka qadoqlanmagan');
    const place = districtOf(order.districtSoato);
    const pdf = samplePdf([`Elchi Pochta · ${order.whereDeliver === 'ADDRESS' ? 'Eshikkacha' : 'Markazgacha'}`, `Trek: ${order.track ?? '—'}`, `Buyurtma ${order.leadId}`, order.name, `${place.regionName}, ${place.districtName}`]);
    return new HttpResponse(pdf.buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="yorliq-${order.leadId}.pdf"` } });
  }),

  // Taklif: qayta chop etish sababi — audit jurnaliga; kartadagi «yorliq chop etilgan» yangilanadi.
  http.post(`${API}/admin/orders/:id/label/reprints`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    if (['CONFIRMED', 'PICKING', 'CANCELLED'].includes(order.status)) return fail(409, 'INVALID_STATE', 'Yorliq hali chop etilmagan — posilka qadoqlanmagan');
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim() ?? '';
    if (reason.length < 3) return fieldError('reason', 'Sabab majburiy');
    order.labelReprint = { at: new Date().toISOString(), by: shortName(user.name), count: (order.labelReprint?.count ?? 1) + 1, reason };
    return ok({ printedAt: order.labelReprint.at, by: order.labelReprint.by, count: order.labelReprint.count }, 201);
  }),

  http.get(`${API}/admin/orders`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const url = new URL(request.url);
    const { items, counts } = filterOrders(url, null);
    return ok({ ...page(items, url), counts });
  }),

  // Taklif: operator o'zi tasdiqlagan buyurtmalar (operator-buyurtmalarim).
  http.get(`${API}/operator/orders`, ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies, ['OPERATOR_LEAD']);
    if (denied) return denied;
    const url = new URL(request.url);
    const me = shortName(user.name);
    const { items, counts } = filterOrders(url, me);
    // Taklif: operatorning o'z buyurtmalaridagi mahsulotlar — «Mahsulot» filtri uchun (filter-options unga yopiq).
    const products = [...new Map([...orderStore().orders.values()].filter((order) => order.confirmedBy.name === me).map((order) => [order.product.id, { id: order.product.id, name: order.product.name }])).values()];
    return ok({ ...page(items, url), counts, facets: { products } });
  }),

  http.get(`${API}/admin/orders/:id`, ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    return order ? ok(orderDetail(order, user.role)) : fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
  }),

  http.get(`${API}/operator/orders/:id`, ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ['OPERATOR_LEAD']);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    return order && order.confirmedBy.name === shortName(user.name) ? ok(orderDetail(order, user.role)) : fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
  }),

  http.post(`${API}/admin/orders/:id/cancel`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    return cancel(String(params.id), body.reason, { name: shortName(user.name), role: user.role });
  }),

  http.post(`${API}/operator/orders/:id/cancel`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ['OPERATOR_LEAD', 'SUPERVISOR', 'SUPERADMIN']);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    return cancel(String(params.id), body.reason, { name: shortName(user.name), role: user.role });
  }),

  http.post(`${API}/admin/orders/:id/returns`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ['ADMIN', 'SUPERADMIN', 'OPERATOR_LEAD', 'SUPERVISOR']);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    const body = (await request.json().catch(() => ({}))) as { reason?: string; comment?: string };
    if (!body.reason) return fieldError('reason', 'Sabab majburiy');
    if (body.reason === 'OTHER' && !body.comment?.trim()) return fieldError('comment', '«Boshqa» sababida izoh majburiy');
    if (order.status !== 'DELIVERED') return fail(409, 'INVALID_STATE', 'Faqat «Yetkazildi» buyurtma');
    const at = new Date().toISOString();
    order.history.push({ fromStatus: 'DELIVERED', toStatus: 'RETURN_REQUESTED', accepted: true, actorType: 'USER', actorId: null, actorRole: user.role, reason: body.comment ?? body.reason, createdAt: at, actorName: shortName(user.name), note: null });
    order.status = 'RETURN_REQUESTED';
    order.statusAt = at;
    order.statusDetail = 'teskari yozildi';
    order.returnRequest = { at, by: shortName(user.name), reason: body.comment?.trim() || body.reason };
    return ok({ id: `RR-${order.id}`, orderId: order.id, status: 'REQUESTED' }, 201);
  }),

  // Taklif: qaytarish so'roviga rasmlar (multipart).
  http.post(`${API}/admin/orders/:id/returns/photos`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    if (!orderStore().orders.get(String(params.id))) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    const form = await request.formData().catch(() => null);
    const files = form?.getAll('files') ?? [];
    return files.length ? ok({ count: files.length }, 201) : fieldError('files', 'Rasm tanlanmagan');
  }),

  http.post(`${API}/admin/orders/:id/dispute`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!body.reason?.trim()) return fieldError('reason', 'Sabab majburiy');
    order.dispute = { at: new Date().toISOString(), by: shortName(user.name), reason: body.reason.trim() };
    return ok(null);
  }),

  // Taklif: nizoni yopish — yozuv oddiy muddatga qaytadi.
  http.post(`${API}/admin/orders/:id/dispute/close`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    if (!order.dispute) return fail(409, 'INVALID_STATE', 'Buyurtma nizoli emas');
    order.dispute = null;
    return ok(null);
  }),

  // Taklif: «Yo'lda» posilka holatini Elchi'dan so'rash — javob kelguncha holat o'zgarmaydi.
  http.post(`${API}/admin/orders/:id/elchi/refresh`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    return ok({ requested: true }, 202);
  }),

  http.post(`${API}/admin/orders/:id/elchi/resend`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    order.elchiFailed = false;
    order.track = `EL${order.leadId.slice(2)}RSUZ`;
    order.statusDetail = 'posilka yaratildi';
    return ok(null);
  }),

  http.patch(`${API}/admin/orders/:id/address`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const order = orderStore().orders.get(String(params.id));
    if (!order) return fail(404, 'NOT_FOUND', 'Buyurtma topilmadi');
    const body = (await request.json().catch(() => ({}))) as { regionSoato?: string; districtSoato?: string; addressLine?: string; whereDeliver?: 'CENTER' | 'ADDRESS'; reason?: string };
    const region = REGION_TREE.find((item) => item.satoCode === body.regionSoato);
    if (!region?.districts.some((item) => item.satoCode === body.districtSoato)) return fieldError('districtSoato', 'Tuman tanlanmagan');
    if (!isCancelable(order.status)) return fail(409, 'INVALID_STATE', 'Posilka topshirilgan — manzil o‘zgarmaydi');
    order.original ??= { regionSoato: order.regionSoato, districtSoato: order.districtSoato, addressLine: order.addressLine, whereDeliver: order.whereDeliver };
    order.regionSoato = region.satoCode;
    order.districtSoato = body.districtSoato ?? order.districtSoato;
    order.addressLine = body.addressLine?.trim() || order.addressLine;
    order.whereDeliver = body.whereDeliver ?? order.whereDeliver;
    order.deliveryFee = order.whereDeliver === 'ADDRESS' ? 50_000 : 30_000;
    order.editedBy = { name: shortName(user.name), at: new Date().toISOString() };
    for (const item of orderStore().requests) {
      if (item.orderId === order.id && item.state === 'OPEN' && item.kind === 'CHANGE_ADDRESS') Object.assign(item, { state: 'DONE', closedAt: order.editedBy.at, closedBy: order.editedBy.name });
    }
    return ok(orderDetail(order, user.role));
  }),

  http.post(`${API}/admin/orders/:id/sms/resend`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies, ADMIN);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { template?: string };
    return body.template ? ok(null) : fieldError('template', 'Qaysi SMS — tanlang');
  }),

  // Taklif (47-qaror): mijoz so'rovlari — «Buyurtmam qayerda» sahifasidan.
  http.get(`${API}/supervisor/order-requests`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const state = new URL(request.url).searchParams.get('state') === 'CLOSED' ? 'CLOSED' : 'OPEN';
    // Taklif: so'rov qatoriga buyurtma qisqachasi (holat, mijoz, summa, kim tasdiqlagani) — alohida so'rovsiz.
    const rows = orderStore().requests.filter((item) => (state === 'OPEN' ? item.state === 'OPEN' : item.state !== 'OPEN'));
    return ok(rows.map((item) => {
      const order = orderStore().orders.get(item.orderId);
      return { ...item, order: order ? listItem(order) : null };
    }).sort((a, b) => (state === 'OPEN' ? a.createdAt.localeCompare(b.createdAt) : (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))));
  }),

  http.post(`${API}/supervisor/order-requests/:id/close`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies, STAFF);
    if (denied) return denied;
    const item = orderStore().requests.find((entry) => entry.id === String(params.id));
    if (!item) return fail(404, 'NOT_FOUND', 'So‘rov topilmadi');
    if (item.state !== 'OPEN') return fail(409, 'INVALID_STATE', 'So‘rov allaqachon yopilgan');
    const body = (await request.json().catch(() => ({}))) as { comment?: string };
    if (!body.comment?.trim()) return fieldError('comment', 'Mijozga nima deyilganini yozing');
    Object.assign(item, { state: 'CLOSED', closedAt: new Date().toISOString(), closedBy: shortName(user.name), closedComment: body.comment.trim() });
    return ok(null);
  }),
];

/** Filtrlar uchun: sotuvchilar (mock). */
export const MOCK_AFFILIATE_OPTIONS = MOCK_AFFILIATES.map(({ id, name }) => ({ id, name }));
