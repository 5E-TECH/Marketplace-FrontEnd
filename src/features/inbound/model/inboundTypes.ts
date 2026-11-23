/**
 * Postavka (inbound_shipment) va qabul — FE-16. Backend: BE-17 (PR #132, `admin/inventory/shipments`) —
 * bitta optovik, bir nechta mahsulot qatori; qabul bitta so'rov bilan (har qator: kelgan, brak, partiya, muddat,
 * yacheyka). Backendda hali yo'q maydonlar — taklif (docs/api-taklif/fe-16-ombor.md), kelmasa ham UI ishlaydi.
 * Alohida faylda: mock (`src/mocks`) ham ishlatadi, u esa `httpClient` ni import qilmasligi kerak.
 */

/** BE-17 holatlari. Bekor qilish backendda yo'q. */
export type ShipmentStatus = 'DECLARED' | 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY';
export const SHIPMENT_STATUSES: readonly ShipmentStatus[] = ['DECLARED', 'IN_TRANSIT', 'RECEIVED', 'DISCREPANCY'];
/** Omborchi kutayotganlar: e'lon qilingan va yo'ldagi. */
export const AWAITING_STATUSES: readonly ShipmentStatus[] = ['DECLARED', 'IN_TRANSIT'];
/** Qabul qilingan: akt bor. */
export const COMPLETED_STATUSES: readonly ShipmentStatus[] = ['RECEIVED', 'DISCREPANCY'];

/** «Kiritdi»: optovik o'zi (kabinet — BE-30, M2) yoki xodim optovik nomidan. */
export type ShipmentAuthorRole = 'WHOLESALER' | 'ADMIN' | 'SUPERADMIN' | 'WAREHOUSE';

/** Xodim: backend faqat ID beradi; ism va rol — taklif (`declaredByName`, `declaredByRole`, `receivedByName`). */
export interface ShipmentPerson {
  id: string;
  name: string | null;
  role: ShipmentAuthorRole | null;
}

/** Postavka qatori (`InboundShipmentItemDto`): CPA mahsulotining yagona SKU si. */
export interface ShipmentItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  barcode: string | null;
  declared: number;
  /** Qabuldan keyin: yaroqli (kelgan − brak) va brak; qabulgacha 0. */
  accepted: number;
  defect: number;
  /** Partiya va yaroqlilik muddati (`YYYY-MM-DD`) — kiritilgan bo'lsa. */
  batch: string | null;
  expiryDate: string | null;
  /** Yacheyka — qabulda yoziladi. */
  cell: string | null;
  /** Taklif: muddat so'raladi (BAD, kosmetika, oziq-ovqat — kategoriyadan); kelmasa — ixtiyoriy. */
  expiryTracked: boolean;
}

export interface InboundShipment {
  id: string;
  /** «P-0112» — akt raqami ham shu. */
  number: string;
  status: ShipmentStatus;
  /** Optovik nomi — taklif (`wholesalerName`); backend faqat ID beradi. */
  wholesaler: { id: string; name: string | null };
  /** Kelish sanasi, `YYYY-MM-DD` (Toshkent). */
  expectedAt: string;
  note: string | null;
  createdAt: string;
  declaredBy: ShipmentPerson;
  receivedBy: ShipmentPerson | null;
  receivedAt: string | null;
  /** Omborchi izohi — aktga yoziladi. */
  receiveComment: string | null;
  items: ShipmentItem[];
  /** Qatorlar yig'indisi: e'lon, qabul (yaroqli), brak. */
  declared: number;
  accepted: number;
  defect: number;
}

export interface ShipmentPage {
  items: InboundShipment[];
  total: number;
  page: number;
  limit: number;
}

/** Backend filtrlari: bitta holat, optovik, sahifa (yangisi tepada). */
export interface ShipmentListParams {
  page: number;
  limit: number;
  status?: ShipmentStatus;
  wholesalerId?: string;
}

export interface DeclarePayload {
  wholesalerId: string;
  expectedAt: string;
  note?: string;
  items: { productId: string; quantity: number }[];
}

export interface ReceiveLine {
  itemId: string;
  /** Kelgan — brak bilan birga. */
  receivedQty: number;
  defectiveQty: number;
  batch?: string;
  expiryDate?: string;
  cell: string;
}

export interface ReceivePayload {
  items: ReceiveLine[];
  comment?: string;
}

/** Skan rejimi: «Qabul» yoki «Brak» (brak tanlansa — faqat keyingi bitta skan). */
export type ScanMode = 'ACCEPT' | 'DEFECT';

/** Optovik (`WholesalerDto`): shartnoma bo'lmasa ariza kiritib bo'lmaydi (OPT-1). */
export interface InboundWholesaler {
  id: string;
  name: string;
  /** STIR. */
  tin: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  contractNumber: string | null;
  contractDate: string | null;
  contractSigned: boolean;
  /** Kabinet egasi bor — optovik arizani o'zi ham beradi (FE-23, M2). */
  hasCabinet: boolean;
}

/** E'lon formasidagi mahsulot: `GET /admin/products?shopId=` + qoldiq (`GET /admin/inventory/stock?shopId=`). */
export interface InboundProductOption {
  productId: string;
  name: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED' | 'OUT_OF_STOCK';
  /** BE-17: postavka faqat CPA mahsulotiga. */
  cpaEnabled: boolean;
  /** BAD yoki kategoriya bo'yicha muddat kuzatiladi (taklif `expiryTracked`). */
  expiryTracked: boolean;
  onHand: number;
  available: number;
}

/**
 * Ombordagi partiya (`StockLotDto`, OMB-3). Holatni brauzer hisoblaydi: muddati o'tgan, sotuvdan chiqarilgan
 * (60 kundan kam — `blocked`), sotuvda.
 */
export type LotState = 'ON_SALE' | 'BLOCKED' | 'EXPIRED';
export const LOT_FILTERS = ['BLOCKED', 'EXPIRED'] as const;
export type LotFilter = (typeof LOT_FILTERS)[number];

export interface StockLot {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  batch: string | null;
  /** `YYYY-MM-DD`. */
  expiryDate: string;
  /** Muddat − 60 kun: shundan keyin sotilmaydi. */
  sellableUntil: string;
  quantity: number;
  blocked: boolean;
}

/** «Hisobdan chiqarish» — `POST /admin/inventory/adjust` (manfiy, `lotId` bilan). */
export interface WriteOffPayload {
  variantId: string;
  lotId: string;
  quantity: number;
  reason: string;
}

/** «Qoldiq → Ro'yxat» qatori: `GET /admin/inventory/stock` (BE-16, BE-17) + taklif maydonlari (§5). */
export interface WarehouseStockRow {
  variantId: string;
  productId: string | null;
  name: string;
  /** Optovik (`shopId`) va nomi — taklif (`shopName`). */
  wholesalerId: string | null;
  wholesalerName: string | null;
  barcode: string | null;
  cell: string | null;
  onHand: number;
  reserved: number;
  available: number;
  /** Sotuvdan chiqqan partiyalardagi son — «mavjud»ga kirmaydi (BE-17). */
  blocked: number;
  /** Taklif: brak, bugungi va ertangi to'lqindagi band (FE-17). */
  defect: number;
  reservedToday: number;
  reservedTomorrow: number;
}
