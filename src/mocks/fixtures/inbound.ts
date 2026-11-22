import type { InboundProductOption, InboundShipment, InboundSku, ShipmentActor, ShipmentScan } from '../../features/inbound/model/inboundTypes';
import { addDays, tashkentDate } from '../utils';

/**
 * Ombor: postavka va qabul (FE-16) — dizayndagi namuna (ombor-qabul, admin-postavka, ombor-qoldiq):
 * Namuna Savdo MChJ ning 4 ta SKU si (206 dona omborda, 3 postavka · 210 dona kutilmoqda), P-0112 qabulda
 * (98 qabul, 2 brak). Muddatli tovar — Namuna Farm MChJ «Vitamin kompleksi» (BAD); shartnomasiz — Barakat.
 */
export interface MockInboundWholesaler {
  id: string;
  name: string;
  tin: string;
  status: 'ACTIVE' | 'SUSPENDED';
  contractSigned: boolean;
  contractNumber: string | null;
  contractDate: string | null;
  /** Optovik kabineti (FE-23): oxirgi kirish, minutlarda oldin; `null` — kabinet yo'q. */
  cabinetSeenMinutesAgo: number | null;
}

export interface MockSku extends InboundSku {
  wholesalerId: string;
  status: InboundProductOption['status'];
  reviewSince: string | null;
  onHand: number;
  reserved: number;
  /** Brak — qoldiqqa kirmaydi, optovikka qaytariladi. */
  defect: number;
  /** Omborda, lekin sotuvdan chiqarilgan (muddatiga 60 kundan kam) — «mavjud»ga qo'shilmaydi. */
  blocked: number;
  /** Banddan ertangi to'lqinga tegishlisi (qolgani — bugungi). */
  reservedTomorrow: number;
}

