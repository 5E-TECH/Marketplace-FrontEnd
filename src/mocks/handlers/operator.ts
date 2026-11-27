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
import type {
  DeliveryMode,
  LeadAddressChange,
  LeadCard,
  LeadPrice,
  LeadProductInfo,
  LeadResultAccepted,
  OperatorAttemptItem,
  OperatorLeadListItem,
  OperatorStateInfo,
  WhereDeliver,
} from '../../features/operator/model/operatorTypes';
import { addDays } from '../../shared/lib/tashkentTime';
import { db, MOCK_PRODUCTS } from '../db';
import { mockPricingParams, TARIFF } from '../fixtures/adminProducts';
import { REGION_TREE } from '../fixtures/regions';
import { createOrderFromLead, MOCK_OPERATORS, mockOperatorLoad } from '../orderStore';
import { deliveryView, elchiTariffFor } from '../pricingCalculator';
import { API, fail, ok, seeded } from '../utils';
import { currentMockUser } from './auth';

type Schemas = components['schemas'];
type LeadStatus = LeadCard['status'];

/**
 * Operator navbati (BE-13 / BE-25: /operator/*). Qoidalar backend'dagidek (TZ 5-bo'lim):
 * lid faqat «Onlayn»da, ≤ 5 bron, bron 10 daqiqa; navbat tartibi — avval vaqti kelgan
 * qayta qo'ng'iroqlar (o'zingiz rejalashtirganlari birinchi), keyin eng yangi lidlar;
 * natija tekshiruvi (sabab, vaqt, manzil); javobsiz urinishlar jadvali; muddati o'tgan
 * bron va kechikkan rejalashtirilgan qo'ng'iroq navbatga qaytadi.
 * FE-09: narx obyekti backend formulasi bilan (BE-09: yetkazish jami og'irlikka qarab), manzil tuzatish tarixi,
 * qoldiq va band qilish (taklif maydonlari — docs/api-taklif/fe-09-operator-buyurtma.md).
 */
const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();
const ahead = (minutes: number) => new Date(Date.now() + minutes * MINUTE).toISOString();
const money = (value: number) => value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const OPERATOR = 'Dilnoza R.';

/**
 * Lid sahifasidagi tovar (narx, og'irlik, yetkazish rejimi, ombordagi qoldiq). Dastlabki uchtasi — umumiy
 * mock mahsulotlar; qolganlari FE-09 holatlari uchun (og'ir tovar alohida rejimda, oxirgi dona, bepul rejim,
 * og'irligi kiritilmagan — summa hisoblanmaydi).
 */
interface MockOffer {
  id: string;
  name: string;
  salePrice: number;
  weightGrams: number | null;
  deliveryMode: DeliveryMode;
  stock: number;
  category: string;
}

// Kechiktirib: `db.ts` bu faylni import qiladi (aylana import) — `MOCK_PRODUCTS` modul yuklanganda hali yo'q.
let offerList: readonly MockOffer[] | null = null;
const offers = (): readonly MockOffer[] => (offerList ??= [
  { ...MOCK_PRODUCTS[0], weightGrams: 300, deliveryMode: 'PARTIAL', stock: 120, category: 'Elektronika' },
  { ...MOCK_PRODUCTS[1], weightGrams: 1_200, deliveryMode: 'PARTIAL', stock: 120, category: 'Uy-ro‘zg‘or' },
  { ...MOCK_PRODUCTS[2], weightGrams: 1_400, deliveryMode: 'PARTIAL', stock: 120, category: 'Uy-ro‘zg‘or' },
  { id: '520', name: 'Changyutgich', salePrice: 414_000, weightGrams: 5_600, deliveryMode: 'SEPARATE', stock: 14, category: 'Uy-ro‘zg‘or' },
  { id: '521', name: 'Bolalar termos shishasi', salePrice: 180_000, weightGrams: 450, deliveryMode: 'PARTIAL', stock: 1, category: 'Bolalar uchun' },
  { id: '522', name: 'Aqlli soat', salePrice: 294_000, weightGrams: 200, deliveryMode: 'FREE', stock: 40, category: 'Elektronika' },
  { id: '523', name: 'Yoga gilamchasi', salePrice: 159_000, weightGrams: null, deliveryMode: 'PARTIAL', stock: 25, category: 'Sport' },
]);
const offerOf = (productId: string) => offers().find((item) => item.id === productId) ?? offers()[0];

