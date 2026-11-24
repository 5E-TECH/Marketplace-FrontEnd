import { addDays } from '../../../shared/lib/tashkentTime';
import { missingAddressFields, type AddressValue } from '../../address/lib/addressValue';
import { tashkentParts } from './leadRules';

/**
 * Buyurtma formasi qoidalari (FE-09, operator-buyurtma-formasi). Summa — faqat serverdan; bu yerda faqat
 * ko'rsatish va tasdiqlashni yopish sabablari.
 */

/** OMB-4: 14:00 gacha tasdiqlangan buyurtma o'sha kuni jo'natiladi, keyin — ertasi kuni [taklif: formada ko'rsatish]. */
export const SHIP_CUTOFF = '14:00';

export function shipDay(now: number): { date: string; today: boolean } {
  const { date, time } = tashkentParts(now);
  return time < SHIP_CUTOFF ? { date, today: true } : { date: addDays(date, 1), today: false };
}

/** Summa holati: server hisobladi, hisoblanmoqda yoki hisoblanmadi (mijozga summa aytilmaydi). */
export type QuoteState = 'ready' | 'pending' | 'failed';

/** «Buyurtmani tasdiqlash» nega yopiq — tugma ostidagi sabab (desktop 2, 3, 14-kadrlar; planshet 23, 25). */
export type OrderBlock = 'district' | 'address' | 'stock' | 'outOfStock' | 'quote';

export function orderBlock({ address, quantity, available, quote }: {
  address: AddressValue;
  quantity: number;
  /** Omborda sotuvga bor dona; noma'lum (ombor javob bermadi) — tekshirilmaydi, server hal qiladi. */
  available: number | null | undefined;
  quote: QuoteState;
}): OrderBlock | null {
  const missing = missingAddressFields(address, true);
  if (missing.includes('district') && !missing.includes('region')) return 'district';
  if (missing.length) return 'address';
  if (available === 0) return 'outOfStock';
  if (available != null && quantity > available) return 'stock';
  if (quote !== 'ready') return 'quote';
  return null;
}

/** «0.3 kg», «11.2 kg» — gramm bir kasr belgisigacha. */
export const kgLabel = (grams: number) => `${Math.round(grams / 100) / 10} kg`;
