/**
 * Postavka (inbound_shipment) va qabul — FE-16. Backend BE-17 da quriladi; shakl — taklif
 * (docs/api-taklif/fe-16-ombor.md). Alohida faylda: mock (`src/mocks`) ham ishlatadi, u esa
 * `httpClient` ni import qilmasligi kerak.
 *
 * Postavka — bitta optovikning bitta mahsuloti (BE-17: «optovik, mahsulot, son, kelish sanasi»):
 * formada bir nechta qator bo'lsa, har qator alohida postavka bo'ladi.
 */

/** BE-17 holatlari + bekor qilingan (admin-postavka «Bekor qilindi»). */
export type ShipmentStatus = 'DECLARED' | 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY' | 'CANCELLED';
export const SHIPMENT_STATUSES: readonly ShipmentStatus[] = ['DECLARED', 'IN_TRANSIT', 'RECEIVED', 'DISCREPANCY', 'CANCELLED'];
/** Omborchi kutayotganlar: e'lon qilingan va yo'ldagi. */
export const AWAITING_STATUSES: readonly ShipmentStatus[] = ['DECLARED', 'IN_TRANSIT'];
/** Qabul yakunlangan: akt bor. */
export const COMPLETED_STATUSES: readonly ShipmentStatus[] = ['RECEIVED', 'DISCREPANCY'];

/** «Kiritdi»: optovik o'zi (kabinet, M2) yoki xodim optovik nomidan. */
export type ShipmentAuthorRole = 'WHOLESALER' | 'ADMIN' | 'SUPERADMIN' | 'WAREHOUSE';

export interface ShipmentActor {
  name: string;
  role: ShipmentAuthorRole;
}

/** Optovik (komitent). */
export interface ShipmentParty {
  id: string;
  name: string;
  /** STIR. */
  tin: string | null;
}

/** Mahsulotning yagona SKU si (CPA mahsulotida bitta variant — BE-07, K4). */
export interface InboundSku {
  productId: string;
  variantId: string;
  name: string;
  barcode: string | null;
  /** Kategoriyadan meros: BAD, kosmetika, oziq-ovqat — partiya va muddat so'raladi (OMB-3). */
  expiryTracked: boolean;
  /** «kuzatilmaydi — elektronika» dagi kategoriya. */
  categoryName: string | null;
  /** SKU yacheykasi: «B-02-1». */
  cell: string | null;
}

/** Postavka ichidagi partiya (stock_lot): muddatsiz tovarda bitta — postavka raqami bilan. */
export interface ShipmentLot {
  id: string;
  /** «P-0120-1»; muddatsizda postavka raqami. */
  number: string;
  /** `YYYY-MM-DD`; muddat kuzatilmasa `null`. */
  expiresAt: string | null;
  /** Shu partiyaga qabul qilingan (yaroqli) son. */
  quantity: number;
  /** Server qoidasi: muddatiga 60 kun va undan ko'p — «mavjud»ga qo'shiladi. */
  sellable: boolean;
}

export interface InboundShipment {
  id: string;
  /** «P-0112» — akt raqami ham shu. */
  number: string;
  status: ShipmentStatus;
  wholesaler: ShipmentParty;
  sku: InboundSku;
  /** E'lon qilingan son (ariza). */
  declared: number;
  /** Qabul qilingan — sotuvga yaroqli. */
  accepted: number;
  /** Brak — qoldiqqa kirmaydi, farq aktiga yoziladi. */
  defect: number;
  /** Kelish sanasi, `YYYY-MM-DD` (Toshkent). */
  expectedAt: string;
  note: string | null;
  /** Yuk xati raqami (arizasiz postavka). */
  waybillNumber: string | null;
  createdAt: string;
  createdBy: ShipmentActor;
  inTransitAt: string | null;
  /** Qabul boshlangan — «hozir qabulda» / «keldi, hozir sanalmoqda». */
  receivingStartedAt: string | null;
  completedAt: string | null;
  completedBy: ShipmentActor | null;
  /** Omborchi izohi — aktga yoziladi. */
  actNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  lots: ShipmentLot[];
}

