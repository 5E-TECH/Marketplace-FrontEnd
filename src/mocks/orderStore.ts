import type { WhereDeliver } from '../features/operator/model/operatorTypes';
import type { CustomerRequest, JournalState, MoneyState, OrderDetail, OrderHistoryEntry, OrderListItem, OrderStatus } from '../features/orders/model/orderTypes';
import { AT_ELCHI, ORDER_PATH } from '../features/orders/lib/orderStatus';
import { REGION_TREE } from './fixtures/regions';
import { tashkentDate } from '../shared/lib/tashkentTime';

/**
 * Lid buyurtmalari ombori (BE-18 mock): operator «Buyurtma tasdiqlandi» saqlaganda yangi buyurtma shu yerga tushadi
 * (operator handler), admin/nazoratchi/operator ro'yxatlari va kartasi shu yerdan. Handler'lardan mustaqil — aylana
 * import yo'q. Namuna buyurtmalar — admin-buyurtmalar dizaynidagilar (raqamlar operator mock lidlari bilan to'qnashmasin).
 */
const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();

export interface MockOrder {
  id: string;
  leadId: string;
  status: OrderStatus;
  createdAt: string;
  statusAt: string;
  statusDetail: string | null;
  name: string;
  phone: string;
  regionSoato: string;
  districtSoato: string;
  addressLine: string;
  whereDeliver: WhereDeliver;
  original: { regionSoato: string; districtSoato: string; addressLine: string; whereDeliver: WhereDeliver } | null;
  editedBy: { name: string; at: string } | null;
  product: { id: string; name: string; category: string; wholesalerName: string; weightGrams: number };
  quantity: number;
  unitPrice: number;
  deliveryFee: number;
  deliveryMode: 'SEPARATE' | 'PARTIAL' | 'FREE';
  stream: { code: string; affiliateName: string; affiliateId: string; sub1: string | null };
  confirmedBy: { id: string; name: string; at: string };
  leadCreatedAt: string;
  track: string | null;
  picker: string | null;
  /** Oxirgi qayta chop etish (taklif `POST /admin/orders/{id}/label/reprints`). */
  labelReprint?: { at: string; by: string; count: number; reason: string };
  act: string | null;
  history: OrderHistoryEntry[];
  cancel: { by: string; byRole: string; at: string; reason: string } | null;
  returnRequest: { at: string; by: string; reason: string } | null;
  dispute: { at: string; by: string; reason: string } | null;
  elchiFailed: boolean;
  webhookStale: boolean;
  blacklist: boolean;
  prepaid: boolean;
  rejectedTransition: boolean;
}

/** Sotuvchilar (Jasur — mock foydalanuvchi U-0001; qolganlari `GET /admin/users?role=AFFILIATE` da ham). */
export const MOCK_AFFILIATES = [
  { id: 'U-0001', name: 'Jasur T.', fullName: 'Jasur Toshmatov', streams: ['k7m2qa', 'p3v9tx'] },
  { id: 'U-0101', name: 'Sherzod A.', fullName: 'Sherzod Aliyev', streams: ['d2h6va'] },
  { id: 'U-0102', name: 'Kamola N.', fullName: 'Kamola Nazarova', streams: ['r9c4mn'] },
  { id: 'U-0103', name: 'Davron E.', fullName: 'Davron Ergashev', streams: ['v5d8nq'] },
  { id: 'U-0104', name: 'Firdavs O.', fullName: 'Firdavs Olimov', streams: ['h2q7vz'] },
] as const;

type MockActivity = { kind: 'IN_CALL' | 'RINGING' | 'WRAP_UP' | 'CONNECTING' | 'IDLE'; leadId: string | null; seconds: number };

/**
 * Operatorlar (admin-lidlar «O'tkazish» oynasi namunasi). Dilnoza R. holati — operator ish joyidagi holat
 * (`db.operator.state`); qolganlari doimiy. `activity` va `scheduled` — taklif maydonlari (queue-summary).
 */
export const MOCK_OPERATORS: ReadonlyArray<{ id: string; name: string; state?: 'ONLINE' | 'BREAK' | 'OFFLINE'; bookings: number; scheduled: number; activity: MockActivity | null }> = [
  { id: 'U-0003', name: 'Dilnoza R.', bookings: 0, scheduled: 2, activity: null },
  { id: 'U-0031', name: 'Feruza Y.', state: 'BREAK', bookings: 0, scheduled: 1, activity: null },
  { id: 'U-0032', name: 'Shohruh M.', state: 'ONLINE', bookings: 2, scheduled: 4, activity: { kind: 'IN_CALL', leadId: 'L-1249', seconds: 185 } },
  { id: 'U-0033', name: 'Umida S.', state: 'ONLINE', bookings: 1, scheduled: 1, activity: { kind: 'WRAP_UP', leadId: 'L-1256', seconds: 20 } },
  { id: 'U-0034', name: 'Lola A.', state: 'OFFLINE', bookings: 0, scheduled: 0, activity: null },
  { id: 'U-0035', name: 'Jamshid E.', state: 'BREAK', bookings: 0, scheduled: 0, activity: null },
  { id: 'U-0036', name: 'Sabina X.', state: 'ONLINE', bookings: 1, scheduled: 2, activity: { kind: 'RINGING', leadId: 'L-1254', seconds: 8 } },
  { id: 'U-0037', name: 'Temur K.', state: 'ONLINE', bookings: 1, scheduled: 2, activity: { kind: 'IN_CALL', leadId: 'L-1246', seconds: 132 } },
];

