import { http } from 'msw';
import type { components } from '../../generated/api-types';
import {
  BOOKING_MINUTES,
  CALLBACK_GRACE_MINUTES,
  clampToCallWindow,
  closesAsNoContact,
  isNoAnswer,
  nextRetryAt,
  REMINDER_MINUTES,
  tashkentMoment,
  tashkentParts,
} from '../../features/operator/lib/leadRules';
import type { LeadProductInfo, OperatorAttemptItem, OperatorLeadListItem, OperatorStateInfo } from '../../features/operator/model/operatorTypes';
import { addDays } from '../../shared/lib/tashkentTime';
import { db, MOCK_PRODUCTS } from '../db';
import { REGION_TREE } from '../fixtures/regions';
import { API, fail, ok, seeded } from '../utils';
import { currentMockUser } from './auth';

type Schemas = components['schemas'];
type LeadCard = Schemas['LeadCardDto'];
type LeadStatus = LeadCard['status'];

/**
 * Operator navbati (BE-13 / BE-25: /operator/*). Qoidalar backend'dagidek (TZ 5-bo'lim):
 * lid faqat «Onlayn»da, ≤ 5 bron, bron 10 daqiqa; navbat tartibi — avval vaqti kelgan
 * qayta qo'ng'iroqlar (o'zingiz rejalashtirganlari birinchi), keyin eng yangi lidlar;
 * natija tekshiruvi (sabab, vaqt, manzil); javobsiz urinishlar jadvali; muddati o'tgan
 * bron va kechikkan rejalashtirilgan qo'ng'iroq navbatga qaytadi.
 */
const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();
const ahead = (minutes: number) => new Date(Date.now() + minutes * MINUTE).toISOString();
const money = (value: number) => value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const CENTER_FEE = 30_000;
const ADDRESS_FEE = 50_000;
const OPERATOR = 'Dilnoza R.';

const ADDRESSES: ReadonlyArray<Omit<NonNullable<LeadCard['address']>, 'whereDeliver' | 'confirmedAt' | 'editedByOperator'>> = [
  { regionSoato: '1730', regionName: 'Farg‘ona viloyati', districtSoato: '1730412', districtName: 'Qo‘qon shahri', addressLine: 'Navoiy ko‘chasi, 12-uy' },
  { regionSoato: '1726', regionName: 'Toshkent shahri', districtSoato: '1726266', districtName: 'Yunusobod tumani', addressLine: '19-mavze, 4-uy, 27-xonadon' },
  { regionSoato: '1718', regionName: 'Samarqand viloyati', districtSoato: '1718401', districtName: 'Samarqand shahri', addressLine: 'Registon ko‘chasi, 5-uy' },
  { regionSoato: '1722', regionName: 'Surxondaryo viloyati', districtSoato: '1722401', districtName: 'Termiz shahri', addressLine: 'Alpomish ko‘chasi, 3-uy' },
  { regionSoato: '1703', regionName: 'Andijon viloyati', districtSoato: '1703401', districtName: 'Andijon shahri', addressLine: 'Bobur shoh ko‘chasi, 44-uy' },
];

const NAMES = ['Mohira', 'Gulnoza', 'Oybek', 'Saida', 'Nodir', 'Kamola'];

function script(name: string, product: string, price: number): string {
  return [
    `Assalomu alaykum, ${name}! Elchi Market’dan qo‘ng‘iroq qilyapman. Suhbat sifat nazorati uchun yozib olinadi.`,
    `Siz «${product}» uchun ariza qoldirgan edingiz. Buyurtmani rasmiylashtiramizmi?`,
    `Narxi ${money(price)} so‘m, yetkazish viloyat va tuman markazigacha ${money(CENTER_FEE)} so‘m, jami ${money(price + CENTER_FEE)} so‘m. To‘lov tovarni olganingizda.`,
    'Manzilni aniqlaymiz: tuman yoki shahar, markazgacha yoki eshikkacha.',
  ].join('\n');
}

interface Seed {
  id: string;
  name: string;
  product: number;
  address: number | null;
  status?: LeadStatus;
  source?: LeadCard['source'];
  createdMinutesAgo: number;
  attempts?: LeadCard['attempts'];
  previousLeads?: LeadCard['previousLeads'];
  stockShortage?: boolean;
  bookedUntil?: string | null;
  nextAttemptAt?: string | null;
}