const extraKg = (grams: number) => Math.max(0, Math.ceil((grams - TARIFF.baseWeightGrams) / 1000));

/**
 * Ko'rinadigan yetkazish (backend `pricing.service.ts` `quoteFor`): bir donadagi ko'rinadigan summa + og'irlik
 * oshgani uchun tarif farqi; bepul rejimda 0. Og'irlik bo'lmasa — hisoblanmaydi (null).
 */
function deliveryQuote(offer: MockOffer, quantity: number, where: WhereDeliver) {
  if (offer.weightGrams === null) return null;
  const params = mockPricingParams({ deliveryMode: offer.deliveryMode, deliveryModeSource: 'PRODUCT' });
  const unit = deliveryView(params, TARIFF, offer.weightGrams);
  const address = where === 'ADDRESS';
  const weightGrams = offer.weightGrams * quantity;
  const tariff = elchiTariffFor(TARIFF, weightGrams, address);
  const visibleUnit = address ? unit.visibleAddress : unit.visibleCenter;
  const unitTariff = address ? unit.tariffAddress : unit.tariffCenter;
  const fee = offer.deliveryMode === 'FREE' ? 0 : Math.min(tariff, visibleUnit + (tariff - unitTariff));
  const formula: LeadPrice['deliveryFormula'] = offer.deliveryMode === 'FREE' ? null
    : offer.deliveryMode === 'SEPARATE'
      ? { base: TARIFF.centerBase + (address ? TARIFF.addressExtra : 0), extraKg: extraKg(weightGrams), perExtraKg: TARIFF.perExtraKg, baseWeightGrams: TARIFF.baseWeightGrams }
      : { base: visibleUnit, extraKg: extraKg(weightGrams) - extraKg(offer.weightGrams), perExtraKg: TARIFF.perExtraKg, baseWeightGrams: TARIFF.baseWeightGrams };
  return { fee, formula, weightGrams };
}

/** Oldindan to'lov usuli — 6-savol javobigacha namuna [taklif]. */
const PREPAYMENT_METHOD = 'SMS-havola orqali (Click yoki Payme)';

/** Lid kartasidagi `price` va `POST …/quote` javobi (taklif maydonlari bilan). */
function priceFor(offer: MockOffer, quantity: number, whereDeliver: WhereDeliver, blacklisted = false): LeadPrice | null {
  const quote = deliveryQuote(offer, quantity, whereDeliver);
  if (!quote) return null;
  const subtotal = offer.salePrice * quantity;
  const options = { CENTER: deliveryQuote(offer, quantity, 'CENTER')?.fee ?? 0, ADDRESS: deliveryQuote(offer, quantity, 'ADDRESS')?.fee ?? 0 };
  return {
    unitPrice: offer.salePrice, quantity, subtotal, whereDeliver, deliveryFee: quote.fee, totalAmount: subtotal + quote.fee,
    deliveryMode: offer.deliveryMode, weightGrams: quote.weightGrams, deliveryOptions: options, deliveryFormula: quote.formula,
    prepayment: blacklisted ? { amount: quote.fee, method: PREPAYMENT_METHOD } : null,
  };
}

const ADDRESSES: ReadonlyArray<Omit<NonNullable<LeadCard['address']>, 'whereDeliver' | 'confirmedAt' | 'editedByOperator'>> = [
  { regionSoato: '1730', regionName: 'Farg‘ona viloyati', districtSoato: '1730412', districtName: 'Qo‘qon shahri', addressLine: 'Turkiston ko‘chasi, 27-uy' },
  { regionSoato: '1726', regionName: 'Toshkent shahri', districtSoato: '1726266', districtName: 'Yunusobod tumani', addressLine: '19-mavze, 4-uy, 27-xonadon' },
  { regionSoato: '1718', regionName: 'Samarqand viloyati', districtSoato: '1718401', districtName: 'Samarqand shahri', addressLine: 'Registon ko‘chasi, 5-uy' },
  { regionSoato: '1722', regionName: 'Surxondaryo viloyati', districtSoato: '1722401', districtName: 'Termiz shahri', addressLine: 'Alpomish ko‘chasi, 3-uy' },
  { regionSoato: '1703', regionName: 'Andijon viloyati', districtSoato: '1703401', districtName: 'Andijon shahri', addressLine: 'Bobur shoh ko‘chasi, 44-uy' },
  { regionSoato: '1724', regionName: 'Sirdaryo viloyati', districtSoato: '1724401', districtName: 'Guliston shahri', addressLine: 'Mustaqillik ko‘chasi, 8-uy' },
  { regionSoato: '1730', regionName: 'Farg‘ona viloyati', districtSoato: '1730209', districtName: 'Bag‘dod tumani', addressLine: 'Navbahor ko‘chasi, 14-uy' },
];

