import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { PricingParams, ProductPricing } from '../model/adminProductTypes';

/**
 * Narx kalkulyatori ekrani (FE-13, admin-narx) uchun ko'rsatish yordamchilari. Hisob serverda (BE-09) — bu yerda
 * faqat server qiymatlarini matnga va shkala geometriyasiga aylantirish: koeffitsient yozuvi (0.96), ulush (55.8%),
 * shkala bo'laklari va belgi o'rni.
 */

/** «0.96», «0.9415» — ortiqcha nollarsiz. */
export const rateLabel = (value: number) => String(Number(value.toFixed(4)));

/** «4», «1.85» — foiz. */
export const percentLabel = (rate: number) => String(Number((rate * 100).toFixed(2)));

/** Manfiy summa — tipografik minus bilan: «−5 821». */
export const signedMoney = (value: number) => (value < 0 ? `−${formatMoney(-value)}` : formatMoney(value));

/** Ulush tovar narxidan: «55.8%». */
export const shareLabel = (part: number, total: number) => (total > 0 ? `${(Math.round((part / total) * 1000) / 10).toFixed(1)}%` : '—');

/** Formulalardagi koeffitsientlar: 1 − soliq (0.96), 1 − soliq − to'lov (0.9415), to'lov foizi (1.85). */
export function coefficients(params: Pick<PricingParams, 'taxRate' | 'paymentRate'>) {
  return {
    at: rateLabel(1 - params.taxRate),
    net: rateLabel(1 - params.taxRate - params.paymentRate),
    tax: rateLabel(params.taxRate),
    pay: rateLabel(params.paymentRate),
    taxPct: percentLabel(params.taxRate),
    payPct: percentLabel(params.paymentRate),
  };
}

export interface PriceScale {
  /** Bo'laklar kengligi, %: qizil va yashil — 16, o'rtasi chegaralar orasidagi so'mga mutanosib. */
  red: number;
  orange: number;
  yellow: number;
  green: number;
  /** Sariq chegarasi va belgining o'rni, %. */
  yellowAt: number;
  marker: number;
  /** Mayda chiziqlar (yaxlit summalar) o'rni, %. */
  ticks: number[];
}

const EDGE = 16;
const STEPS = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000];

/**
 * Shkala (admin-narx «Shkala»): to'q sariq va sariq oralig'i 68% ni so'mga mutanosib egallaydi, qizil va yashil —
 * 16% dan, xuddi shu masshtabda. Belgi narx o'rnida, chetdan chiqmaydi. Chiziqlar — 6 tadan oshmaydigan yaxlit qadam.
 */
export function priceScale(calculation: Pick<ProductPricing['calculation'], 'orangeFrom' | 'yellowFrom' | 'recommended'>, price: number): PriceScale {
  const { orangeFrom, recommended } = calculation;
  const span = Math.max(1, recommended - orangeFrom);
  const yellowFrom = Math.min(Math.max(calculation.yellowFrom, orangeFrom), recommended);
  const total = span / ((100 - 2 * EDGE) / 100);
  const start = orangeFrom - (EDGE / 100) * total;
  const at = (value: number) => Math.min(100, Math.max(0, ((value - start) / total) * 100));
  const step = STEPS.find((candidate) => span / candidate <= 6) ?? STEPS[STEPS.length - 1];
  const ticks: number[] = [];
  for (let value = Math.ceil((orangeFrom + 1) / step) * step; value < recommended; value += step) ticks.push(at(value));
  const orange = ((yellowFrom - orangeFrom) / total) * 100;
  return {
    red: EDGE,
    orange,
    yellow: 100 - 2 * EDGE - orange,
    green: EDGE,
    yellowAt: at(yellowFrom),
    marker: at(price),
    ticks,
  };
}

/** «Belgi» yorlig'i chetga yaqin bo'lsa ichkariga suriladi (kesilmasin). */
export const markerAlign = (marker: number): 'start' | 'center' | 'end' => (marker < 6 ? 'start' : marker > 94 ? 'end' : 'center');