function makeLead(seed: Seed): LeadCard {
  const product = MOCK_PRODUCTS[seed.product % MOCK_PRODUCTS.length];
  const address = seed.address === null ? null : ADDRESSES[seed.address % ADDRESSES.length];
  const attempts = seed.attempts ?? [];
  const created = ago(seed.createdMinutesAgo);
  const history: LeadCard['history'] = [{ at: created, fromStatus: null, toStatus: 'NEW', actor: 'Tizim', note: null }];
  attempts.forEach((attempt, index) => {
    history.push({ at: attempt.at, fromStatus: index ? 'CALLBACK' : 'NEW', toStatus: 'CALLBACK', actor: attempt.operatorName, note: attempt.comment });
  });
  if (seed.status === 'BOOKED') history.push({ at: ago(2), fromStatus: 'NEW', toStatus: 'BOOKED', actor: OPERATOR, note: null });
  return {
    id: seed.id,
    status: seed.status ?? (attempts.length ? 'CALLBACK' : 'NEW'),
    source: seed.source ?? 'LANDING',
    customerName: seed.name,
    phoneMasked: `+998 ** *** ${seeded(seed.id, 10, 99)} ${seeded(`${seed.id}:2`, 10, 99)}`,
    product: { id: product.id, name: product.name, salePrice: product.salePrice },
    quantity: 1,
    address: address && { ...address, whereDeliver: 'CENTER', confirmedAt: null, editedByOperator: false },
    price: address && {
      unitPrice: product.salePrice, quantity: 1, subtotal: product.salePrice, whereDeliver: 'CENTER',
      deliveryFee: CENTER_FEE, totalAmount: product.salePrice + CENTER_FEE,
    },
    rejectReason: null,
    callScript: script(seed.name, product.name, product.salePrice),
    stockShortage: seed.stockShortage ?? false,
    attemptsCount: attempts.length,
    bookedUntil: seed.bookedUntil ?? null,
    nextAttemptAt: seed.nextAttemptAt ?? null,
    orderId: null,
    attempts,
    history,
    previousLeads: seed.previousLeads ?? [],
    createdAt: created,
  };
}

interface OperatorStore {
  leads: Map<string, LeadCard>;
  /** Shu operatorniki: bronlar va o'zi rejalashtirgan qo'ng'iroqlar. Qolgani — umumiy navbat. */
  owned: Set<string>;
  /** Muddati o'tgan yoki tanaffusda qaytgan bronlar — navbat boshida (5-qoida). */
  returned: string[];
  stateSince: string;
  /** Shu operatorning bugungi urinishlari (yangisi birinchi) — «Bugungi urinishlarim». */
  log: OperatorAttemptItem[];
}

/** Bugungi urinishlar namunasi (operator-bosh jadvalidagidek); «jami» statistika bilan bir xil — 38. */
function seedLog(): OperatorAttemptItem[] {
  const row = (minutesAgo: number, leadId: string, customerName: string, product: number, outcome: OperatorAttemptItem['outcome'], extra: Partial<OperatorAttemptItem> = {}): OperatorAttemptItem => ({
    at: ago(minutesAgo), leadId, customerName, productName: MOCK_PRODUCTS[product % MOCK_PRODUCTS.length].name, outcome,
    comment: null, rejectReason: null, nextAttemptAt: null, durationSeconds: null, ...extra,
  });
  return [
    row(4, 'L-1230', 'Dildora', 1, 'REJECTED', { rejectReason: 'NOT_NEEDED' }),
    row(8, 'L-1281', 'Shahzoda', 2, 'CALL_LATER', { nextAttemptAt: ahead(23 * 60) }),
    row(16, 'L-1262', 'Murod', 0, 'CONFIRMED'),
    row(21, 'L-1230', 'Dildora', 1, 'NO_ANSWER', { nextAttemptAt: ago(6) }),
    row(28, 'L-1279', 'Malika', 0, 'CALL_LATER', { nextAttemptAt: ahead(43) }),
    row(29, 'L-1274', 'Sherzod', 2, 'INVALID'),
    row(35, 'L-1232', 'Kamron', 1, 'CONFIRMED'),
    row(38, 'L-1245', 'Lola', 0, 'CONFIRMED'),
    row(45, 'L-1273', 'Nilufar', 1, 'THINKING', { nextAttemptAt: ahead(20 * 60) }),
    row(53, 'L-1232', 'Kamron', 1, 'PHONE_OFF', { nextAttemptAt: ago(38) }),
  ];
}