const NAMES = ['Mohira', 'Gulnoza', 'Oybek', 'Saida', 'Nodir', 'Kamola'];

const addressText = (address: NonNullable<LeadCard['address']>) => `${address.regionName}, ${address.districtName}, ${address.addressLine}`;
const WHERE_TEXT: Record<WhereDeliver, string> = { CENTER: 'markazgacha', ADDRESS: 'eshikkacha' };

/**
 * Suhbat skripti — o'zgaruvchilarni server qo'yadi (admin-skript): ism, tovar, narx, yetkazish va manzil
 * (DZ-12: 4-qadam «Manzilni tasdiqlaymiz»).
 */
function script(lead: LeadCard): string {
  const { customerName: name, product, price, address } = lead;
  const fee = price?.deliveryFee ?? null;
  const priceLine = fee === null
    ? `Narxi ${money(product.salePrice)} so‘m. To‘lov tovarni olganingizda.`
    : fee === 0
      ? `Narxi ${money(product.salePrice)} so‘m, yetkazish bepul. To‘lov tovarni olganingizda.`
      : `Narxi ${money(product.salePrice)} so‘m, yetkazish viloyat va tuman markazigacha ${money(fee)} so‘m, jami ${money(product.salePrice + fee)} so‘m. To‘lov tovarni olganingizda.`;
  return [
    `Assalomu alaykum, ${name}! Elchi Market’dan qo‘ng‘iroq qilyapman. Suhbat sifat nazorati uchun yozib olinadi.`,
    `Siz «${product.name}» uchun ariza qoldirgan edingiz. Buyurtmani rasmiylashtiramizmi?`,
    priceLine,
    address
      ? `Manzilni tasdiqlaymiz: ${addressText(address)}, yetkazish ${WHERE_TEXT[address.whereDeliver]}. To‘g‘rimi?`
      : 'Manzilni aniqlaymiz: viloyat, tuman yoki shahar, ko‘cha va uy; markazgacha yoki eshikkacha.',
  ].join('\n');
}

interface Seed {
  id: string;
  name: string;
  /** `MOCK_PRODUCTS` indeksi yoki FE-09 tovari (`offers()` id si). */
  product: number | string;
  address: number | null;
  status?: LeadStatus;
  source?: LeadCard['source'];
  createdMinutesAgo: number;
  attempts?: LeadCard['attempts'];
  previousLeads?: LeadCard['previousLeads'];
  stockShortage?: boolean;
  bookedUntil?: string | null;
  nextAttemptAt?: string | null;
  quantity?: number;
  /** Ketma-ket rad etgan mijoz (TZ 7): `blacklistRejections`. */
  blacklist?: number;
}

function makeLead(seed: Seed): LeadCard {
  const offer = typeof seed.product === 'string' ? offerOf(seed.product) : offers()[seed.product % MOCK_PRODUCTS.length];
  const address = seed.address === null ? null : ADDRESSES[seed.address % ADDRESSES.length];
  const attempts = seed.attempts ?? [];
  const created = ago(seed.createdMinutesAgo);
  const quantity = seed.quantity ?? 1;
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
    product: { id: offer.id, name: offer.name, salePrice: offer.salePrice },
    quantity,
    address: address && { ...address, whereDeliver: 'CENTER', confirmedAt: null, editedByOperator: false },
    // Backend: manzil (yetkazish turi) bo'lmasa narx obyekti yo'q.
    price: address ? priceFor(offer, quantity, 'CENTER', Boolean(seed.blacklist)) : null,
    rejectReason: null,
    callScript: null,
    stockShortage: seed.stockShortage ?? false,
    blacklistRejections: seed.blacklist ?? null,
    attemptsCount: attempts.length,
    bookedUntil: seed.bookedUntil ?? null,
    nextAttemptAt: seed.nextAttemptAt ?? null,
    orderId: null,
    attempts,
    history,
    previousLeads: seed.previousLeads ?? [],
    // BE-34: bitta tovarli lid — `items` bo'sh; tasdiqlash — operator qo'ng'irog'i.
    items: [],
    confirmMode: 'CALL',
    createdAt: created,
  };
}

