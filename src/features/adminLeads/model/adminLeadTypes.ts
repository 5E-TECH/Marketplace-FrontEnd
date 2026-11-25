import type { DeliveryMode, LeadCard, LeadOutcome, LeadStatus } from '../../operator/model/operatorTypes';
import type { OrderStatus } from '../../orders/model/orderTypes';

/**
 * Admin va nazoratchi: lidlar ro'yxati va lid kartasi (admin-lidlar, admin-lid-karta; BE-13/BE-35/BE-42).
 * Backend: `GET /admin/leads`, `GET /admin/leads/{id}`, `POST /admin/leads/{id}/reopen`,
 * `POST /supervisor/leads/{id}/transfer`. Taklif maydonlari — docs/api-taklif/fe-26-*.md.
 */

/** Tablar: Ishda — Yangi, Bronda, Qayta qo'ng'iroq; Yopilgan — Yaroqsiz, Dublikat, Aloqa bo'lmadi. */
export const LEAD_TABS = ['ALL', 'ACTIVE', 'CONFIRMED', 'REJECTED', 'CLOSED', 'REVIEW'] as const;
export type LeadTab = (typeof LEAD_TABS)[number];

export const LEAD_TAB_STATUSES: Record<Exclude<LeadTab, 'ALL' | 'REVIEW'>, readonly LeadStatus[]> = {
  ACTIVE: ['NEW', 'BOOKED', 'CALLBACK'],
  CONFIRMED: ['CONFIRMED'],
  REJECTED: ['REJECTED'],
  CLOSED: ['INVALID', 'MERGED', 'NO_CONTACT'],
};

export interface AdminLeadListItem {
  id: string;
  createdAt: string;
  status: LeadStatus;
  source: 'LANDING' | 'SITE' | 'API';
  customerName: string;
  phoneMasked: string;
  productName: string;
  affiliateName: string | null;
  operatorName: string | null;
  orderId: string | null;
  // ── taklif ──
  productId?: string | null;
  regionName?: string | null;
  streamCode?: string | null;
  salePrice?: number | null;
  attemptsCount?: number;
  operatorId?: string | null;
  /** Yopilgan va rad etilgan: sabab («Qimmat», «L-1163 ga birlashtirildi»). */
  closedNote?: string | null;
  /** Rad etilgan vaqt — qayta ochish 3 kun ichida (admin). */
  rejectedAt?: string | null;
  /** Rejalashtirilgan qo'ng'iroq vaqti (o'tkazish oynasi). */
  callbackAt?: string | null;
  /** Firibgarlik tekshiruvida (bir IP dan ko'p ariza) — navbatga tushmagan. */
  inReview?: boolean;
  /** «Yangi» lidning navbatdagi o'rni (o'tkazish oynasi: «navbatda 8-o'rin · 1 daq»). */
  queuePosition?: number | null;
  /** Holat oxirgi marta o'zgargan vaqt — real vaqtda «hozirgina · 14:38» belgisi. */
  statusAt?: string | null;
}

export interface AdminLeadsPage {
  items: AdminLeadListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  // ── taklif ──
  counts?: Partial<Record<LeadTab, number>> | null;
  /** Tekshiruvdagi arizalar banneri (BE-35): bir IP dan 10 daqiqada ko'p ariza. */
  review?: { count: number; streamCode: string; affiliateName: string; from: string; to: string } | null;
}

export interface AdminLeadQuery {
  tab?: LeadTab;
  search?: string;
  status?: LeadStatus;
  productId?: string;
  operatorId?: string;
  affiliateId?: string;
  source?: string;
  from?: string;
  to?: string;
  sort?: 'createdAt' | '-createdAt' | 'price' | '-price' | 'attempts' | '-attempts';
  page?: number;
  limit?: number;
}

/** Urinish (admin-lid-karta jadvali): kanal, davomiylik, yozuv. */
export interface AdminLeadAttempt {
  at: string;
  operatorName: string;
  channel: string | null;
  outcome: LeadOutcome | 'IN_CALL';
  comment: string | null;
  durationSeconds: number | null;
  /** Yozuv: bor (`READY` + `recordingUrl`), suhbatdan keyin (`AFTER_CALL`), yo'q (`NONE`). */
  recording: 'READY' | 'AFTER_CALL' | 'NONE' | null;
  recordingUrl?: string | null;
  // ── taklif (tinglash oynasi) ──
  /** Kim tugatdi: «Tugatdi — operator». */
  endedBy?: 'OPERATOR' | 'CUSTOMER' | null;
  /** «Qo'ng'iroq yozib olinmoqda» ogohlantirishi: boshlanish va tugash soniyasi. */
  notice?: { from: number; to: number } | null;
  /** Yozuv shu sanagacha saqlanadi (90 kun). */
  keptUntil?: string | null;
}

