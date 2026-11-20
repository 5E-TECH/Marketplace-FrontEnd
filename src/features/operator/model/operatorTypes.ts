import type { components } from '../../../generated/api-types';

type Schemas = components['schemas'];

export type LeadCard = Schemas['LeadCardDto'];
export type LeadStatus = LeadCard['status'];
export type LeadOutcome = Schemas['SubmitLeadResultDto']['outcome'];
export type LeadRejectReason = NonNullable<Schemas['SubmitLeadResultDto']['rejectReason']>;
export type LeadResultInput = Schemas['SubmitLeadResultDto'];
export type LeadResultAccepted = Schemas['LeadResultAcceptedDto'];
export type OperatorQueueSummary = Schemas['OperatorQueueSummaryDto'];

/**
 * Bron va rejalashtirilgan qo'ng'iroq qatori. `lastOutcome`, `lastComment`, `lastAttemptAt` —
 * taklif (BE-13): «15:00 Bobur — O'ylab ko'radi «Turmush o'rtog'i bilan…»» qatori uchun
 * (operator-bosh, operator-rejalashtirilgan). Backendda hali yo'q — bo'lmasa ekran «—» ko'rsatadi.
 */
export type OperatorLeadListItem = Schemas['OperatorLeadListItemDto'] & {
  lastOutcome?: LeadOutcome | null;
  lastComment?: string | null;
  lastAttemptAt?: string | null;
};

/**
 * «Bugungi urinishlarim · oxirgi 10 tasi» (operator-bosh). Taklif (BE-13): `GET /operator/attempts`.
 * `durationSeconds` — suhbat davomiyligi (yozuvlar FE-10 / BE-15 bilan); hozir bo'sh.
 */
export interface OperatorAttemptItem {
  at: string;
  leadId: string;
  customerName: string;
  productName: string;
  outcome: LeadOutcome;
  comment: string | null;
  rejectReason: LeadRejectReason | null;
  nextAttemptAt: string | null;
  durationSeconds: number | null;
}

export interface OperatorAttemptsPage {
  items: OperatorAttemptItem[];
  total: number;
}

export type LeadPrice = Schemas['LeadPriceDto'];
export type WhereDeliver = LeadPrice['whereDeliver'];

/** Holat. `since` — taklif (BE-13): «Tanaffusdasiz · 6 daqiqa» («14:31 dan»). */
export type OperatorStateInfo = Schemas['OperatorStateDto'] & { since?: string | null };

/**
 * «Mahsulot ma'lumoti» paneli (operator-mahsulot). Backendda hali yo'q — taklif:
 * `GET /operator/leads/{id}/product` (BE-13 / OPT-2), docs/api-taklif/fe-08-operator.md.
 * Narx — lid sahifasidagi narx; qoldiq — omborda sotuvga bor dona.
 */
export interface LeadProductInfo {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  description: string | null;
  highlights: string[];
  available: number;
  weightKg: number | null;
  contents: string | null;
  salePrice: number;
  deliveryFee: { CENTER: number; ADDRESS: number };
  /** Mijoz ko'rgan sotuvchi sahifasi. */
  pageUrl: string | null;
  /** BAD, kosmetika va h.k. — operator aytishi shart bo'lgan ogohlantirish (TZ 7, 8). */
  warning: string | null;
}