/** O'tkazilgan lidlar operator bronlari va rejalashtirilgan qo'ng'iroqlariga qo'shiladi (mock sessiyasi davomida). */
let operatorLoad = new Map<string, { bookings: number; scheduled: number }>();
export const mockOperatorLoad = (id: string) => operatorLoad.get(id) ?? { bookings: 0, scheduled: 0 };
export function addMockOperatorLoad(id: string, patch: { bookings?: number; scheduled?: number }): void {
  const load = mockOperatorLoad(id);
  operatorLoad.set(id, { bookings: load.bookings + (patch.bookings ?? 0), scheduled: load.scheduled + (patch.scheduled ?? 0) });
}

export const affiliateOfStream = (code: string) => MOCK_AFFILIATES.find((item) => (item.streams as readonly string[]).includes(code)) ?? MOCK_AFFILIATES[0];
const operatorByName = (name: string) => MOCK_OPERATORS.find((item) => item.name === name) ?? MOCK_OPERATORS[0];

export function districtOf(soato: string) {
  for (const region of REGION_TREE) {
    const district = region.districts.find((item) => item.satoCode === soato);
    if (district) return { regionSoato: region.satoCode, regionName: region.name, districtName: district.name };
  }
  return { regionSoato: soato.slice(0, 4), regionName: '—', districtName: '—' };
}

const PRODUCT = { id: '501', name: 'Simsiz quloqchinlar', category: 'Elektronika', wholesalerName: 'Namuna Savdo MChJ', weightGrams: 300 };
const PICKERS = ['Otabek N.', 'Sanjar M.'];

/** Asosiy zanjir bo'yicha holat tarixi (har o'tish: kim, qachon, izoh). */
function pathHistory(order: Pick<MockOrder, 'status' | 'confirmedBy' | 'leadId' | 'picker' | 'act' | 'cancel' | 'returnRequest' | 'rejectedTransition'>, start: number): OrderHistoryEntry[] {
  const step = (minutes: number) => new Date(start + minutes * MINUTE).toISOString();
  const entry = (from: OrderStatus | null, to: OrderStatus, minutes: number, actorName: string, actorType: string, note: string | null, accepted = true, reason: string | null = null): OrderHistoryEntry => ({
    fromStatus: from, toStatus: to, accepted, actorType, actorId: null, actorRole: actorType === 'USER' ? 'OPERATOR_LEAD' : null, reason, createdAt: step(minutes), actorName, note,
  });
  const list: OrderHistoryEntry[] = [entry(null, 'CONFIRMED', 0, order.confirmedBy.name, 'USER', `lid ${order.leadId} tasdiqlandi · 1 dona band, B-02-1`)];
  const target = order.cancel ? 'CANCELLED' : order.status;
  const chain: Array<[OrderStatus, number, string, string, string | null]> = [
    ['PICKING', 39, 'Ombor tizimi', 'SYSTEM', 'to‘lqin'],
    ['PACKED', 50, order.picker ?? 'Otabek N.', 'USER', 'skan 1 / 1 · yorliq chop etildi'],
    ['HANDED_TO_ELCHI', 149, order.picker ?? 'Otabek N.', 'USER', `QR skaner · akt ${order.act ?? 'T-0230'}`],
    ['IN_TRANSIT', 264, 'Elchi webhook', 'WEBHOOK', null],
    ['DELIVERED', 1501, 'Elchi webhook', 'WEBHOOK', 'yig‘ildi 292 000 so‘m'],
    ['REMITTED', 2400, 'Elchi pul o‘tkazmasi', 'SYSTEM', null],
    ['SETTLED', 3300, 'Tizim', 'SYSTEM', 'ulushlar mavjud'],
  ];
  if (target === 'CANCELLED' && order.cancel) {
    list.push({ ...entry('CONFIRMED', 'CANCELLED', 20, order.cancel.by, 'USER', 'band bo‘shadi', true, order.cancel.reason), createdAt: order.cancel.at });
    return list;
  }
  const returnBranch: Partial<Record<OrderStatus, OrderStatus[]>> = {
    RETURN_REQUESTED: ['RETURN_REQUESTED'],
    REFUSED: ['REFUSED'],
    RETURNING: ['REFUSED', 'RETURNING'],
    RETURNED_GRADED: ['REFUSED', 'RETURNING', 'RETURNED_GRADED'],
  };
  const branch = returnBranch[target];
  const last = branch ? (target === 'RETURN_REQUESTED' ? 'DELIVERED' : 'IN_TRANSIT') : target;
  let previous: OrderStatus = 'CONFIRMED';
  for (const [status, minutes, actor, type, note] of chain) {
    if (ORDER_PATH.indexOf(status) > ORDER_PATH.indexOf(last)) break;
    list.push(entry(previous, status, minutes, actor, type, note));
    previous = status;
    if (status === 'DELIVERED' && order.rejectedTransition) {
      list.push(entry('DELIVERED', 'IN_TRANSIT', 1503, 'Elchi webhook', 'WEBHOOK', 'ruxsat etilmagan o‘tish, jurnalga yozildi', false));
    }
  }
  if (branch) {
    branch.forEach((status, index) => {
      const note = status === 'RETURN_REQUESTED' ? order.returnRequest?.reason ?? null : status === 'REFUSED' ? 'mijoz olmadi' : status === 'RETURNED_GRADED' ? 'sotuvga yaroqli — qoldiqqa qaytdi' : null;
      list.push(entry(previous, status, 1600 + index * 600, status === 'RETURN_REQUESTED' ? order.returnRequest?.by ?? 'Nodira K.' : 'Elchi webhook', status === 'RETURN_REQUESTED' ? 'USER' : 'WEBHOOK', note));
      previous = status;
    });
  }
  return list;
}

