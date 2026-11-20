import type { components } from '../../../generated/api-types';

type Schemas = components['schemas'];

/**
 * Offer (BE-25 `AffiliateOfferDto`) va taklif qilingan maydonlar — backendda hali yo'q,
 * shakli `docs/api-taklif/fe-05-sotuvchi-offer.md` da. Kelmasa — karta ularsiz chiziladi.
 */
export type AffiliateOffer = Schemas['AffiliateOfferDto'] & {
  /** Kartada mahsulot nomi ostida («Elektronika»). */
  categoryName?: string | null;
  /** Markazgacha yetkazish («+ yetkazish 30 000 so‘m»); bepul rejimda 0. */
  centerDeliveryFee?: number | null;
};

export type AffiliateStream = Schemas['AffiliateStreamDto'];
export type StreamTemplate = AffiliateStream['template'];
export type OfferSort = 'NEWEST' | 'FEE' | 'EPC' | 'APPROVE_RATE';

/** Yetkazish rejimi (TZ 2.4): alohida, qisman (sukut) yoki bepul — admin har mahsulotga tanlaydi. */
export type DeliveryMode = 'SEPARATE' | 'PARTIAL' | 'FREE';
/** Offer holati: ochiq, qoldiq 0, admin to'xtatgan, yaroqlilik muddati 60 kundan kam (OMB-3). */
export type OfferState = 'OPEN' | 'OUT_OF_STOCK' | 'STOPPED' | 'SHORT_EXPIRY';

export interface OfferCreative {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  /** «asosiy», «g‘ilofda», «qutida»… — admin yozgan qisqa izoh. */
  caption: string | null;
  /** Video hali tayyorlanmoqda (ko'rish va yuklab olish yopiq). */
  processing: boolean;
  approvedAt: string;
}

/** Hamma sotuvchilar bo'yicha, sotuvga chiqqandan beri. */
export interface OfferResults {
  clicks: number;
  leads: number;
  validLeads: number;
  confirmed: number;
  delivered: number;
  refused: number;
  /** Sotuvchilar haqi yig'indisi — EPC surati. */
  revenue: number;
}

/** «Narx qanday bo'linadi» — tavsiya narxning taqsimoti. */
export interface OfferPriceSplit {
  recommended: number;
  wholesale: number;
  affiliateFee: number;
  callCenter: number;
  platform: number;
  /** Qisman rejim: yetkazishning tovar narxiga qo'shilgan qismi. */
  deliveryInPrice: number;
}

export interface AffiliateOfferDetail extends Omit<AffiliateOffer, 'creatives'> {
  categoryName: string | null;
  subtitle: string | null;
  description: string | null;
  boxContents: string | null;
  weightKg: number | null;
  deliveryMode: DeliveryMode;
  centerDeliveryFee: number;
  /** Eshikkacha; `null` — bu rejimda narx hali belgilanmagan. */
  addressDeliveryFee: number | null;
  isBad: boolean;
  state: OfferState;
  stoppedAt: string | null;
  stopReason: string | null;
  onSaleSince: string;
  results: OfferResults | null;
  priceSplit: OfferPriceSplit | null;
  creatives: OfferCreative[];
}