/**
 * Javobdagi karta: skript — admin offer sozlamasida yozilgani (FE-12 TC3, `PUT /admin/offer-content`), bo'lmasa
 * namuna skript joriy narx va manzil bilan (o'zgaruvchilarni server qo'yadi).
 */
function present(lead: LeadCard): LeadCard {
  return { ...lead, callScript: db.offerContents[lead.product.id]?.callScript ?? script(lead) };
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
  /** Ombordagi sotuvga bor dona (band qilinganda kamayadi). */
  stock: Map<string, number>;
  /** Tasdiq paytida oxirgi donani boshqa buyurtma band qiladi (FE-09 19-kadr: ikki parallel tasdiq). */
  raceOnce: Set<string>;
  /** Mijoz sahifada yozgan manzil (operator tuzatsa ham) — buyurtma kartasida «Mijoz yozgani» (FE-26 TC5). */
  originals: Map<string, LeadCard['address']>;
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
    ...NAMES.map((name, index) => ({ id: `L-12${60 + index}`, name, product: index, address: index % 5, createdMinutesAgo: 25 + index * 7 })),
    // FE-09 holatlari (navbat oxirida — FE-08 tartibi o'zgarmaydi): miqdor > qoldiq va oxirgi dona, qora ro'yxat,
    // og'ir tovar alohida rejimda, bepul rejim, og'irligi yo'q (summa hisoblanmaydi), eshikkacha bormaydigan tuman.
    { id: 'L-1233', name: 'Kamron', product: '521', address: 2, quantity: 2, createdMinutesAgo: 95 },
    { id: 'L-1241', name: 'Gulchehra', product: 0, address: 5, blacklist: 2, createdMinutesAgo: 100 },
    { id: 'L-1244', name: 'Bekzod', product: '520', address: 1, createdMinutesAgo: 105 },
    { id: 'L-1246', name: 'Sevinch', product: '522', address: 4, createdMinutesAgo: 110 },
    { id: 'L-1248', name: 'Ulug‘bek', product: '523', address: 3, createdMinutesAgo: 115 },
    { id: 'L-1249', name: 'Zuhra', product: 0, address: 6, createdMinutesAgo: 120 },
  ];
  const leads = new Map(seeds.map((seed) => [seed.id, makeLead(seed)]));
  return {
    leads, owned: new Set(['L-1284', 'L-1255', 'L-1253']), returned: [], stateSince: ago(20), log: seedLog(),
    stock: new Map(offers().map((offer) => [offer.id, offer.stock])), raceOnce: new Set(['L-1233']),
    originals: new Map([...leads.values()].map((lead) => [lead.id, lead.address])),
  };
}

// Kechiktirib yaratiladi: `db.ts` bu faylni reset uchun import qiladi (aylana import).
let store: OperatorStore | null = null;
const current = () => (store ??= createStore());

export function resetMockOperator(): void {
  store = null;
}

// ── FE-26: admin/nazoratchi lidlar va buyurtmalar shu store'dan o'qiydi ──

/** Lid kelgan sotuvchi sahifasi (mock): dizayndagi Aziza — k7m2qa (Jasur T.), qolganlari barqaror tanlov. */
const STREAMS = ['k7m2qa', 'p3v9tx', 'd2h6va', 'r9c4mn'] as const;
const STREAM_OF: Record<string, string> = { 'L-1284': 'k7m2qa', 'L-1287': 'd2h6va', 'L-1291': 'h2q7vz' };
export const mockStreamOf = (leadId: string) => STREAM_OF[leadId] ?? STREAMS[seeded(leadId, 0, STREAMS.length - 1)];