interface Seed {
  lead: string; name: string; district: string; street: string; stream: string; status: OrderStatus; minutesAgo: number;
  statusMinutesAgo: number; detail: string | null; confirmedBy?: string; where?: WhereDeliver; total?: number;
  original?: { district: string; street: string }; picker?: string; act?: string; extra?: Partial<MockOrder>;
}

function build(seed: Seed): MockOrder {
  const place = districtOf(seed.district);
  const where = seed.where ?? 'CENTER';
  const fee = where === 'ADDRESS' ? 50_000 : 30_000;
  const unitPrice = (seed.total ?? 262_000 + fee) - fee;
  const confirmedAt = ago(seed.minutesAgo);
  const confirmer = operatorByName(seed.confirmedBy ?? 'Dilnoza R.');
  const affiliate = affiliateOfStream(seed.stream);
  const original = seed.original ? { regionSoato: districtOf(seed.original.district).regionSoato, districtSoato: seed.original.district, addressLine: seed.original.street, whereDeliver: where } : null;
  const order: MockOrder = {
    id: `O-${seed.lead.slice(2)}`,
    leadId: seed.lead,
    status: seed.status,
    createdAt: confirmedAt,
    statusAt: ago(seed.statusMinutesAgo),
    statusDetail: seed.detail,
    name: seed.name,
    phone: `+998 9${seed.lead.charCodeAt(3) % 10} ${seed.lead.slice(3, 6)} ${seed.lead.slice(-2)} ${String(seed.name.length * 7).padStart(2, '0').slice(-2)}`,
    regionSoato: place.regionSoato,
    districtSoato: seed.district,
    addressLine: seed.street,
    whereDeliver: where,
    original,
    editedBy: original ? { name: confirmer.name, at: confirmedAt } : null,
    product: PRODUCT,
    quantity: 1,
    unitPrice,
    deliveryFee: fee,
    deliveryMode: 'PARTIAL',
    stream: { code: seed.stream, affiliateName: affiliate.name, affiliateId: affiliate.id, sub1: 'fb-reels-1' },
    confirmedBy: { id: confirmer.id, name: confirmer.name, at: confirmedAt },
    leadCreatedAt: ago(seed.minutesAgo + 16),
    track: null,
    picker: seed.picker ?? (ORDER_PATH.indexOf(seed.status) >= 1 || AT_ELCHI.includes(seed.status) ? PICKERS[seed.lead.charCodeAt(4) % 2] : null),
    act: seed.act ?? (AT_ELCHI.includes(seed.status) ? 'T-0230' : null),
    history: [],
    cancel: null,
    returnRequest: null,
    dispute: null,
    elchiFailed: false,
    webhookStale: false,
    blacklist: false,
    prepaid: true,
    rejectedTransition: false,
    ...seed.extra,
  };
  if (AT_ELCHI.includes(order.status) && !order.elchiFailed) order.track = `EL${seed.lead.slice(2)}${seed.lead.slice(-2)}UZ`;
  order.history = pathHistory(order, Date.parse(confirmedAt));
  return order;
}

