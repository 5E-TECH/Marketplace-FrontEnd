import type { components } from '../../../generated/api-types';

type Schemas = components['schemas'];

export type WhereDeliver = Schemas['LeadPriceDto']['whereDeliver'];
/** Yetkazishni ko'rsatish rejimi (TZ 2.4): alohida, qisman, bepul — admin mahsulot bo'yicha tanlaydi. */
export type DeliveryMode = NonNullable<Schemas['PricePolicyDto']['deliveryMode']>;

/**
 * Narx obyekti (BE-09 / BE-13). Taklif maydonlari (FE-09, docs/api-taklif/fe-09-operator-buyurtma.md) —
 * kelmasa ekran ularsiz ishlaydi: rejim belgisi, ikki yetkazish narxi, og'irlik izohi va oldindan to'lov.
 */
export type LeadPrice = Schemas['LeadPriceDto'] & {
  deliveryMode?: DeliveryMode | null;
  /** Posilkaning jami og'irligi (dona × og'irlik), gramm. */
  weightGrams?: number | null;
  /** Shu miqdor uchun ikkala yetkazish turi — «Markazgacha 30 000 · eshikkacha 50 000». */
  deliveryOptions?: Record<WhereDeliver, number> | null;
  /** `deliveryFee = base + extraKg × perExtraKg` — «40 000 + 3 × 4 000»; bepulda null. */
  deliveryFormula?: { base: number; extraKg: number; perExtraKg: number; baseWeightGrams: number } | null;
  /** Qora ro'yxatdagi mijoz: yetkazish puli oldindan (TZ 7). */
  prepayment?: { amount: number; method: string } | null;
};

/** Operator tuzatgan manzil maydoni: eski va yangi qiymat (nomi bilan; yetkazish — `CENTER`/`ADDRESS`). BE-25 `LeadHistoryChangeDto`. */
export type LeadAddressChange = Schemas['LeadHistoryChangeDto'];

/**
 * Lid tarixi yozuvi (BE-25): `changes` — manzil saqlanganda o'zgargan maydonlar; bo'sh ro'yxat — manzil o'zgarishsiz
 * tasdiqlangan (yozuv ko'rsatilmaydi), manzilga aloqasi yo'q yozuvda `null`.
 */
export type LeadHistoryEntry = Schemas['LeadHistoryEntryDto'];

export type LeadCard = Omit<Schemas['LeadCardDto'], 'price' | 'history'> & {
  price: LeadPrice | null;
  history: LeadHistoryEntry[];
};
export type LeadAddress = NonNullable<LeadCard['address']>;
export type LeadStatus = LeadCard['status'];
export type LeadOutcome = Schemas['SubmitLeadResultDto']['outcome'];
export type LeadRejectReason = NonNullable<Schemas['SubmitLeadResultDto']['rejectReason']>;
export type LeadResultInput = Schemas['SubmitLeadResultDto'];
/** `stockAvailable` — taklif: band qilingandan keyin omborda qolgan dona («band qilindi: mavjud 119»). */
export type LeadResultAccepted = Schemas['LeadResultAcceptedDto'] & { stockAvailable?: number | null };
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
  /** Omborda sotuvga bor (band qilinmagan) dona; null — ombor javob bermadi. */
  available: number | null;
  weightKg: number | null;
  contents: string | null;
  salePrice: number;
  /** 1 dona uchun ikki yetkazish turi; katalog javob bermasa null. */
  deliveryFee: { CENTER: number; ADDRESS: number } | null;
  /** Mijoz ko'rgan sotuvchi sahifasi. */
  pageUrl: string | null;
  /** BAD, kosmetika va h.k. — operator aytishi shart bo'lgan ogohlantirish (TZ 7, 8). */
  warning: string | null;
}
