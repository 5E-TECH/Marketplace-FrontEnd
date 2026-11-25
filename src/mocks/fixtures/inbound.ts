import type { ShipmentAuthorRole, ShipmentStatus } from '../../features/inbound/model/inboundTypes';
import type { BankChangeRequest, WholesalerAct } from '../../features/wholesalers/model/wholesalerTypes';
import { addDays, tashkentDate } from '../utils';
import { mockWholesalerActs } from './wholesalerFinance';

/**
 * Ombor: postavka va qabul (FE-16) — BE-17 shakli (`InboundShipmentDto`, `StockLotDto`) va taklif maydonlari.
 * Namuna (ombor-qabul, admin-postavka, ombor-qoldiq): Namuna Savdo MChJ ning 4 ta SKU si, 3 postavka kutilmoqda.
 * Muddatli tovar — Namuna Farm MChJ «Vitamin kompleksi» (BAD); shartnomasiz — Barakat.
 */
export interface MockInboundWholesaler {
  id: string;
  name: string;
  tin: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  contractNumber: string | null;
  contractDate: string | null;
  /** Optovik kabineti egasi (FE-23); `null` — kabinet yo'q. */
  ownerUserId: string | null;
  /** OPT-1 rekvizitlari (BE-07 `WholesalerDto`); rahbar — taklif (fe-25 §1). */
  legalType: 'LEGAL_ENTITY' | 'SOLE_PROPRIETOR';
  directorName: string | null;
  bankName: string;
  bankAccount: string;
  bankMfo: string;
  phone: string | null;
  address: string | null;
  description: string | null;
  moderationNote: string | null;
  createdAt: string;
  createdBy: string | null;
  statusChangedAt: string | null;
  /** Taklif (fe-25 §1): holatni o'zgartirgan admin va to'xtatish sababi. */
  statusChangedBy: string | null;
  suspendReason: string | null;
  /** Taklif (fe-25 §8): kabinetdan bank rekviziti o'zgarishi so'rovi. */
  bankChangeRequest: BankChangeRequest | null;
  /** Taklif (fe-25 §5): optovikka yuboriladigan aktlar. */
  acts: WholesalerAct[];
  /** Audit jurnali (BE-07 har amalni yozadi) — kartadagi «Tarix». */
  history: { id: string; at: string; actorName: string | null; action: string; meta: Record<string, unknown> }[];
  /** BE-30: kabinetda elektron imzolangan shartnoma (qog'oz shartnomada null). */
  contractVersion: string | null;
  contractAcceptedAt: string | null;
  /** Taklif (fe-25 §3): komissiya shartnomasining qog'oz nusxasi skani. */
  contractFile: { id: string; fileName: string; uploadedAt: string; uploadedBy: string | null } | null;
  /** Taklif (fe-25 §1): kabinet — taklif yuborilgan, ochilgan, oxirgi faollik. */
  cabinet: { phone: string; invitedAt: string; openedAt: string | null; lastActiveAt: string | null } | null;
}

/** CPA mahsulotining yagona SKU si va ombordagi holati. */
export interface MockSku {
  productId: string;
  variantId: string;
  name: string;
  barcode: string;
  cell: string | null;
  wholesalerId: string;
  status: 'ACTIVE' | 'PENDING_REVIEW';
  expiryTracked: boolean;
  onHand: number;
  reserved: number;
  /** Taklif: brak va ertangi to'lqindagi band. */
  defect: number;
  reservedTomorrow: number;
}

export interface MockShipmentItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  barcode: string | null;
  declaredQty: number;
  receivedQty: number | null;
  defectiveQty: number | null;
  batch: string | null;
  expiryDate: string | null;
  cell: string | null;
  expiryTracked: boolean;
}

export interface MockShipment {
  id: string;
  number: string;
  wholesalerId: string;
  wholesalerName: string;
  status: ShipmentStatus;
  expectedAt: string;
  note: string | null;
  declaredBy: string;
  declaredByName: string;
  declaredByRole: ShipmentAuthorRole;
  receivedBy: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  receiveComment: string | null;
  items: MockShipmentItem[];
  createdAt: string;
}

export interface MockLot {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  batch: string | null;
  expiryDate: string;
  quantity: number;
}

