import type { DeliveryMode, WhereDeliver } from '../../operator/model/operatorTypes';

/**
 * Liddan yaratilgan buyurtma (BE-18, TZ BUY-1…BUY-3): 13 holat. Admin, nazoratchi va operator ro'yxatlari, buyurtma
 * kartasi (admin-buyurtmalar, admin-buyurtma-karta, nazoratchi-buyurtmalar, operator-buyurtmalarim).
 * Backend maydonlari (`GET /admin/orders`, `/admin/orders/{id}`) + taklif maydonlari — docs/api-taklif/fe-26-*.md;
 * taklif maydoni kelmasa ekran ularsiz ishlaydi.
 */
export const ORDER_STATUSES = [
  'CONFIRMED', 'PICKING', 'PACKED',
  'HANDED_TO_ELCHI', 'IN_TRANSIT',
  'DELIVERED', 'REMITTED', 'SETTLED',
  'RETURN_REQUESTED', 'REFUSED', 'RETURNING', 'RETURNED_GRADED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Kim/qachon — ismlar taklif (backend faqat ID beradi). */
export interface OrderActor {
  name: string;
  at: string;
}

/** Ro'yxat qatori. */
export interface OrderListItem {
  id: string;
  /** Lid raqami — buyurtma shu raqam bilan ko'rinadi («L-1276»). */
  leadId: string | null;
  status: OrderStatus;
  createdAt: string;
  buyerName: string;
  phoneMasked: string | null;
  totalAmount: number;
  deliveryFee: number;
  source: string | null;
  affiliateId: string | null;
  // ── taklif ──
  regionName?: string | null;
  districtName?: string | null;
  whereDeliver?: WhereDeliver | null;
  productId?: string | null;
  productName?: string | null;
  quantity?: number | null;
  streamCode?: string | null;
  affiliateName?: string | null;
  /** Holat o'zgargan vaqt va izoh: «Otabek N.», «ertangi to'lqin», «T-0231 aktida». */
  statusAt?: string | null;
  statusDetail?: string | null;
  /** Elchi treki; posilka hali yaratilmagan — null. */
  trackNumber?: string | null;
  confirmedBy?: OrderActor | null;
  /** Mijoz so'rovi (nazoratchi, 47-qaror) — ro'yxatda belgisi. */
  requestKind?: CustomerRequestKind | null;
  /** Band qilingan tovar yacheykasi — bekor qilinsa qoldiq shu yerga qaytadi («B-02-1»). */
  stockCell?: string | null;
}

export interface OrderListPage {
  items: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  /** Taklif: holat bo'yicha sonlar (tablar). */
  counts?: Partial<Record<OrderStatus | 'ALL', number>> | null;
  /** Taklif (operator): o'z buyurtmalaridagi mahsulotlar — «Mahsulot» filtri. */
  facets?: { products?: Array<{ id: string; name: string }> } | null;
}

export interface OrderListQuery {
  status?: OrderStatus;
  /** Taklif: «Holat · o'zgardi» bo'yicha (sukut — yangisi tepada). */
  sort?: 'statusAt' | '-statusAt';
  search?: string;
  productId?: string;
  source?: string;
  affiliateId?: string;
  regionSoato?: string;
  whereDeliver?: WhereDeliver;
  confirmedById?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Holat tarixi yozuvi (backend `lead.statusHistory`; `actorName`, `note` — taklif). */
export interface OrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  accepted: boolean;
  actorType: string;
  actorId: string | null;
  actorRole: string | null;
  reason: string | null;
  createdAt: string;
  actorName?: string | null;
  note?: string | null;
}

export interface OrderPriceSnapshot {
  sku?: string | null;
  weightGrams?: number | null;
  basePrice: number;
  recommendedPrice: number;
  approvedPrice: number | null;
  markup?: number | null;
  affiliateFee: number;
  callCenterFee: number;
  hiddenDelivery: number;
  platformService: number;
}

export type MoneyState = 'HELD' | 'AVAILABLE' | 'REVERSED';
export type JournalState = 'SENT' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'FAILED';

/** Mijoz so'rovi (nazoratchi-buyurtmalar, «Buyurtmam qayerda» sahifasidan; 47-qaror, taklif). */
export type CustomerRequestKind = 'CANCEL' | 'CHANGE_ADDRESS';

export interface CustomerRequest {
  id: string;
  kind: CustomerRequestKind;
  createdAt: string;
  comment: string | null;
  /** Manzilni o'zgartirish: so'ralgan tuman va yetkazish. */
  regionSoato?: string | null;
  districtSoato?: string | null;
  districtName?: string | null;
  regionName?: string | null;
  whereDeliver?: WhereDeliver | null;
  addressLine?: string | null;
  state: 'OPEN' | 'DONE' | 'CLOSED';
  closedAt?: string | null;
  closedBy?: string | null;
  /** Yopilganda: mijozga nima deyildi (taklif). */
  closedComment?: string | null;
}

/** Nazoratchi ro'yxatidagi so'rov: taklif — buyurtma qisqachasi bilan (holat, mijoz, summa, tasdiqlagan). */
export type CustomerRequestRow = CustomerRequest & { orderId: string; order?: OrderListItem | null };

/** Buyurtma kartasi: backend maydonlari + taklif bloklari. */
export interface OrderDetail {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  buyerName: string;
  paymentMethod: string;
  totalAmount: number;
  deliveryFee: number;
  deliveryAddress: string | null;
  sellerOrders: Array<{
    id: string;
    subtotal: number;
    deliveryFee: number;
    codAmount: number;
    elchiShipmentId: string | null;
    trackingUrl: string | null;
    items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number; priceSnapshot: OrderPriceSnapshot | null }>;
  }>;
  lead: {
    source: string;
    leadId: string;
    streamId: string | null;
    affiliateId: string | null;
    wholesalerId: string | null;
    /** To'liq raqam — faqat admin (25-qaror); nazoratchi va operator — null. */
    customerPhone: string | null;
    regionSoato: string | null;
    districtSoato: string | null;
    whereDeliver: WhereDeliver | null;
    deliveryMode: DeliveryMode | null;
    deliveryShown: number;
    deliveryCost: number;
    deliveryEmbedded: number;
    weightGrams: number | null;
    codAmount: number;
    confirmedBy: string | null;
    addressConfirmedBy: string | null;
    statusHistory: OrderHistoryEntry[];
  } | null;
  // ── taklif bloklari ──
  /** Holat o'zgargan vaqt va izoh (ro'yxatdagi kabi): «ertangi to'lqin», «T-0231 aktida». */
  statusAt?: string | null;
  statusDetail?: string | null;
  /** Tasdiqlangan buyurtma qaysi kuni jo'natiladi (to'lqin): «Ertangi to'lqinda — 15.01.2027». */
  shipDate?: string | null;
  phoneMasked?: string | null;
  customer?: {
    regionName: string;
    districtName: string;
    addressLine: string;
    /** Mijoz sahifada yozgani — operator tuzatgan bo'lsa (BE-38). */
    original?: { regionName: string; districtName: string; addressLine: string; whereDeliver: WhereDeliver } | null;
    addressEditedBy?: OrderActor | null;
    addressConfirmedBy?: OrderActor | null;
    consentAt?: string | null;
  } | null;
  product?: { id: string; name: string; category: string | null; wholesalerName: string | null; weightGrams: number | null } | null;
  stream?: { code: string; affiliateName: string; affiliateId: string | null; sub1: string | null; leadCreatedAt: string | null } | null;
  confirmedByActor?: OrderActor | null;
  pricing?: {
    salePrice: number;
    recommendedPrice: number;
    approvedAt: string | null;
    deliveryMode: DeliveryMode;
    hiddenDelivery: number;
    priceAdd: number;
    visibleCenter: number;
    visibleAddress: number;
    elchiTariff: number;
    split: { wholesaler: number; affiliate: number; callCenter: number; platformService: number };
  } | null;
  money?: {
    state: MoneyState | null;
    elchiRemits: number;
    elchiFee: number;
    entries: Array<{ account: string; label: string; note: string | null; amount: number | null; state: MoneyState; at: string }>;
    returnUntil?: string | null;
  } | null;
  parcel?: {
    track: string | null;
    createdAt: string | null;
    act: { code: string; at: string; count: number } | null;
    label: { printedAt: string; by: string; count: number } | null;
    lastWebhookAt?: string | null;
    /** Elchi'ga posilka so'rovi urinishlari (navbat): javob kelmasa — FAILED, keyingisi — QUEUED. */
    attempts?: Array<{ at: string | null; state: 'FAILED' | 'QUEUED' | 'DONE' }> | null;
  } | null;
  elchiEvents?: Array<{ at: string | null; title: string; detail: string | null; state: JournalState }>;
  sms?: Array<{ at: string | null; title: string; detail: string | null; state: JournalState }>;
  picking?: { by: string | null; wave: string | null; from: string | null; to: string | null; scanned: number; total: number; barcode: string | null; cell: string | null; reservedAt: string | null; releasedAt: string | null } | null;
  postbacks?: Array<{ at: string; event: string; attempt: number; code: number | null; state: JournalState }>;
  cancel?: { by: string; at: string; reason: string; byRole: string | null } | null;
  returnRequest?: { at: string; by: string; reason: string } | null;
  dispute?: { at: string; by: string; reason: string; keepUntil: string | null } | null;
  /** Qora ro'yxatdagi mijoz: yetkazish puli oldindan (TZ 7). */
  prepayment?: { amount: number; paid: boolean } | null;
  requests?: CustomerRequest[];
}

export type OrderRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';

/** CSV eksport ustunlari (admin-buyurtmalar «CSV eksport»). */
export const ORDER_EXPORT_COLUMNS = ['order', 'customer', 'phone', 'stream', 'source', 'amount', 'status', 'track', 'priceSnapshot', 'subs'] as const;
export type OrderExportColumn = (typeof ORDER_EXPORT_COLUMNS)[number];