function createStore(): OperatorStore {
  const noAnswer = (minutesAgo: number, operatorName = OPERATOR): LeadCard['attempts'][number] => ({ at: ago(minutesAgo), operatorName, outcome: 'NO_ANSWER', comment: null });
  const seeds: Seed[] = [
    {
      id: 'L-1284', name: 'Aziza', product: 0, address: 0, status: 'BOOKED', createdMinutesAgo: 6, bookedUntil: ahead(8),
      previousLeads: [{ id: 'L-0736', createdAt: ago(13 * 24 * 60), productName: MOCK_PRODUCTS[2].name, status: 'REJECTED', orderId: null, orderStatus: null, rejectReason: 'TOO_EXPENSIVE' }],
    },
    {
      id: 'L-1255', name: 'Muxlisa', product: 1, address: 2, status: 'CALLBACK', createdMinutesAgo: 180, nextAttemptAt: ahead(12),
      attempts: [{ at: ago(60), operatorName: OPERATOR, outcome: 'THINKING', comment: 'Turmush o‘rtog‘i bilan maslahatlashadi' }],
    },
    {
      id: 'L-1253', name: 'Hilola', product: 2, address: 3, status: 'CALLBACK', createdMinutesAgo: 240, nextAttemptAt: ahead(95),
      attempts: [{ at: ago(90), operatorName: OPERATOR, outcome: 'CALL_LATER', comment: 'Hozir ishda' }],
    },
    // Umumiy navbat: qayta urinish (vaqti kelgan), oxirgi urinish, dublikat nomzodi, API lidi, qoldiq tugagan.
    { id: 'L-1275', name: 'Sarvar', product: 2, address: 1, createdMinutesAgo: 300, nextAttemptAt: ago(20), attempts: [noAnswer(200, 'Feruza Y.'), { ...noAnswer(100), outcome: 'BUSY' }] },
    { id: 'L-1138', name: 'Nargiza', product: 1, address: 3, createdMinutesAgo: 2 * 24 * 60, nextAttemptAt: ago(10), attempts: [1500, 1200, 900, 600, 300].map((minutes) => noAnswer(minutes)) },
    {
      id: 'L-1287', name: 'Shahnoza', product: 0, address: 1, createdMinutesAgo: 3,
      previousLeads: [{ id: 'L-1203', createdAt: ago(7 * 24 * 60), productName: MOCK_PRODUCTS[0].name, status: 'CALLBACK', orderId: null, orderStatus: null, rejectReason: null }],
    },
    { id: 'L-1291', name: 'Madina', product: 0, address: null, source: 'API', createdMinutesAgo: 9 },
    { id: 'L-1151', name: 'Jahongir', product: 2, address: 4, createdMinutesAgo: 20, stockShortage: true },
    ...NAMES.map((name, index) => ({ id: `L-12${60 + index}`, name, product: index, address: index, createdMinutesAgo: 25 + index * 7 })),
  ];
  const leads = new Map(seeds.map((seed) => [seed.id, makeLead(seed)]));
  return { leads, owned: new Set(['L-1284', 'L-1255', 'L-1253']), returned: [], stateSince: ago(20), log: seedLog() };
}

// Kechiktirib yaratiladi: `db.ts` bu faylni reset uchun import qiladi (aylana import).
let store: OperatorStore | null = null;
const current = () => (store ??= createStore());

export function resetMockOperator(): void {
  store = null;
}

const guard = (request: Request, cookies: Record<string, string>, roles: readonly string[] = ['OPERATOR_LEAD']) => {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), user: null };
  if (!roles.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim operator uchun'), user };
  return { denied: null, user };
};