export interface MockInbound {
  wholesalers: MockInboundWholesaler[];
  skus: MockSku[];
  shipments: InboundShipment[];
  /** Postavka → skanlar (eskisi birinchi). */
  scans: Record<string, ShipmentScan[]>;
  /** idempotencyKey → javob (takror yuborilgan e'lon va skan). */
  replies: Map<string, unknown>;
  /** Partiya amallari: hisobdan chiqarilgan yoki optovikka qaytarilmoqda (ombor-muddat oynalari). */
  lotActions: Record<string, { state: 'RETURNING' | 'WRITTEN_OFF'; quantity: number }>;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const STAFF_ADMIN: ShipmentActor = { name: 'Nodira Karimova', role: 'ADMIN' };
const STAFF_WAREHOUSE: ShipmentActor = { name: 'Otabek Nurmatov', role: 'WAREHOUSE' };
const CABINET: ShipmentActor = { name: 'Namuna Savdo MChJ', role: 'WHOLESALER' };

function wholesalers(): MockInboundWholesaler[] {
  const today = tashkentDate();
  return [
    { id: '7', name: 'Namuna Savdo MChJ', tin: '307418562', status: 'ACTIVE', contractSigned: true, contractNumber: 'K-2027/014', contractDate: addDays(today, -24), cabinetSeenMinutesAgo: 2 },
    { id: '8', name: 'Namuna Farm MChJ', tin: '307418570', status: 'ACTIVE', contractSigned: true, contractNumber: 'K-2027/021', contractDate: addDays(today, -20), cabinetSeenMinutesAgo: null },
    { id: '9', name: 'Barakat Uy Jihozlari MChJ', tin: '305112847', status: 'ACTIVE', contractSigned: false, contractNumber: null, contractDate: null, cabinetSeenMinutesAgo: null },
  ];
}

function sku(variantId: string, productId: string, name: string, barcode: string, cell: string | null, categoryName: string, extra: Partial<MockSku> = {}): MockSku {
  return {
    productId, variantId, name, barcode, cell, categoryName, expiryTracked: false,
    wholesalerId: '7', status: 'ACTIVE', reviewSince: null, onHand: 0, reserved: 0, defect: 0, blocked: 0, reservedTomorrow: 0, ...extra,
  };
}

function skus(today: string): MockSku[] {
  return [
    sku('50101', '501', 'Simsiz quloqchinlar', '4780012345677', 'B-02-1', 'elektronika', { onHand: 128, reserved: 8, reservedTomorrow: 2 }),
    sku('50201', '502', 'Oshxona tarozisi', '4780012345684', 'A-01-3', 'uy-ro‘zg‘or', { onHand: 49, reserved: 4, defect: 1 }),
    sku('50301', '503', 'Elektr choynak', '4780012345691', 'B-02-2', 'uy-ro‘zg‘or', { onHand: 28, reserved: 2, defect: 1 }),
    sku('50401', '504', 'Bolalar termos shishasi', '4780012345707', 'C-03-1', 'bolalar uchun', { onHand: 1, reserved: 1, defect: 2, reservedTomorrow: 1 }),
    sku('50601', '506', 'Bug‘li dazmol', '4780012345721', null, 'uy-ro‘zg‘or', { status: 'PENDING_REVIEW', reviewSince: addDays(today, -1) }),
    sku('51101', '511', 'Vitamin kompleksi', '4780012345714', 'C-03-2', 'BAD', { wholesalerId: '8', expiryTracked: true }),
  ];
}

const party = (id: string) => {
  const found = wholesalers().find((item) => item.id === id) ?? wholesalers()[0];
  return { id: found.id, name: found.name, tin: found.tin };
};

const skuOf = (all: MockSku[], variantId: string): InboundSku => {
  const { productId, name, barcode, expiryTracked, categoryName, cell } = all.find((item) => item.variantId === variantId) ?? all[0];
  return { productId, variantId, name, barcode, expiryTracked, categoryName, cell };
};

interface Seed {
  number: number;
  variantId: string;
  declared: number;
  accepted?: number;
  defect?: number;
  status: InboundShipment['status'];
  expectedAt: string;
  createdBy: ShipmentActor;
  createdMinutesAgo: number;
  completedMinutesAgo?: number;
  receivingMinutesAgo?: number;
  inTransitMinutesAgo?: number;
  actNote?: string;
}

function shipment(all: MockSku[], seed: Seed): InboundShipment {
  const accepted = seed.accepted ?? 0;
  const number = `P-${String(seed.number).padStart(4, '0')}`;
  const completed = seed.completedMinutesAgo !== undefined;
  return {
    id: String(seed.number),
    number,
    status: seed.status,
    wholesaler: party(all.find((item) => item.variantId === seed.variantId)?.wholesalerId ?? '7'),
    sku: skuOf(all, seed.variantId),
    declared: seed.declared,
    accepted,
    defect: seed.defect ?? 0,
    expectedAt: seed.expectedAt,
    note: null,
    waybillNumber: null,
    createdAt: minutesAgo(seed.createdMinutesAgo),
    createdBy: seed.createdBy,
    inTransitAt: seed.inTransitMinutesAgo === undefined ? null : minutesAgo(seed.inTransitMinutesAgo),
    receivingStartedAt: seed.receivingMinutesAgo === undefined ? null : minutesAgo(seed.receivingMinutesAgo),
    completedAt: completed ? minutesAgo(seed.completedMinutesAgo ?? 0) : null,
    completedBy: completed ? STAFF_WAREHOUSE : null,
    actNote: seed.actNote ?? null,
    cancelledAt: null,
    cancelReason: null,
    lots: accepted || seed.receivingMinutesAgo !== undefined ? [{ id: `L-${seed.number}`, number, expiresAt: null, quantity: accepted, sellable: true }] : [],
  };
}

const DAY = 24 * 60;

function shipments(all: MockSku[], today: string): InboundShipment[] {
  return [
    { number: 113, variantId: '50401', declared: 60, status: 'IN_TRANSIT', expectedAt: today, createdBy: CABINET, createdMinutesAgo: 2 * DAY, inTransitMinutesAgo: 6 * 60 },
    { number: 112, variantId: '50101', declared: 100, accepted: 98, defect: 2, status: 'DECLARED', expectedAt: today, createdBy: CABINET, createdMinutesAgo: 2 * DAY + 30, receivingMinutesAgo: 45 },
    { number: 111, variantId: '50201', declared: 50, status: 'DECLARED', expectedAt: addDays(today, 1), createdBy: CABINET, createdMinutesAgo: 2 * DAY + 60 },
    { number: 110, variantId: '50301', declared: 20, accepted: 20, status: 'RECEIVED', expectedAt: today, createdBy: CABINET, createdMinutesAgo: 4 * DAY, receivingMinutesAgo: 5 * 60 + 20, completedMinutesAgo: 5 * 60 },
    { number: 104, variantId: '50201', declared: 50, accepted: 50, status: 'RECEIVED', expectedAt: addDays(today, -7), createdBy: STAFF_ADMIN, createdMinutesAgo: 9 * DAY, receivingMinutesAgo: 7 * DAY + 60, completedMinutesAgo: 7 * DAY },
    {
      number: 98, variantId: '50401', declared: 63, accepted: 61, defect: 2, status: 'DISCREPANCY', expectedAt: addDays(today, -16), createdBy: STAFF_ADMIN,
      createdMinutesAgo: 17 * DAY, inTransitMinutesAgo: 16 * DAY + 7 * 60, receivingMinutesAgo: 16 * DAY + 60, completedMinutesAgo: 16 * DAY, actNote: '2 ta shishaning qopqog‘i singan',
    },
    { number: 97, variantId: '50101', declared: 200, accepted: 200, status: 'RECEIVED', expectedAt: addDays(today, -8), createdBy: STAFF_ADMIN, createdMinutesAgo: 18 * DAY, receivingMinutesAgo: 8 * DAY + 90, completedMinutesAgo: 8 * DAY },
    { number: 89, variantId: '50301', declared: 13, accepted: 13, status: 'RECEIVED', expectedAt: addDays(today, -16), createdBy: STAFF_ADMIN, createdMinutesAgo: 18 * DAY + 60, receivingMinutesAgo: 16 * DAY + 30, completedMinutesAgo: 16 * DAY },
    { number: 88, variantId: '50101', declared: 84, accepted: 84, status: 'RECEIVED', expectedAt: addDays(today, -16), createdBy: STAFF_ADMIN, createdMinutesAgo: 18 * DAY + 120, receivingMinutesAgo: 16 * DAY + 40, completedMinutesAgo: 16 * DAY + 5 },
  ].map((seed) => shipment(all, seed as Seed));
}

/** P-0112 jurnali (ombor-qabul): 96 qabul va 1 brak avval; keyin Brak 2, Qabul 97, noma'lum kod, Qabul 98. */
function scans112(): ShipmentScan[] {
  const list: ShipmentScan[] = [];
  let accepted = 0;
  let defect = 0;
  const push = (minutes: number, mode: 'ACCEPT' | 'DEFECT', barcode = '4780012345677') => {
    if (barcode !== '4780012345677') {
      list.push({ id: `S-112-${list.length + 1}`, at: minutesAgo(minutes), barcode, mode, result: 'UNKNOWN', total: null, productName: null, lotNumber: null });
      return;
    }
    const total = mode === 'ACCEPT' ? (accepted += 1) : (defect += 1);
    list.push({ id: `S-112-${list.length + 1}`, at: minutesAgo(minutes), barcode, mode, result: mode === 'ACCEPT' ? 'ACCEPTED' : 'DEFECT', total, productName: null, lotNumber: 'P-0112' });
  };
  for (let index = 0; index < 96; index += 1) {
    push(44 - index * 0.4, 'ACCEPT');
    if (index === 30) push(32, 'DEFECT');
  }
  push(3, 'DEFECT');
  push(1.5, 'ACCEPT');
  push(1.2, 'ACCEPT', '4600000017822');
  push(0.4, 'ACCEPT');
  return list;
}

export function mockInbound(): MockInbound {
  const today = tashkentDate();
  const all = skus(today);
  return { wholesalers: wholesalers(), skus: all, shipments: shipments(all, today), scans: { 112: scans112() }, replies: new Map(), lotActions: {} };
}