const SEEDS: Seed[] = [
  { lead: 'L-1276', name: 'Rustam', district: '1706401', street: 'Mustaqillik ko‘chasi, 4-uy', stream: 'r9c4mn', status: 'PICKING', minutesAgo: 41, statusMinutesAgo: 1, detail: 'Otabek N.', confirmedBy: 'Shohruh M.', picker: 'Otabek N.' },
  { lead: 'L-1235', name: 'Zarina', district: '1718233', street: 'Ipak yo‘li ko‘chasi, 18-uy', stream: 'd2h6va', status: 'PACKED', minutesAgo: 252, statusMinutesAgo: 3, detail: 'yorliq chop etildi' },
  { lead: 'L-1266', name: 'Murod', district: '1722401', street: 'Alpomish ko‘chasi, 9-uy', stream: 'd2h6va', status: 'CONFIRMED', minutesAgo: 12, statusMinutesAgo: 12, detail: 'ertangi to‘lqin' },
  { lead: 'L-1222', name: 'Madina', district: '1730413', street: 'Navoiy ko‘chasi, 3-uy', stream: 'r9c4mn', status: 'PACKED', minutesAgo: 290, statusMinutesAgo: 21, detail: 'T-0231 aktida', act: 'T-0231' },
  { lead: 'L-1209', name: 'Oybek', district: '1703202', street: 'Bog‘bon ko‘chasi, 21-uy', stream: 'k7m2qa', status: 'PACKED', minutesAgo: 1196, statusMinutesAgo: 30, detail: 'T-0231 aktida', act: 'T-0231' },
  { lead: 'L-1245', name: 'Lola', district: '1726266', street: '19-mavze, 4-uy, 27-xonadon', stream: 'r9c4mn', status: 'CONFIRMED', minutesAgo: 35, statusMinutesAgo: 35, detail: 'ertangi to‘lqin', where: 'ADDRESS', total: 312_000 },
  {
    lead: 'L-1183', name: 'Mohira', district: '1714204', street: 'Bobur ko‘chasi, 11-uy', stream: 'k7m2qa', status: 'DELIVERED', minutesAgo: 1556, statusMinutesAgo: 55, detail: 'pul kutilmoqda',
    original: { district: '1714212', street: 'Bobur ko‘chasi, 11-uy' }, extra: { rejectedTransition: true },
  },
  { lead: 'L-1157', name: 'Sarvinoz', district: '1710413', street: 'Kitob ko‘chasi, 6-uy', stream: 'p3v9tx', status: 'DELIVERED', minutesAgo: 1715, statusMinutesAgo: 92, detail: 'pul kutilmoqda', total: 317_000 },
  {
    lead: 'L-1258', name: 'Ozoda', district: '1708401', street: 'Sharof Rashidov ko‘chasi, 2-uy', stream: 'd2h6va', status: 'CANCELLED', minutesAgo: 193, statusMinutesAgo: 167, detail: 'Dilnoza R.',
    extra: { cancel: { by: 'Dilnoza R.', byRole: 'OPERATOR_LEAD', at: ago(167), reason: 'Mijoz qayta qo‘ng‘iroqda bekor qildi — boshqa joydan olgan' } },
  },
  {
    lead: 'L-0912', name: 'Ulug‘bek', district: '1727407', street: 'Amir Temur ko‘chasi, 14-uy', stream: 'v5d8nq', status: 'RETURN_REQUESTED', minutesAgo: 7400, statusMinutesAgo: 175, detail: 'teskari yozildi',
    extra: { returnRequest: { at: ago(175), by: 'Nodira K.', reason: 'Tovar ishlamaydi — mijoz 2 kundan keyin qo‘ng‘iroq qildi' } },
  },
  { lead: 'L-0964', name: 'Bahrom', district: '1718401', street: 'Registon ko‘chasi, 30-uy', stream: 'k7m2qa', status: 'IN_TRANSIT', minutesAgo: 5000, statusMinutesAgo: 4300, detail: 'Elchi’dan xabar yo‘q', extra: { webhookStale: true } },
  { lead: 'L-1176', name: 'Kamol', district: '1712401', street: 'Galaba ko‘chasi, 7-uy', stream: 'r9c4mn', status: 'HANDED_TO_ELCHI', minutesAgo: 1400, statusMinutesAgo: 1290, detail: 'posilka yaratilmadi', extra: { elchiFailed: true } },
  {
    lead: 'L-1093', name: 'Sevara', district: '1726294', street: 'Bunyodkor ko‘chasi, 5-uy', stream: 'p3v9tx', status: 'RETURN_REQUESTED', minutesAgo: 8000, statusMinutesAgo: 600, detail: 'nizoli',
    extra: { returnRequest: { at: ago(600), by: 'Nodira K.', reason: 'Mijoz qutini ochmay qaytarmoqchi' }, dispute: { at: ago(560), by: 'Nodira K.', reason: 'Elchi «yetkazildi» dedi, mijoz «olmadim» demoqda' } },
  },
  { lead: 'L-1071', name: 'Nargiz', district: '1703401', street: 'Bobur shoh ko‘chasi, 44-uy', stream: 'k7m2qa', status: 'SETTLED', minutesAgo: 6500, statusMinutesAgo: 1300, detail: 'ulushlar mavjud' },
  { lead: 'L-1140', name: 'Shoxista', district: '1730401', street: 'Al-Farg‘oniy ko‘chasi, 8-uy', stream: 'r9c4mn', status: 'REMITTED', minutesAgo: 4200, statusMinutesAgo: 240, detail: 'Elchi o‘tkazdi' },
  { lead: 'L-1190', name: 'Javohir', district: '1722401', street: 'At-Termiziy ko‘chasi, 12-uy', stream: 'd2h6va', status: 'IN_TRANSIT', minutesAgo: 1300, statusMinutesAgo: 1100, detail: 'Elchi yetkazmoqda' },
  { lead: 'L-1101', name: 'Feruza', district: '1724401', street: 'Mustaqillik ko‘chasi, 8-uy', stream: 'v5d8nq', status: 'REFUSED', minutesAgo: 6000, statusMinutesAgo: 900, detail: 'mijoz olmadi — 2-marta', extra: { blacklist: true } },
  { lead: 'L-1120', name: 'Abror', district: '1706401', street: 'Navoiy ko‘chasi, 21-uy', stream: 'k7m2qa', status: 'RETURNING', minutesAgo: 5800, statusMinutesAgo: 700, detail: 'omborga qaytmoqda' },
  { lead: 'L-1088', name: 'Gavhar', district: '1703401', street: 'Yangi bozor ko‘chasi, 2-uy', stream: 'r9c4mn', status: 'RETURNED_GRADED', minutesAgo: 8600, statusMinutesAgo: 2000, detail: 'sotuvga yaroqli' },
  { lead: 'L-1250', name: 'Nodir', district: '1712401', street: 'Navoiy ko‘chasi, 15-uy', stream: 'p3v9tx', status: 'CONFIRMED', minutesAgo: 60, statusMinutesAgo: 60, detail: 'bugungi to‘lqin', confirmedBy: 'Jamshid E.' },
  { lead: 'L-1240', name: 'Dilfuza', district: '1733401', street: 'Al-Xorazmiy ko‘chasi, 4-uy', stream: 'k7m2qa', status: 'CONFIRMED', minutesAgo: 80, statusMinutesAgo: 80, detail: 'bugungi to‘lqin', total: 317_000 },
  { lead: 'L-1210', name: 'Sabina', district: '1718401', street: 'Registon ko‘chasi, 2-uy', stream: 'k7m2qa', status: 'CONFIRMED', minutesAgo: 95, statusMinutesAgo: 95, detail: 'oldindan to‘lov kutilmoqda', extra: { blacklist: true, prepaid: false } },
];