/** «Dilnoza Rahimova» → «Dilnoza R.» */
const shortName = (name: string | undefined) => {
  const [first = 'Operator', last = ''] = (name ?? '').split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

const all = () => [...current().leads.values()];
const mine = () => all().filter((lead) => current().owned.has(lead.id));
const activeBookings = () => mine().filter((lead) => lead.status === 'BOOKED').length;
const isOpen = (lead: LeadCard) => lead.status === 'NEW' || lead.status === 'CALLBACK';
const isDue = (lead: LeadCard, now: number) => lead.status === 'CALLBACK' && (!lead.nextAttemptAt || Date.parse(lead.nextAttemptAt) <= now);

function stateDto(): OperatorStateInfo {
  return { state: db.operator.state, activeBookings: activeBookings(), maxBookings: db.operator.maxBookings, since: current().stateSince };
}

function withStatus(lead: LeadCard, toStatus: LeadStatus, actor: string, note: string | null = null): LeadCard {
  return { ...lead, status: toStatus, history: [...lead.history, { at: new Date().toISOString(), fromStatus: lead.status, toStatus, actor, note }] };
}

/** Bron navbatga qaytadi va navbat boshida turadi (5-qoida). */
function release(lead: LeadCard, note: string) {
  const status: LeadStatus = lead.attemptsCount ? 'CALLBACK' : 'NEW';
  current().leads.set(lead.id, { ...withStatus(lead, status, 'Tizim', note), bookedUntil: null, nextAttemptAt: status === 'CALLBACK' ? new Date().toISOString() : null });
  current().owned.delete(lead.id);
  current().returned = [lead.id, ...current().returned.filter((id) => id !== lead.id)];
}

/** Muddati o'tgan bron (5-qoida) va 15 daqiqa kechikkan rejalashtirilgan qo'ng'iroq (4-qoida). */
function sweep(): void {
  const now = Date.now();
  for (const lead of mine()) {
    if (lead.status === 'BOOKED' && lead.bookedUntil && Date.parse(lead.bookedUntil) <= now) {
      release(lead, 'Bron muddati tugadi — navbatga qaytdi');
    } else if (lead.status === 'CALLBACK' && lead.nextAttemptAt && Date.parse(lead.nextAttemptAt) + CALLBACK_GRACE_MINUTES * MINUTE <= now) {
      current().leads.set(lead.id, withStatus(lead, 'CALLBACK', 'Tizim', 'Rejalashtirilgan vaqtdan 15 daqiqa o‘tdi — navbatga qaytdi'));
      current().owned.delete(lead.id);
    }
  }
}

/**
 * Navbat boshidagi lid: o'zimning vaqti kelgan qo'ng'irog'im → navbatga qaytgan bronlar →
 * umumiy vaqti kelgan qayta qo'ng'iroqlar → eng yangi lid.
 */
function pickNext(): LeadCard | null {
  const now = Date.now();
  const returned = current().returned
    .map((id) => current().leads.get(id))
    .find((lead): lead is LeadCard => Boolean(lead) && !current().owned.has(lead?.id ?? '') && isOpen(lead as LeadCard));
  const byTime = (a: LeadCard, b: LeadCard) => Date.parse(a.nextAttemptAt ?? a.createdAt) - Date.parse(b.nextAttemptAt ?? b.createdAt);
  const ownDue = mine().filter((lead) => isDue(lead, now)).sort(byTime);
  const pool = all().filter((lead) => !current().owned.has(lead.id) && isOpen(lead));
  const due = pool.filter((lead) => isDue(lead, now)).sort(byTime);
  const fresh = pool.filter((lead) => lead.status === 'NEW').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return ownDue[0] ?? returned ?? due[0] ?? fresh[0] ?? null;
}

function listItem(lead: LeadCard): OperatorLeadListItem {
  const callbackAt = lead.status === 'CALLBACK' ? lead.nextAttemptAt : null;
  const last = lead.attempts.at(-1);
  return {
    id: lead.id,
    status: lead.status,
    customerName: lead.customerName,
    productName: lead.product.name,
    bookedUntil: lead.status === 'BOOKED' ? lead.bookedUntil : null,
    callbackAt,
    reminderDue: Boolean(callbackAt && Date.parse(callbackAt) - Date.now() <= REMINDER_MINUTES * MINUTE),
    lastOutcome: last?.outcome ?? null,
    lastComment: last?.comment ?? null,
    lastAttemptAt: last?.at ?? null,
  };
}

function productInfo(lead: LeadCard): LeadProductInfo {
  const product = MOCK_PRODUCTS.find((item) => item.id === lead.product.id) ?? MOCK_PRODUCTS[0];
  return {
    id: product.id,
    name: product.name,
    category: product.id === '501' ? 'Elektronika' : 'Uy-ro‘zg‘or',
    imageUrl: null,
    description: `${product.name} — kundalik foydalanish uchun. Tavsif optovik kartasidan olinadi.`,
    highlights: ['Kafolat va sertifikat — optovik hujjatlarida', 'Tovar platforma omborida', 'To‘lov tovarni olganda'],
    available: lead.stockShortage ? 0 : 120,
    weightKg: 0.3,
    contents: null,
    salePrice: lead.product.salePrice,
    deliveryFee: { CENTER: CENTER_FEE, ADDRESS: ADDRESS_FEE },
    pageUrl: null,
    warning: null,
  };
}

const OUTCOME_STATUS: Record<Schemas['SubmitLeadResultDto']['outcome'], LeadStatus> = {
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  INVALID: 'INVALID',
  DUPLICATE: 'MERGED',
  CALL_LATER: 'CALLBACK',
  THINKING: 'CALLBACK',
  NO_ANSWER: 'CALLBACK',
  BUSY: 'CALLBACK',
  PHONE_OFF: 'CALLBACK',
};

const OUTCOMES = Object.keys(OUTCOME_STATUS);
const REJECT_REASONS = ['TOO_EXPENSIVE', 'NOT_NEEDED', 'BOUGHT_ELSEWHERE', 'OTHER'];

function validateResult(lead: LeadCard, body: Partial<Schemas['SubmitLeadResultDto']>) {
  const { outcome } = body;
  if (!outcome || !OUTCOMES.includes(outcome)) return fail(400, 'VALIDATION_ERROR', 'Natija tanlanmagan');
  if (outcome === 'REJECTED' && (!body.rejectReason || !REJECT_REASONS.includes(body.rejectReason))) return fail(400, 'VALIDATION_ERROR', 'Rad sababi majburiy');
  if (outcome === 'REJECTED' && body.rejectReason === 'OTHER' && !body.comment?.trim()) return fail(400, 'VALIDATION_ERROR', '«Boshqa sabab» — izoh majburiy');
  if (outcome === 'CALL_LATER' && !body.callbackAt) return fail(400, 'VALIDATION_ERROR', 'Qayta qo‘ng‘iroq vaqti majburiy');
  if (body.callbackAt && (Number.isNaN(Date.parse(body.callbackAt)) || Date.parse(body.callbackAt) <= Date.now())) return fail(400, 'VALIDATION_ERROR', 'Qayta qo‘ng‘iroq vaqti o‘tib ketgan');
  if (outcome === 'DUPLICATE' && !lead.previousLeads.some((item) => item.id === body.duplicateOfLeadId)) return fail(400, 'VALIDATION_ERROR', 'Avvalgi lid tanlanmagan');
  if (outcome === 'CONFIRMED' && !lead.address?.confirmedAt) return fail(400, 'ADDRESS_NOT_CONFIRMED', 'Manzil tasdiqlanmagan');
  return null;
}

export const operatorHandlers = [
  // Taklif (BE-13): sahifa yangilanganda holat «Oflayn» dan boshlanmasin.
  http.get(`${API}/operator/state`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    sweep();
    return ok(stateDto());
  }),

  http.put(`${API}/operator/state`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['UpdateOperatorStateDto']>;
    if (body.state !== 'ONLINE' && body.state !== 'BREAK' && body.state !== 'OFFLINE') {
      return fail(400, 'VALIDATION_ERROR', 'state: ONLINE, BREAK yoki OFFLINE');
    }
    if (body.state !== db.operator.state) current().stateSince = new Date().toISOString();
    db.operator.state = body.state;
    // Tanaffus va oflayn — bronlar navbatga qaytadi; rejalashtirilganlar operatorda qoladi (operator-karkas 3).
    if (body.state !== 'ONLINE') {
      for (const lead of mine().filter((item) => item.status === 'BOOKED')) release(lead, 'Operator tanaffusga chiqdi — navbatga qaytdi');
    }
    return ok(stateDto());
  }),

  // Operator ham o'qiydi: «Navbatda: 14 ta lid — 6 qayta qo'ng'iroq, 8 yangi» (operator-bosh).
  http.get(`${API}/operator/queue-summary`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, ['OPERATOR_LEAD', 'SUPERVISOR', 'ADMIN', 'SUPERADMIN']);
    if (denied) return denied;
    sweep();
    const now = Date.now();
    const pool = all().filter((lead) => !current().owned.has(lead.id) && isOpen(lead));
    const summary: Schemas['OperatorQueueSummaryDto'] = {
      newLeads: pool.filter((lead) => lead.status === 'NEW').length,
      dueCallbacks: pool.filter((lead) => isDue(lead, now)).length + mine().filter((lead) => isDue(lead, now)).length,
      booked: activeBookings(),
      operators: [
        { operatorId: 'U-0003', name: OPERATOR, state: db.operator.state, activeBookings: activeBookings() },
        { operatorId: 'U-0031', name: 'Feruza Y.', state: 'BREAK', activeBookings: 0 },
      ],
    };
    return ok(summary);
  }),

  http.get(`${API}/operator/leads`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    sweep();
    return ok(mine().filter((lead) => lead.status === 'BOOKED' || lead.status === 'CALLBACK').map(listItem));
  }),

  http.post(`${API}/operator/leads/next`, ({ request, cookies }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    sweep();
    if (db.operator.state === 'BREAK') return fail(409, 'OPERATOR_ON_BREAK', 'Operator tanaffusda');
    if (db.operator.state === 'OFFLINE') return fail(409, 'OPERATOR_OFFLINE', 'Operator oflayn');
    if (activeBookings() >= db.operator.maxBookings) return fail(409, 'BOOKING_LIMIT_REACHED', 'Bronlar to‘la');
    const lead = pickNext();
    if (!lead) return fail(404, 'LEAD_QUEUE_EMPTY', 'Navbat bo‘sh');
    const booked: LeadCard = { ...withStatus(lead, 'BOOKED', shortName(user?.name), null), bookedUntil: ahead(BOOKING_MINUTES) };
    current().leads.set(lead.id, booked);
    current().owned.add(lead.id);
    return ok(booked);
  }),

  http.get(`${API}/operator/leads/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    sweep();
    const lead = mine().find((item) => item.id === String(params.id));
    return lead ? ok(lead) : fail(404, 'NOT_FOUND', 'Lid topilmadi yoki bron muddati tugagan');
  }),

  // Taklif (BE-13 / OPT-2): «Mahsulot ma'lumoti» paneli.
  http.get(`${API}/operator/leads/:id/product`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const lead = current().leads.get(String(params.id));
    return lead ? ok(productInfo(lead)) : fail(404, 'NOT_FOUND', 'Lid topilmadi');
  }),

  http.post(`${API}/operator/leads/:id/result`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    sweep();
    const lead = mine().find((item) => item.id === String(params.id) && (item.status === 'BOOKED' || item.status === 'CALLBACK'));
    if (!lead) return fail(404, 'NOT_FOUND', 'Lid topilmadi yoki bron muddati tugagan');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['SubmitLeadResultDto']>;
    const invalid = validateResult(lead, body);
    if (invalid || !body.outcome) return invalid ?? fail(400, 'VALIDATION_ERROR', 'Natija tanlanmagan');

    const { outcome } = body;
    const now = Date.now();
    const operator = shortName(user?.name);
    const comment = body.comment?.trim() || null;
    const attempts = [...lead.attempts, { at: new Date(now).toISOString(), operatorName: operator, outcome, comment }];
    let status = OUTCOME_STATUS[outcome];
    let nextAttemptAt: string | null = null;
    let note = comment;

    if (outcome === 'CALL_LATER' || outcome === 'THINKING') {
      // «O'ylab ko'radi» vaqtsiz — ertasi kuni (TZ 5); soat TZ'da yo'q, 10:00 [namuna].
      const requested = body.callbackAt ? Date.parse(body.callbackAt) : tashkentMoment(addDays(tashkentParts(now).date, 1), '10:00');
      nextAttemptAt = new Date(clampToCallWindow(requested)).toISOString();
    } else if (isNoAnswer(outcome)) {
      const failed = attempts.filter((item) => isNoAnswer(item.outcome)).length;
      if (closesAsNoContact(failed, Date.parse(lead.createdAt), now)) {
        status = 'NO_CONTACT';
        note = 'Aloqa bo‘lmadi — 6 urinish yoki 3 kun';
      } else {
        nextAttemptAt = new Date(nextRetryAt(failed, now)).toISOString();
      }
    }

    current().leads.set(lead.id, {
      ...withStatus(lead, status, operator, note),
      attempts,
      attemptsCount: attempts.length,
      bookedUntil: null,
      nextAttemptAt,
      rejectReason: outcome === 'REJECTED' ? body.rejectReason ?? null : lead.rejectReason,
      quantity: body.quantity ?? lead.quantity,
      orderId: outcome === 'CONFIRMED' ? `O-${seeded(lead.id, 4000, 4999)}` : lead.orderId,
    });
    current().log.unshift({
      at: new Date(now).toISOString(), leadId: lead.id, customerName: lead.customerName, productName: lead.product.name, outcome,
      comment, rejectReason: outcome === 'REJECTED' ? body.rejectReason ?? null : null, nextAttemptAt, durationSeconds: null,
    });
    // «Keyinroq» va «O'ylab ko'radi» — lid operatorda qoladi; javobsiz — umumiy navbatga; qolgani yopiladi.
    if (outcome !== 'CALL_LATER' && outcome !== 'THINKING') current().owned.delete(lead.id);
    const accepted: Schemas['LeadResultAcceptedDto'] = { leadId: lead.id, status, nextAttemptAt };
    return ok(accepted);
  }),

  http.patch(`${API}/operator/leads/:id/address`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const lead = mine().find((item) => item.id === String(params.id));
    if (!lead) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['UpdateLeadAddressDto']>;
    const region = REGION_TREE.find((item) => item.satoCode === body.regionSoato);
    const district = region?.districts.find((item) => item.satoCode === body.districtSoato);
    if (!region || !district || !body.addressLine?.trim() || !body.whereDeliver) {
      return fail(400, 'VALIDATION_ERROR', 'Tuman tanlangan viloyatga tegishli emas yoki maydon bo‘sh');
    }
    const edited = lead.address !== null && (body.addressLine.trim() !== lead.address.addressLine || body.districtSoato !== lead.address.districtSoato);
    const deliveryFee = body.whereDeliver === 'ADDRESS' ? ADDRESS_FEE : CENTER_FEE;
    const subtotal = lead.product.salePrice * lead.quantity;
    const updated: LeadCard = {
      ...lead,
      address: {
        regionSoato: region.satoCode,
        regionName: region.name,
        districtSoato: district.satoCode,
        districtName: district.name,
        addressLine: body.addressLine.trim(),
        whereDeliver: body.whereDeliver,
        confirmedAt: new Date().toISOString(),
        editedByOperator: Boolean(lead.address?.editedByOperator) || edited,
      },
      price: { unitPrice: lead.product.salePrice, quantity: lead.quantity, subtotal, whereDeliver: body.whereDeliver, deliveryFee, totalAmount: subtotal + deliveryFee },
    };
    current().leads.set(lead.id, updated);
    return ok(updated);
  }),

  http.post(`${API}/operator/leads/:id/quote`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const lead = current().leads.get(String(params.id));
    if (!lead) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['LeadPriceQuoteDto']>;
    const quantity = Math.max(1, Math.min(10, Number(body.quantity) || 1));
    const whereDeliver = body.whereDeliver === 'ADDRESS' ? 'ADDRESS' : 'CENTER';
    const deliveryFee = whereDeliver === 'ADDRESS' ? ADDRESS_FEE : CENTER_FEE;
    const subtotal = lead.product.salePrice * quantity;
    const price: Schemas['LeadPriceDto'] = { unitPrice: lead.product.salePrice, quantity, subtotal, whereDeliver, deliveryFee, totalAmount: subtotal + deliveryFee };
    return ok(price);
  }),

  // Taklif (BE-13): «Bugungi urinishlarim · oxirgi 10 tasi, jami N».
  http.get(`${API}/operator/attempts`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 10));
    return ok({ items: current().log.slice(0, limit), total: 28 + current().log.length });
  }),

  http.get(`${API}/operator/stats`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const stats: Schemas['OperatorStatsDto'] = { attempts: 38, confirmed: 9, approveRate: 0.41, saleRate: 0.72, firstCallMedianMinutes: 4 };
    return ok(stats);
  }),
];