export const mockOperatorLeads = (): LeadCard[] => all();
/** Dilnoza R. — operator ish joyidagi holat; qolganlar — `MOCK_OPERATORS` dagi doimiy holat. */
export const mockOperatorState = (id: string) => (id === 'U-0003' ? db.operator.state : MOCK_OPERATORS.find((item) => item.id === id)?.state ?? 'OFFLINE');

/** queue-summary operatori + taklif maydonlari (`maxBookings`, `scheduledCalls`, `activity`) — o'tkazish oynasi. */
export function mockQueueOperator(item: (typeof MOCK_OPERATORS)[number]) {
  const load = mockOperatorLoad(item.id);
  const mineNow = item.id === 'U-0003';
  return {
    operatorId: item.id,
    name: item.name,
    state: mockOperatorState(item.id),
    activeBookings: (mineNow ? activeBookings() : item.bookings) + load.bookings,
    maxBookings: db.operator.maxBookings,
    scheduledCalls: (mineNow ? mine().filter((lead) => lead.status === 'CALLBACK').length : item.scheduled) + load.scheduled,
    activity: item.activity ? { kind: item.activity.kind, leadId: item.activity.leadId, since: new Date(Date.now() - item.activity.seconds * 1000).toISOString() } : null,
    // Taklif (fe-15 §13): holat qachondan — «13:15 dan», «tanaffus 22 daq».
    since: mineNow ? current().stateSince : item.since === undefined ? null : new Date(Date.now() - item.since * 60_000).toISOString(),
  };
}
export const mockOwnedByMe = (id: string) => current().owned.has(id);
export const mockOriginalAddress = (id: string) => current().originals.get(id) ?? null;
export const mockOfferOf = (productId: string) => offerOf(productId);
export const mockStock = (productId: string) => current().stock.get(productId) ?? 0;

/** Admin amali lidni o'zgartiradi (qayta ochish, o'tkazish, bronni bo'shatish). */
export function updateMockOperatorLead(id: string, update: (lead: LeadCard) => LeadCard, owned?: boolean): LeadCard | null {
  const lead = current().leads.get(id);
  if (!lead) return null;
  const next = update(lead);
  current().leads.set(id, next);
  if (owned === true) current().owned.add(id);
  if (owned === false) current().owned.delete(id);
  return next;
}

/** Bekor qilingan buyurtma: band tovar darhol bo'shaydi (BUY-3). */
export function releaseMockStock(productId: string, quantity: number): void {
  current().stock.set(productId, (current().stock.get(productId) ?? 0) + quantity);
}

/** «Buyurtma tasdiqlandi» — lid ma'lumotlari bilan buyurtma (FE-26: ro'yxat va kartada). */
function confirmOrder(lead: LeadCard, quantity: number, operatorName: string) {
  const offer = offerOf(lead.product.id);
  const address = lead.address;
  const original = current().originals.get(lead.id) ?? null;
  return createOrderFromLead({
    leadId: lead.id,
    name: lead.customerName,
    phone: `+998 90 ${lead.id.slice(2, 5)} ${lead.id.slice(-2)} ${seeded(lead.id, 10, 99)}`,
    regionSoato: address?.regionSoato ?? '',
    districtSoato: address?.districtSoato ?? '',
    addressLine: address?.addressLine ?? '',
    whereDeliver: address?.whereDeliver ?? 'CENTER',
    original: original ? { regionSoato: original.regionSoato, districtSoato: original.districtSoato, addressLine: original.addressLine, whereDeliver: original.whereDeliver } : null,
    operatorName: MOCK_OPERATORS.some((item) => item.name === operatorName) ? operatorName : OPERATOR,
    product: { id: offer.id, name: offer.name, weightGrams: offer.weightGrams },
    quantity,
    unitPrice: lead.product.salePrice,
    deliveryFee: lead.price?.deliveryFee ?? 0,
    deliveryMode: offer.deliveryMode,
    streamCode: mockStreamOf(lead.id),
    leadCreatedAt: lead.createdAt,
    blacklist: Boolean(lead.blacklistRejections),
  });
}