interface OrderStoreState {
  orders: Map<string, MockOrder>;
  requests: Array<CustomerRequest & { orderId: string }>;
}

let state: OrderStoreState | null = null;

function createState(): OrderStoreState {
  const orders = new Map(SEEDS.map((seed) => {
    const order = build(seed);
    return [order.id, order] as const;
  }));
  const request = (id: string, orderId: string, kind: CustomerRequest['kind'], minutesAgo: number, comment: string | null, extra: Partial<CustomerRequest> = {}): CustomerRequest & { orderId: string } => ({
    id, orderId, kind, createdAt: ago(minutesAgo), comment, state: 'OPEN', ...extra,
  });
  const xonqa = districtOf('1733230');
  return {
    orders,
    requests: [
      request('R-31', 'O-1250', 'CANCEL', 25, 'Boshqa joydan oldim'),
      request('R-32', 'O-1240', 'CHANGE_ADDRESS', 17, null, { regionSoato: xonqa.regionSoato, regionName: xonqa.regionName, districtSoato: '1733230', districtName: xonqa.districtName, whereDeliver: 'CENTER', addressLine: 'Al-Xorazmiy ko‘chasi, 4-uy' }),
      request('R-29', 'O-1176', 'CANCEL', 10, 'Kerak emas bo‘lib qoldi'),
    ],
  };
}

export const orderStore = () => (state ??= createState());

const resetters: Array<() => void> = [];
/** Boshqa mock modullari o'z holatini shu yerda tozalaydi (`resetMockDb` → har e2e test boshida). */
export function onMockOrdersReset(reset: () => void): void {
  resetters.push(reset);
}

export function resetMockOrders(): void {
  state = null;
  operatorLoad = new Map();
  resetters.forEach((reset) => reset());
}