export interface MockInbound {
  wholesalers: MockInboundWholesaler[];
  skus: MockSku[];
  shipments: MockShipment[];
  lots: MockLot[];
  /** idempotencyKey → javob (`adjust`). */
  replies: Map<string, unknown>;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const DAY = 24 * 60;

const ADMIN = { id: 'U-0007', name: 'Nodira Karimova', role: 'ADMIN' as const };
const WAREHOUSE = { id: 'U-0005', name: 'Otabek Nurmatov' };

function wholesalers(today: string): MockInboundWholesaler[] {
  return baseWholesalers(today).map((item) => ({ ...item, acts: mockWholesalerActs(item.id), history: initialHistory(item) }));
}

/** Boshlang'ich tarix: kiritilgan, shartnoma skani, kabinetga taklif. */
function initialHistory(item: Omit<MockInboundWholesaler, 'acts' | 'history'>): MockInboundWholesaler['history'] {
  const entries: MockInboundWholesaler['history'] = [{ id: `H-${item.id}-1`, at: item.createdAt, actorName: item.createdBy, action: 'wholesaler.create', meta: {} }];
  if (item.contractFile) entries.push({ id: `H-${item.id}-2`, at: item.contractFile.uploadedAt, actorName: item.contractFile.uploadedBy, action: 'wholesaler.contract.upload', meta: { contractNumber: item.contractNumber, contractDate: item.contractDate, fileName: item.contractFile.fileName } });
  if (item.cabinet) entries.push({ id: `H-${item.id}-3`, at: item.cabinet.invitedAt, actorName: item.createdBy, action: 'wholesaler.owner.link', meta: { phone: item.cabinet.phone } });
  return entries;
}

function baseWholesalers(today: string): Omit<MockInboundWholesaler, 'acts' | 'history'>[] {
  const common = { statusChangedAt: null, statusChangedBy: null, suspendReason: null, bankChangeRequest: null, contractVersion: null, contractAcceptedAt: null, legalType: 'LEGAL_ENTITY' as const, bankName: 'Namuna Bank ATB', bankMfo: '00873', description: null, moderationNote: null, createdBy: ADMIN.name };
  const signedAt = (days: number) => `${addDays(today, -days)}T05:00:00.000Z`;
  return [
    {
      ...common, id: '7', name: 'Namuna Savdo MChJ', tin: '307418562', status: 'ACTIVE', contractNumber: 'K-2027/014', contractDate: addDays(today, -24),
      ownerUserId: 'U-0002', directorName: 'Nazarov Botir Akmalovich', bankAccount: '20208000405128739001', phone: '+998992143658',
      address: 'Toshkent shahri, Yashnobod tumani', createdAt: signedAt(24),
      contractFile: { id: 'D-7001', fileName: 'shartnoma-skan.pdf', uploadedAt: signedAt(24), uploadedBy: ADMIN.name },
      cabinet: { phone: '+998992143658', invitedAt: signedAt(7), openedAt: signedAt(7), lastActiveAt: minutesAgo(23) },
      contractVersion: '1.0', contractAcceptedAt: signedAt(7),
    },
    {
      ...common, id: '8', name: 'Namuna Farm MChJ', tin: '307418570', status: 'ACTIVE', contractNumber: 'K-2027/021', contractDate: addDays(today, -20),
      ownerUserId: null, directorName: 'Rahimova Gulnora Sobirovna', bankAccount: '20208000405128739002', phone: '+998901112233',
      address: 'Toshkent shahri, Chilonzor tumani', createdAt: signedAt(30),
      contractFile: { id: 'D-8001', fileName: 'shartnoma-farm.pdf', uploadedAt: signedAt(20), uploadedBy: ADMIN.name }, cabinet: null,
    },
    {
      ...common, id: '9', name: 'Barakat Uy Jihozlari MChJ', tin: '305112847', status: 'ACTIVE', contractNumber: null, contractDate: null,
      ownerUserId: null, directorName: 'Yusupov Anvar Karimovich', bankAccount: '20208000405128739003', phone: '+998934182705',
      address: 'Samarqand shahri', createdAt: signedAt(2), contractFile: null, cabinet: null,
    },
  ];
}

function sku(productId: string, name: string, barcode: string, cell: string | null, extra: Partial<MockSku> = {}): MockSku {
  return {
    productId, variantId: `${productId}01`, name, barcode, cell, wholesalerId: '7', status: 'ACTIVE', expiryTracked: false,
    onHand: 0, reserved: 0, defect: 0, reservedTomorrow: 0, ...extra,
  };
}

function skus(): MockSku[] {
  return [
    sku('501', 'Simsiz quloqchinlar', '4780012345677', 'B-02-1', { onHand: 128, reserved: 8, reservedTomorrow: 2 }),
    sku('502', 'Oshxona tarozisi', '4780012345684', 'A-01-3', { onHand: 49, reserved: 4, defect: 1 }),
    sku('503', 'Elektr choynak', '4780012345691', 'B-02-2', { onHand: 28, reserved: 2, defect: 1 }),
    sku('504', 'Bolalar termos shishasi', '4780012345707', 'C-03-1', { onHand: 1, reserved: 1, defect: 2, reservedTomorrow: 1 }),
    sku('506', 'Bug‘li dazmol', '4780012345721', null, { status: 'PENDING_REVIEW' }),
    sku('511', 'Vitamin kompleksi', '4780012345714', null, { wholesalerId: '8', expiryTracked: true }),
  ];
}

interface Seed {
  number: number;
  productId: string;
  declared: number;
  received?: number;
  defect?: number;
  status: ShipmentStatus;
  expectedAt: string;
  author?: 'cabinet' | 'admin';
  createdMinutesAgo: number;
  receivedMinutesAgo?: number;
  comment?: string;
}

function shipment(all: MockSku[], list: MockInboundWholesaler[], seed: Seed): MockShipment {
  const item = all.find((entry) => entry.productId === seed.productId) ?? all[0];
  const wholesaler = list.find((entry) => entry.id === item.wholesalerId) ?? list[0];
  const received = seed.receivedMinutesAgo !== undefined;
  const cabinet = seed.author === 'cabinet';
  return {
    id: String(seed.number),
    number: `P-${String(seed.number).padStart(4, '0')}`,
    wholesalerId: wholesaler.id,
    wholesalerName: wholesaler.name,
    status: seed.status,
    expectedAt: seed.expectedAt,
    note: null,
    declaredBy: cabinet ? 'U-0002' : ADMIN.id,
    declaredByName: cabinet ? wholesaler.name : ADMIN.name,
    declaredByRole: cabinet ? 'WHOLESALER' : ADMIN.role,
    receivedBy: received ? WAREHOUSE.id : null,
    receivedByName: received ? WAREHOUSE.name : null,
    receivedAt: received ? minutesAgo(seed.receivedMinutesAgo ?? 0) : null,
    receiveComment: seed.comment ?? null,
    createdAt: minutesAgo(seed.createdMinutesAgo),
    items: [{
      id: `${seed.number}1`, productId: item.productId, productName: item.name, variantId: item.variantId, sku: `SKU-${item.productId}`,
      barcode: item.barcode, declaredQty: seed.declared,
      receivedQty: received ? seed.received ?? seed.declared : null, defectiveQty: received ? seed.defect ?? 0 : null,
      batch: null, expiryDate: null, cell: received ? item.cell : null, expiryTracked: item.expiryTracked,
    }],
  };
}

function shipments(all: MockSku[], list: MockInboundWholesaler[], today: string): MockShipment[] {
  const seeds: Seed[] = [
    { number: 113, productId: '504', declared: 60, status: 'IN_TRANSIT', expectedAt: today, author: 'cabinet', createdMinutesAgo: 2 * DAY },
    { number: 112, productId: '501', declared: 100, status: 'DECLARED', expectedAt: today, author: 'cabinet', createdMinutesAgo: 2 * DAY + 30 },
    { number: 111, productId: '502', declared: 50, status: 'DECLARED', expectedAt: addDays(today, 1), author: 'cabinet', createdMinutesAgo: 2 * DAY + 60 },
    { number: 110, productId: '503', declared: 20, status: 'RECEIVED', expectedAt: today, author: 'cabinet', createdMinutesAgo: 4 * DAY, receivedMinutesAgo: 5 * 60 },
    { number: 104, productId: '502', declared: 50, status: 'RECEIVED', expectedAt: addDays(today, -7), createdMinutesAgo: 9 * DAY, receivedMinutesAgo: 7 * DAY },
    {
      number: 98, productId: '504', declared: 63, received: 63, defect: 2, status: 'DISCREPANCY', expectedAt: addDays(today, -16),
      createdMinutesAgo: 17 * DAY, receivedMinutesAgo: 16 * DAY, comment: '2 ta shishaning qopqog‘i singan',
    },
    { number: 97, productId: '501', declared: 200, status: 'RECEIVED', expectedAt: addDays(today, -8), createdMinutesAgo: 18 * DAY, receivedMinutesAgo: 8 * DAY },
    { number: 89, productId: '503', declared: 13, status: 'RECEIVED', expectedAt: addDays(today, -16), createdMinutesAgo: 18 * DAY + 60, receivedMinutesAgo: 16 * DAY },
    { number: 88, productId: '501', declared: 84, status: 'RECEIVED', expectedAt: addDays(today, -16), createdMinutesAgo: 18 * DAY + 120, receivedMinutesAgo: 16 * DAY + 5 },
  ];
  return seeds.map((seed) => shipment(all, list, seed));
}

export function mockInbound(): MockInbound {
  const today = tashkentDate();
  const all = skus();
  const list = wholesalers(today);
  return { wholesalers: list, skus: all, shipments: shipments(all, list, today), lots: [], replies: new Map() };
}