/**
 * Test va namoyish uchun: navbatdagi lidni shu operatorga bron qiladi (FE-09 holatlari navbat oxirida turadi).
 * Playwright handler'lari test jarayonida ishlaydi — test shu funksiyani to'g'ridan-to'g'ri chaqiradi.
 */
export function bookMockLead(id: string): void {
  const lead = current().leads.get(id);
  if (!lead) throw new Error(`Mock lid topilmadi: ${id}`);
  current().leads.set(id, { ...withStatus(lead, 'BOOKED', OPERATOR, null), bookedUntil: ahead(BOOKING_MINUTES) });
  current().owned.add(id);
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
  return { state: db.operator.state, activeBookings: activeBookings(), maxBookings: db.operator.maxBookings, since: current().stateSince, callEnabled: false };
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

/** Shu lid tovari uchun omborda sotuvga bor dona (qoldiq tugagan lidda — 0). */
const stockOf = (lead: LeadCard) => (lead.stockShortage ? 0 : current().stock.get(lead.product.id) ?? 0);

function productInfo(lead: LeadCard): LeadProductInfo {
  const offer = offerOf(lead.product.id);
  const center = deliveryQuote(offer, 1, 'CENTER');
  const address = deliveryQuote(offer, 1, 'ADDRESS');
  return {
    id: offer.id,
    name: offer.name,
    category: offer.category,
    imageUrl: null,
    description: `${offer.name} — kundalik foydalanish uchun. Tavsif optovik kartasidan olinadi.`,
    highlights: ['Kafolat va sertifikat — optovik hujjatlarida', 'Tovar platforma omborida', 'To‘lov tovarni olganda'],
    available: stockOf(lead),
    weightKg: offer.weightGrams === null ? null : offer.weightGrams / 1000,
    contents: null,
    salePrice: lead.product.salePrice,
    deliveryFee: center && address ? { CENTER: center.fee, ADDRESS: address.fee } : null,
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
      operators: MOCK_OPERATORS.map(mockQueueOperator),
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
    return ok(present(booked));
  }),

  http.get(`${API}/operator/leads/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    sweep();
    const lead = mine().find((item) => item.id === String(params.id));
    return lead ? ok(present(lead)) : fail(404, 'NOT_FOUND', 'Lid topilmadi yoki bron muddati tugagan');
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
    // Band qilish (BE-16; sinxron xato — taklif): miqdor qoldiqdan ko'p yoki oxirgi dona shu soniyada band bo'ldi.
    let stockAvailable: number | null = null;
    if (outcome === 'CONFIRMED') {
      const quantity = body.quantity ?? lead.quantity;
      const available = stockOf(lead);
      if (quantity > available) return fail(409, 'OUT_OF_STOCK', `Omborda ${available} dona bor`, undefined, { available });
      if (current().raceOnce.delete(lead.id)) {
        current().stock.set(lead.product.id, 0);
        return fail(409, 'OUT_OF_STOCK', 'Oxirgi dona boshqa buyurtmaga band bo‘ldi', undefined, { available: 0 });
      }
      stockAvailable = available - quantity;
      current().stock.set(lead.product.id, stockAvailable);
    }
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
      orderId: outcome === 'CONFIRMED' ? confirmOrder(lead, body.quantity ?? lead.quantity, operator).id : lead.orderId,
    });
    current().log.unshift({
      at: new Date(now).toISOString(), leadId: lead.id, customerName: lead.customerName, productName: lead.product.name, outcome,
      comment, rejectReason: outcome === 'REJECTED' ? body.rejectReason ?? null : null, nextAttemptAt, durationSeconds: null,
    });
    // «Keyinroq» va «O'ylab ko'radi» — lid operatorda qoladi; javobsiz — umumiy navbatga; qolgani yopiladi.
    if (outcome !== 'CALL_LATER' && outcome !== 'THINKING') current().owned.delete(lead.id);
    const accepted: LeadResultAccepted = { leadId: lead.id, status, nextAttemptAt, ...(outcome === 'CONFIRMED' ? { stockAvailable } : {}) };
    return ok(accepted);
  }),

  // BE-38: saqlash — tasdiq; tuzatilgan maydonlar eski va yangi qiymati bilan lid tarixiga (`changes` — taklif).
  http.patch(`${API}/operator/leads/:id/address`, async ({ request, cookies, params }) => {
    const { denied, user } = guard(request, cookies);
    if (denied) return denied;
    const lead = mine().find((item) => item.id === String(params.id) && (item.status === 'BOOKED' || item.status === 'CALLBACK'));
    if (!lead) return fail(404, 'NOT_FOUND', 'Lid topilmadi yoki bu operatorda emas');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['UpdateLeadAddressDto']>;
    const fieldError = (field: keyof Schemas['UpdateLeadAddressDto'], message: string) =>
      fail(400, 'VALIDATION_ERROR', message, undefined, { details: [{ field, error: message }] });
    const region = REGION_TREE.find((item) => item.satoCode === body.regionSoato);
    if (!region) return fieldError('regionSoato', 'Viloyat Elchi ro‘yxatida yo‘q');
    const district = region.districts.find((item) => item.satoCode === body.districtSoato);
    if (!district) return fieldError('districtSoato', 'Tuman tanlangan viloyatga tegishli emas');
    const line = body.addressLine?.trim() ?? '';
    if (!line) return fieldError('addressLine', 'Ko‘cha va uy kiritilmagan');
    const where = body.whereDeliver;
    if (where !== 'CENTER' && where !== 'ADDRESS') return fieldError('whereDeliver', 'Yetkazish turi tanlanmagan');
    if (where === 'ADDRESS' && district.doorDelivery === false) return fieldError('whereDeliver', 'Elchi Pochta bu tumanda eshikkacha olib bormaydi');

    const before = lead.address;
    const changes: LeadAddressChange[] = [];
    if (before?.regionSoato !== region.satoCode) changes.push({ field: 'region', from: before?.regionName ?? null, to: region.name });
    if (before?.districtSoato !== district.satoCode) changes.push({ field: 'district', from: before?.districtName ?? null, to: district.name });
    if (before?.addressLine !== line) changes.push({ field: 'addressLine', from: before?.addressLine ?? null, to: line });
    if (before?.whereDeliver !== where) changes.push({ field: 'whereDeliver', from: before?.whereDeliver ?? null, to: where });
    const at = new Date().toISOString();
    const actor = shortName(user?.name);
    const entry = (note: string, list: LeadAddressChange[]) => ({ at, fromStatus: lead.status, toStatus: lead.status, actor, note, changes: list });
    const updated: LeadCard = {
      ...lead,
      address: {
        regionSoato: region.satoCode,
        regionName: region.name,
        districtSoato: district.satoCode,
        districtName: district.name,
        addressLine: line,
        whereDeliver: where,
        confirmedAt: at,
        editedByOperator: Boolean(before?.editedByOperator) || (before !== null && changes.length > 0),
      },
      price: priceFor(offerOf(lead.product.id), lead.quantity, where, Boolean(lead.blacklistRejections)),
      // Mijoz manzili birinchi marta kiritilsa (API lidi) — bu tuzatish emas, faqat tasdiq.
      history: [...lead.history, ...(before && changes.length ? [entry('Operator manzilni tuzatdi', changes)] : []), entry('Operator manzilni tasdiqladi', [])],
    };
    current().leads.set(lead.id, updated);
    return ok(present(updated));
  }),

  // Summa (BE-09): yetkazish jami og'irlikka qarab; lid o'zgarmaydi. Og'irlik bo'lmasa — 400 (backend kabi).
  http.post(`${API}/operator/leads/:id/quote`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const lead = mine().find((item) => item.id === String(params.id));
    if (!lead) return fail(404, 'NOT_FOUND', 'Lid topilmadi yoki bu operatorda emas');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['LeadPriceQuoteDto']>;
    const quantity = Number(body.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) return fail(400, 'VALIDATION_ERROR', 'Miqdor 1 dan 1000 gacha butun son');
    const whereDeliver = body.whereDeliver === 'ADDRESS' ? 'ADDRESS' : 'CENTER';
    const price = priceFor(offerOf(lead.product.id), quantity, whereDeliver, Boolean(lead.blacklistRejections));
    return price ? ok(price) : fail(400, 'VALIDATION_ERROR', 'Narx hisoblash uchun bazaviy narx va og‘irlik kerak (BE-07)');
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