/** Operator «Buyurtma tasdiqlandi» (operator handler chaqiradi): lid ma'lumotlari bilan yangi buyurtma. */
export function createOrderFromLead(input: {
  leadId: string; name: string; phone: string; regionSoato: string; districtSoato: string; addressLine: string; whereDeliver: WhereDeliver;
  original: MockOrder['original']; operatorName: string; product: { id: string; name: string; weightGrams: number | null }; quantity: number;
  unitPrice: number; deliveryFee: number; deliveryMode: MockOrder['deliveryMode']; streamCode: string; leadCreatedAt: string; blacklist: boolean;
}): MockOrder {
  const now = new Date().toISOString();
  const operator = operatorByName(input.operatorName);
  const affiliate = affiliateOfStream(input.streamCode);
  const changed = input.original && (input.original.districtSoato !== input.districtSoato || input.original.addressLine !== input.addressLine || input.original.whereDeliver !== input.whereDeliver);
  const order: MockOrder = {
    id: `O-${input.leadId.replace(/^L-/, '')}`,
    leadId: input.leadId,
    status: 'CONFIRMED',
    createdAt: now,
    statusAt: now,
    statusDetail: 'ertangi to‘lqin',
    name: input.name,
    phone: input.phone,
    regionSoato: input.regionSoato,
    districtSoato: input.districtSoato,
    addressLine: input.addressLine,
    whereDeliver: input.whereDeliver,
    original: changed ? input.original : null,
    editedBy: changed ? { name: operator.name, at: now } : null,
    product: { ...PRODUCT, id: input.product.id, name: input.product.name, weightGrams: input.product.weightGrams ?? 0 },
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    deliveryFee: input.deliveryFee,
    deliveryMode: input.deliveryMode,
    stream: { code: input.streamCode, affiliateName: affiliate.name, affiliateId: affiliate.id, sub1: 'fb-reels-1' },
    confirmedBy: { id: operator.id, name: operator.name, at: now },
    leadCreatedAt: input.leadCreatedAt,
    track: null,
    picker: null,
    act: null,
    history: [],
    cancel: null,
    returnRequest: null,
    dispute: null,
    elchiFailed: false,
    webhookStale: false,
    blacklist: input.blacklist,
    prepaid: !input.blacklist,
    rejectedTransition: false,
  };
  order.history = pathHistory(order, Date.parse(now));
  orderStore().orders.set(order.id, order);
  return order;
}

const total = (order: MockOrder) => order.unitPrice * order.quantity + order.deliveryFee;
/** «292 000» — bo'shliq bilan (mock matnlari). */
const money = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const masked = (phone: string) => `+998 ${phone.slice(5, 7)} *** ** ${phone.slice(-2)}`;

export function listItem(order: MockOrder): OrderListItem {
  const place = districtOf(order.districtSoato);
  const request = orderStore().requests.find((item) => item.orderId === order.id && item.state === 'OPEN');
  return {
    id: order.id,
    leadId: order.leadId,
    status: order.status,
    createdAt: order.createdAt,
    buyerName: order.name,
    phoneMasked: masked(order.phone),
    totalAmount: total(order),
    deliveryFee: order.deliveryFee,
    source: 'LANDING',
    affiliateId: order.stream.affiliateId,
    regionName: place.regionName,
    districtName: place.districtName,
    whereDeliver: order.whereDeliver,
    productId: order.product.id,
    productName: order.product.name,
    quantity: order.quantity,
    streamCode: order.stream.code,
    affiliateName: order.stream.affiliateName,
    statusAt: order.statusAt,
    statusDetail: order.statusDetail,
    trackNumber: order.track,
    confirmedBy: { name: order.confirmedBy.name, at: order.confirmedBy.at },
    requestKind: request?.kind ?? null,
    stockCell: ['CONFIRMED', 'PICKING', 'PACKED'].includes(order.status) ? 'B-02-1' : null,
  };
}

const journal = (at: string | null, title: string, detail: string | null, state: JournalState) => ({ at, title, detail, state });

