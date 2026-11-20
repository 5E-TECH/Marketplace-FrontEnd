import type { OfferSort } from '../../../features/affiliate/api/offersApi';

/** Saralash tartibi «Saralash: …» ro'yxatida; sukut — EPC (sotuvchi-offerlar). */
export const OFFER_SORTS = ['EPC', 'FEE', 'APPROVE_RATE', 'NEWEST'] as const satisfies readonly OfferSort[];
export const DEFAULT_SORT: OfferSort = 'EPC';

export const parseSort = (value: string | null): OfferSort =>
  (OFFER_SORTS as readonly string[]).includes(value ?? '') ? (value as OfferSort) : DEFAULT_SORT;

/** «Tasdiq ≥ 50%» chegarasi (FE-05 TC5). */
export const APPROVE_THRESHOLD = 50;

export type OffersView = 'cards' | 'table';

const VIEW_KEY = 'affiliate.offers.view';

/** «Ko‘rinish» tanlovi eslab qolinadi [taklif] — faqat shu brauzerda; saqlab bo'lmasa sukut «Kartalar». */
export function readStoredView(): OffersView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

export function storeView(view: OffersView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Brauzer saqlashga ruxsat bermasa — faqat shu ochilishda.
  }
}
