import { Archive, Ban, CircleAlert, CircleCheck, CircleDot, CircleMinus, CirclePause, CircleX, Clock, Package, Pencil, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../i18n/translations';
import type { BadgeTone } from '../Badge/Badge';

/**
 * Holat → rang (komponentlar-E §1, §33): bir holat — bir rang hamma joyda. Ikonka ohangdan:
 * info `CircleDot` · warning `Clock` · success `CircleCheck` · danger `CircleX` · neutral `CircleMinus`.
 * Kod — backend qiymati (T5); nomi — `status.<oila>.<KOD>` tarjimasi.
 */
export const TONE_ICON: Partial<Record<BadgeTone, LucideIcon>> = {
  info: CircleDot,
  warning: Clock,
  success: CircleCheck,
  danger: CircleX,
  neutral: CircleMinus,
  yellow: CircleAlert,
  orange: TriangleAlert,
};

export interface StatusEntry {
  tone: BadgeTone;
  icon?: LucideIcon;
}

export const STATUS_FAMILIES = {
  /** Lid (TZ 5, content-spec 3.4) — 8 holat. */
  lead: {
    NEW: { tone: 'info' },
    BOOKED: { tone: 'warning' },
    CALLBACK: { tone: 'warning' },
    CONFIRMED: { tone: 'success' },
    REJECTED: { tone: 'danger' },
    INVALID: { tone: 'neutral' },
    MERGED: { tone: 'neutral' },
    NO_CONTACT: { tone: 'neutral' },
  },
  /** Buyurtma va posilka (BUY-2, T5) — 13 holat; RETURN_REQUESTED nomi TZ'da yo'q. */
  order: {
    CONFIRMED: { tone: 'info' },
    PICKING: { tone: 'warning' },
    PACKED: { tone: 'warning' },
    HANDED_TO_ELCHI: { tone: 'warning' },
    IN_TRANSIT: { tone: 'warning' },
    DELIVERED: { tone: 'success' },
    REMITTED: { tone: 'success' },
    SETTLED: { tone: 'neutral' },
    REFUSED: { tone: 'danger' },
    RETURNING: { tone: 'danger' },
    RETURNED_GRADED: { tone: 'neutral' },
    CANCELLED: { tone: 'danger' },
    RETURN_REQUESTED: { tone: 'unnamed' },
  },
  /** Narx qarori (TZ 2.6, A.8) — 4 holat; Qizil saqlanmaydi. */
  price: {
    GREEN: { tone: 'success' },
    YELLOW: { tone: 'yellow' },
    ORANGE: { tone: 'orange' },
    RED: { tone: 'danger' },
  },
  /** Pul yechish (MOL-5, T5): PROCESSING ekranda «Tasdiqlandi»; ikkinchi tasdiq — kodsiz ichki bosqich. */
  payout: {
    REQUESTED: { tone: 'warning' },
    SECOND_APPROVAL: { tone: 'warning' },
    APPROVED: { tone: 'info' },
    PROCESSING: { tone: 'info' },
    PAID: { tone: 'success' },
    REJECTED: { tone: 'danger' },
    FAILED: { tone: 'danger' },
  },
  /** Foydalanuvchi (ADM-3): Faol · Nofaol · Bloklangan (`Ban`). */
  user: {
    ACTIVE: { tone: 'success' },
    INACTIVE: { tone: 'neutral' },
    BLOCKED: { tone: 'danger', icon: Ban },
  },
  /** Sotuvchi sahifasi (T3 stream.status; sotuvchi-sahifalarim): OUT_OF_STOCK — offer qoldig'i 0 (offerdan). */
  stream: {
    ACTIVE: { tone: 'success' },
    STOPPED: { tone: 'neutral', icon: CirclePause },
    OUT_OF_STOCK: { tone: 'neutral', icon: Package },
    PAUSED: { tone: 'neutral', icon: CirclePause },
  },
  /** Mahsulot (BE-07 `ProductStatus`; admin-mahsulotlar): BLOCKED — `isBlocked` («To'xtatilgan»). */
  product: {
    PENDING_REVIEW: { tone: 'warning' },
    ACTIVE: { tone: 'success' },
    REJECTED: { tone: 'danger' },
    DRAFT: { tone: 'neutral', icon: Pencil },
    BLOCKED: { tone: 'neutral', icon: CirclePause },
    ARCHIVED: { tone: 'neutral', icon: Archive },
    OUT_OF_STOCK: { tone: 'neutral' },
  },
  /** Postavka (T4 inbound_shipment, admin-postavka «Ariza yo‘li»). */
  shipment: {
    DECLARED: { tone: 'info' },
    IN_TRANSIT: { tone: 'warning' },
    RECEIVED: { tone: 'success' },
    DISCREPANCY: { tone: 'danger' },
    CANCELLED: { tone: 'danger' },
  },
} as const satisfies Record<string, Record<string, StatusEntry>>;

export type StatusFamily = keyof typeof STATUS_FAMILIES;
export type StatusCode<F extends StatusFamily> = keyof (typeof STATUS_FAMILIES)[F] & string;

/** Holat nomi kaliti: `status.lead.NEW` va hokazo (statusTranslations.ts). */
export function statusKey<F extends StatusFamily>(family: F, code: StatusCode<F>): TranslationKey {
  return `status.${family}.${code}` as TranslationKey;
}