/** Karta: backend maydonlari + taklif bloklari. `phone` — faqat admin (25-qaror). */
export function orderDetail(order: MockOrder, role: string): OrderDetail {
  const place = districtOf(order.districtSoato);
  // Pul yozuvlari yetkazilganda yoziladi: ushlab turilgan → mavjud (yopildi); qaytarish so'ralsa — teskari.
  const moneyState: MoneyState | null = order.status === 'SETTLED' ? 'AVAILABLE'
    : order.status === 'RETURN_REQUESTED' ? 'REVERSED'
      : order.status === 'DELIVERED' || order.status === 'REMITTED' ? 'HELD' : null;
  const deliveredAt = order.history.find((entry) => entry.toStatus === 'DELIVERED')?.createdAt ?? null;
  const pastPicking = ORDER_PATH.indexOf(order.status) >= ORDER_PATH.indexOf('PACKED') || AT_ELCHI.includes(order.status);
  const packedAt = order.history.find((entry) => entry.toStatus === 'PACKED')?.createdAt ?? null;
  const handedAt = order.history.find((entry) => entry.toStatus === 'HANDED_TO_ELCHI')?.createdAt ?? null;
  const transitAt = order.history.find((entry) => entry.toStatus === 'IN_TRANSIT')?.createdAt ?? null;
  const split = { wholesaler: 140_000, affiliate: 65_000, callCenter: 12_000, platformService: 34_000 };
  const entries = moneyState ? [
    { account: 'Optovik', label: order.product.wholesalerName, note: null, amount: split.wholesaler, state: moneyState, at: deliveredAt ?? order.statusAt },
    { account: 'Sotuvchi', label: `${order.stream.affiliateName} · haq`, note: null, amount: split.affiliate, state: moneyState, at: deliveredAt ?? order.statusAt },
    { account: 'Qo‘ng‘iroq markazi', label: 'har buyurtmaga', note: null, amount: split.callCenter, state: moneyState, at: deliveredAt ?? order.statusAt },
    { account: 'Elchi', label: 'yashirilgan yetkazish', note: null, amount: 10_000, state: moneyState, at: deliveredAt ?? order.statusAt },
    { account: 'Platforma xizmati', label: 'qisman rejim ulushi', note: null, amount: null, state: moneyState, at: deliveredAt ?? order.statusAt },
  ] : [];
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.statusAt,
    buyerName: order.name,
    statusAt: order.statusAt,
    statusDetail: order.statusDetail,
    shipDate: order.status === 'CONFIRMED' ? tashkentDate(Date.now() + (order.statusDetail?.includes('ertangi') ? 24 * 60 * MINUTE : 0)) : null,
    paymentMethod: 'COD',
    totalAmount: total(order),
    deliveryFee: order.deliveryFee,
    deliveryAddress: `${place.districtName}, ${order.addressLine}`,
    sellerOrders: [{
      id: `S-${order.id}`,
      subtotal: order.unitPrice * order.quantity,
      deliveryFee: order.deliveryFee,
      codAmount: total(order),
      elchiShipmentId: order.track ? order.track.slice(2, 8) : null,
      trackingUrl: order.track ? `https://elchi.uz/track/${order.track}` : null,
      items: [{ productId: order.product.id, productName: order.product.name, quantity: order.quantity, unitPrice: order.unitPrice, lineTotal: order.unitPrice * order.quantity, priceSnapshot: { weightGrams: order.product.weightGrams, basePrice: 140_000, recommendedPrice: 251_000, approvedPrice: 262_000, markup: 0, affiliateFee: 65_000, callCenterFee: 12_000, hiddenDelivery: 10_000, platformService: 34_000 } }],
    }],
    lead: {
      source: 'LANDING',
      leadId: order.leadId,
      streamId: '301',
      affiliateId: order.stream.affiliateId,
      wholesalerId: '12',
      customerPhone: role === 'ADMIN' || role === 'SUPERADMIN' ? order.phone : null,
      regionSoato: order.regionSoato,
      districtSoato: order.districtSoato,
      whereDeliver: order.whereDeliver,
      deliveryMode: order.deliveryMode,
      deliveryShown: order.deliveryFee,
      deliveryCost: order.whereDeliver === 'ADDRESS' ? 60_000 : 40_000,
      deliveryEmbedded: 10_000,
      weightGrams: order.product.weightGrams * order.quantity,
      codAmount: total(order),
      confirmedBy: order.confirmedBy.id,
      addressConfirmedBy: order.confirmedBy.id,
      statusHistory: order.history,
    },
    phoneMasked: masked(order.phone),
    customer: {
      regionName: place.regionName,
      districtName: place.districtName,
      addressLine: order.addressLine,
      original: order.original ? { regionName: districtOf(order.original.districtSoato).regionName, districtName: districtOf(order.original.districtSoato).districtName, addressLine: order.original.addressLine, whereDeliver: order.original.whereDeliver } : null,
      addressEditedBy: order.editedBy,
      addressConfirmedBy: { name: order.confirmedBy.name, at: order.confirmedBy.at },
      consentAt: order.leadCreatedAt,
    },
    product: { id: order.product.id, name: order.product.name, category: order.product.category, wholesalerName: order.product.wholesalerName, weightGrams: order.product.weightGrams },
    stream: { code: order.stream.code, affiliateName: order.stream.affiliateName, affiliateId: order.stream.affiliateId, sub1: order.stream.sub1, leadCreatedAt: order.leadCreatedAt },
    confirmedByActor: { name: order.confirmedBy.name, at: order.confirmedBy.at },
    pricing: {
      salePrice: order.unitPrice,
      recommendedPrice: 251_000,
      approvedAt: ago(10_000),
      deliveryMode: order.deliveryMode,
      hiddenDelivery: 10_000,
      priceAdd: 11_000,
      visibleCenter: 30_000,
      visibleAddress: 50_000,
      elchiTariff: order.whereDeliver === 'ADDRESS' ? 60_000 : 40_000,
      split,
    },
    money: { state: moneyState, elchiRemits: total(order) - 40_000, elchiFee: 40_000, entries, returnUntil: null },
    parcel: {
      track: order.track,
      createdAt: order.track ? handedAt : null,
      act: order.act && AT_ELCHI.includes(order.status) ? { code: order.act, at: handedAt ?? order.statusAt, count: 12 } : order.act ? { code: order.act, at: order.statusAt, count: 9 } : null,
      label: order.labelReprint ? { printedAt: order.labelReprint.at, by: order.labelReprint.by, count: order.labelReprint.count }
        : pastPicking ? { printedAt: packedAt ?? order.statusAt, by: order.picker ?? 'Otabek N.', count: 1 } : null,
      lastWebhookAt: transitAt,
      attempts: order.elchiFailed ? [{ at: handedAt, state: 'FAILED' }, { at: handedAt ? new Date(Date.parse(handedAt) + 2 * MINUTE).toISOString() : null, state: 'FAILED' }, { at: null, state: 'QUEUED' }] : null,
    },
    elchiEvents: AT_ELCHI.includes(order.status) ? [
      journal(handedAt, 'Posilka so‘rovi navbatga qo‘yildi', `akt ${order.act ?? 'T-0230'} yakunlandi`, 'SENT'),
      order.elchiFailed ? journal(handedAt, 'Posilka yaratilmadi', 'Elchi API javob bermadi · 3 urinish', 'FAILED') : journal(handedAt, 'Posilka yaratildi', `javob 201 · trek ${order.track ?? ''}`, 'ACCEPTED'),
      ...(transitAt ? [journal(transitAt, 'Holat: Yo‘lda', 'IN_TRANSIT', 'ACCEPTED')] : []),
      ...(deliveredAt ? [journal(deliveredAt, 'Holat: Yetkazildi', `DELIVERED · yig‘ildi ${money(total(order))}`, 'ACCEPTED')] : []),
      ...(order.rejectedTransition ? [journal(deliveredAt, 'Holat: Yo‘lda', 'holat orqaga qaytmaydi', 'REJECTED')] : []),
      ...(order.status === 'DELIVERED' ? [journal(null, 'Pul o‘tkazmasi', 'bugungi o‘tkazma kelmagan', 'PENDING')] : []),
    ] : [],
    sms: [
      journal(order.createdAt, 'Buyurtma tasdiqlandi', `jami ${money(total(order))} · ${place.districtName} ${order.whereDeliver === 'ADDRESS' ? 'eshikkacha' : 'markazigacha'}`, 'SENT'),
      ...(transitAt ? [journal(transitAt, 'Posilka yo‘lga chiqdi', `trek ${order.track ?? ''}`, 'SENT')] : []),
      ...(order.status === 'CANCELLED' ? [journal(order.cancel?.at ?? null, 'Buyurtma bekor qilindi', null, 'SENT')] : []),
    ],
    picking: ORDER_PATH.indexOf(order.status) >= 1 || AT_ELCHI.includes(order.status) ? {
      by: order.picker, wave: 'to‘lqin', from: order.history[1]?.createdAt ?? null, to: packedAt, scanned: pastPicking ? 1 : 0, total: order.quantity,
      barcode: '4780012345677', cell: 'B-02-1', reservedAt: order.createdAt, releasedAt: handedAt,
    } : order.status === 'CONFIRMED' ? { by: null, wave: null, from: null, to: null, scanned: 0, total: order.quantity, barcode: null, cell: 'B-02-1', reservedAt: order.createdAt, releasedAt: null } : null,
    postbacks: [
      { at: order.leadCreatedAt, event: 'Lid keldi', attempt: 1, code: 200, state: 'SENT' },
      { at: order.createdAt, event: 'Tasdiqlandi', attempt: 1, code: 200, state: 'SENT' },
      ...(deliveredAt ? [{ at: deliveredAt, event: 'Yetkazildi', attempt: 1, code: 200, state: 'SENT' as const }] : []),
    ],
    cancel: order.cancel ? { by: order.cancel.by, at: order.cancel.at, reason: order.cancel.reason, byRole: order.cancel.byRole } : null,
    returnRequest: order.returnRequest,
    dispute: order.dispute ? { ...order.dispute, keepUntil: new Date(Date.parse(order.dispute.at) + 365 * 24 * 60 * MINUTE).toISOString() } : null,
    prepayment: order.blacklist ? { amount: order.deliveryFee, paid: order.prepaid } : null,
    requests: orderStore().requests.filter((item) => item.orderId === order.id),
  };
}