export interface ShipmentPage {
  items: InboundShipment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Tablar soni — filtrlarsiz (holat bo'yicha) va `ALL`. */
  counts: Record<ShipmentStatus | 'ALL', number>;
}

export interface ShipmentListParams {
  page: number;
  limit: number;
  /** Bir yoki bir nechta holat (`DECLARED,IN_TRANSIT`). */
  status?: readonly ShipmentStatus[];
  wholesalerId?: string;
  authorRole?: 'WHOLESALER' | 'STAFF';
  expectedFrom?: string;
  expectedTo?: string;
  /** Yakunlangan sana (Toshkent) — omborchining «Bugun qabul qilingan». */
  completedOn?: string;
  search?: string;
  /** Sukut `-createdAt` (oxirgi ariza tepada); kutilayotganlar — `expectedAt`. */
  sort?: '-createdAt' | 'expectedAt' | '-completedAt';
}

export interface DeclareShipmentsPayload {
  wholesalerId: string;
  expectedAt: string;
  note?: string;
  waybillNumber?: string;
  items: { variantId: string; quantity: number }[];
  idempotencyKey: string;
}

/** Skan rejimi: «Qabul» yoki «Brak» (brak tanlansa — faqat keyingi bitta skan). */
export type ScanMode = 'ACCEPT' | 'DEFECT';

/**
 * Server natijasi. Takroriy skan serverga bormaydi — brauzerda tushib qoladi (TC3).
 * `UNKNOWN` — kod hech bir SKUda yo'q; `FOREIGN` — boshqa mahsulotniki, bu postavkada yo'q.
 */
export type ScanResult = 'ACCEPTED' | 'DEFECT' | 'UNKNOWN' | 'FOREIGN';

export interface ShipmentScan {
  id: string;
  at: string;
  barcode: string;
  mode: ScanMode;
  result: ScanResult;
  /** Hisoblangandan keyingi son: «Qabul 98», «Brak 2». */
  total: number | null;
  /** FOREIGN: kod qaysi mahsulotniki. */
  productName: string | null;
  lotNumber: string | null;
}

/** Jurnal: oxirgilari (yangisi tepada) va jami skan soni. */
export interface ShipmentScanPage {
  items: ShipmentScan[];
  total: number;
}

export interface ScanPayload {
  barcode: string;
  mode: ScanMode;
  lotId?: string;
  scannedAt: string;
  idempotencyKey: string;
}

export interface ScanResponse {
  scan: ShipmentScan;
  shipment: InboundShipment;
}

export interface LotPayload {
  number: string;
  expiresAt: string;
}

export interface CompletePayload {
  note?: string;
  /** Kam kelgan (sanaldi < e'lon) bo'lsa — ikkinchi qadam «Kam deb yakunlash». */
  confirmShortage?: boolean;
}

/** Arizaga tanlanadigan mahsulot (e'lon formasi, arizasiz postavka, skan bo'yicha topish). */
export interface InboundProductOption extends InboundSku {
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED' | 'OUT_OF_STOCK';
  /** Moderatsiyada: «Ko'rib chiqilmoqda (13.01.2027 dan)». */
  reviewSince: string | null;
  onHand: number;
  available: number;
}

export interface InboundWholesaler extends ShipmentParty {
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  /** Shartnoma raqami va sanasi bor — yo'q bo'lsa ariza kiritib bo'lmaydi (OPT-1). */
  contractSigned: boolean;
  /** Komissiya shartnomasi (BE-07 `contractNumber`, `contractDate`) — aktdagi «Asos». */
  contractNumber: string | null;
  contractDate: string | null;
  /** Optovik kabineti (FE-23, M2): `null` — hali yo'q. */
  cabinet: { lastSeenAt: string | null } | null;
  onHand: number;
  awaiting: { shipments: number; quantity: number };
  products: InboundProductOption[];
}

/**
 * Ombordagi partiya (stock_lot, OMB-3) — «Qoldiq → Muddat» (ombor-muddat). Holatni server hisoblaydi:
 * sotuvda, yaqinlashmoqda (xabar oldidan N kun — TZ'da yo'q), sotuvdan chiqarilgan (< 60 kun), muddati o'tgan,
 * optovikka qaytarilmoqda, hisobdan chiqarilgan.
 */
export type LotState = 'ON_SALE' | 'APPROACHING' | 'BLOCKED' | 'EXPIRED' | 'RETURNING' | 'WRITTEN_OFF';
export const LOT_FILTERS = ['APPROACHING', 'BLOCKED', 'EXPIRED'] as const;
export type LotFilter = (typeof LOT_FILTERS)[number];

export interface StockLot {
  id: string;
  number: string;
  state: LotState;
  quantity: number;
  /** `YYYY-MM-DD`. */
  expiresAt: string;
  sku: InboundSku;
  wholesaler: ShipmentParty;
  /** Shu yacheykada turgan boshqa partiya — shtrix-kod bir xil, yig'ishda skaner farqlamaydi. */
  sharesCellWith: string | null;
  /** Optovik va adminga xabar ketgan vaqt. */
  notifiedAt: string | null;
}

export interface LotsOverview {
  items: StockLot[];
  counts: Record<'ALL' | LotFilter, number>;
  /** 60 kun (OMB-3); xabar oldidan kunlar — TZ'da yo'q, `null`. */
  rules: { minShelfDays: number; notifyDays: number | null };
  /** Muddati kuzatilmaydigan SKU lar (elektronika, uy-ro'zg'or…). */
  untracked: { variantId: string; name: string }[];
}

export interface LotListParams {
  state?: LotFilter;
  wholesalerId?: string;
  search?: string;
}

export interface WriteOffPayload {
  quantity: number;
  reason: 'EXPIRED' | 'DAMAGED' | 'OTHER';
  note: string;
}

/** «Qoldiq → Ro'yxat» qatori: `GET /admin/inventory/stock` (BE-16) + taklif maydonlari (docs/api-taklif/fe-16-ombor.md §5). */
export interface WarehouseStockRow {
  variantId: string;
  name: string;
  wholesalerName: string | null;
  barcode: string | null;
  cell: string | null;
  onHand: number;
  reserved: number;
  available: number;
  defect: number;
  /** Bugungi va ertangi to'lqindagi band (FE-17) — «Band qayerda». */
  reservedToday: number;
  reservedTomorrow: number;
  lots: { number: string; expiresAt: string | null; sellable: boolean }[];
}