/** Admin lid kartasi = operator kartasi (`LeadCardDto`) + taklif bloklari. */
export type AdminLeadCard = LeadCard & {
  /** To'liq raqam — faqat admin (25-qaror); nazoratchiga — null. */
  phone?: string | null;
  /** Lid kimda: holat (since — «Onlayn · 13:15 dan»), suhbatdami (`callStartedAt` — «suhbat 01:12»). */
  operator?: { id: string; name: string; state: 'ONLINE' | 'BREAK' | 'OFFLINE'; since: string | null; inCall: boolean; callStartedAt?: string | null } | null;
  queuePosition?: number | null;
  closesAt?: string | null;
  rejectedAt?: string | null;
  consentAt?: string | null;
  sameNumberLeads?: number;
  /** Mahsulot ma'lumoti (kategoriya, optovik, og'irlik, yetkazish rejimi va narxlari). */
  productInfo?: { category: string | null; wholesalerName: string | null; weightGrams: number | null; deliveryMode: DeliveryMode | null; options: { CENTER: number; ADDRESS: number } | null } | null;
  stream?: { code: string; productName: string; createdAt: string | null; affiliateName: string; affiliateId: string | null; sub1: string | null; subs: string | null; utmSource: string | null; fbclid: boolean; ip: string | null; device: string | null } | null;
  attemptLog?: AdminLeadAttempt[];
  postbacks?: Array<{ at: string; event: string; attempt: number; code: number | null; state: 'SENT' | 'FAILED' | 'PENDING' }>;
  /** Dublikat: asosiy lid (MERGED) — u yerda urinishlar va natija davom etadi. */
  mergedInto?: {
    id: string;
    productName: string;
    status: LeadStatus;
    createdAt: string;
    streamCode?: string | null;
    affiliateName?: string | null;
    operatorName?: string | null;
    attemptsCount?: number;
  } | null;
  order?: { id: string; status: OrderStatus; createdAt: string; totalAmount: number } | null;
  reopened?: { at: string; by: string; reason: string } | null;
  /** Bron boshlangan vaqt («14:36 → 14:46 · 10 daqiqa»). */
  bookedAt?: string | null;
  /** Lid keldi: sahifa kodi, sotuvchi; IP va qurilma — `stream` da. */
  affiliateName?: string | null;
  /** Rad etgan / yopgan operator va vaqt («Shohruh M. · 13:02»). */
  closedBy?: { name: string; at: string } | null;
};

/** Telefoniyadagi joriy holat (taklif, queue-summary `operators[].activity`): «suhbatda 02:12 · L-1246». */
export interface OperatorActivity {
  kind: 'IN_CALL' | 'RINGING' | 'WRAP_UP' | 'CONNECTING' | 'IDLE';
  leadId: string | null;
  since: string | null;
}

/**
 * O'tkazish oynasidagi operator: `GET /operator/queue-summary` `operators[]` (BE-13) + taklif `maxBookings`,
 * `scheduledCalls`, `activity`. Faqat «Ishda» operatorga o'tkaziladi (BE-42).
 */
export interface TransferOperator {
  id: string;
  name: string;
  state: 'ONLINE' | 'BREAK' | 'OFFLINE';
  activeBookings: number;
  maxBookings: number;
  scheduledCalls: number | null;
  activity: OperatorActivity | null;
}

/** Filtr variantlari (taklif `GET /admin/leads/filter-options`). */
export interface LeadFilterOptions {
  products: Array<{ id: string; name: string }>;
  operators: Array<{ id: string; name: string }>;
  affiliates: Array<{ id: string; name: string }>;
}

/** CSV eksport ustunlari (admin-lidlar «CSV eksport»). */
export const LEAD_EXPORT_COLUMNS = ['lead', 'customer', 'phone', 'stream', 'price', 'operator', 'attempts', 'status', 'createdAt', 'subs'] as const;
export type LeadExportColumn = (typeof LEAD_EXPORT_COLUMNS)[number];
