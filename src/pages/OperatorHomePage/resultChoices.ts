import type { LeadCard } from '../../features/operator/model/operatorTypes';
import type { TranslationKey } from '../../shared/i18n/translations';

/** Natija plitkalari va Alt + raqam (operator-natija). 2 — javobsiz qo'ng'iroqlar guruhi. */
export type ResultChoice = 'CONFIRMED' | 'NO_ANSWER' | 'CALL_LATER' | 'THINKING' | 'REJECTED' | 'INVALID' | 'DUPLICATE';
/** Oynada saqlanadigan natijalar; «Buyurtma tasdiqlandi» va javobsiz — o'ng panelda. */
export type DialogChoice = Exclude<ResultChoice, 'CONFIRMED' | 'NO_ANSWER'>;
export type NoAnswerOutcome = 'NO_ANSWER' | 'BUSY' | 'PHONE_OFF';

export const RESULT_TILES: ReadonlyArray<{ choice: ResultChoice; key: number }> = [
  { choice: 'CONFIRMED', key: 1 },
  { choice: 'CALL_LATER', key: 3 },
  { choice: 'THINKING', key: 4 },
  { choice: 'REJECTED', key: 5 },
  { choice: 'INVALID', key: 6 },
  { choice: 'DUPLICATE', key: 7 },
  { choice: 'NO_ANSWER', key: 2 },
];

/** «Buyurtma tasdiqlandi» faqat qoldiq va manzil bo'lsa (API lidida manzil keyin — FE-09). */
export function confirmBlocked(card: LeadCard): TranslationKey | null {
  if (card.stockShortage) return 'opw.stockClosed';
  if (!card.address) return 'opw.addressMissing';
  return null;
}

