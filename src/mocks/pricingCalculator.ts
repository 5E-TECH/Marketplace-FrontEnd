import type { DeliveryMode, PriceStatus } from '../features/adminProducts/model/adminProductTypes';

/**
 * Narx kalkulyatori (BE-09) — backend `libs/common/src/pricing/price-calculator.ts` ning mock nusxasi: aniq butun
 * arifmetika (pul — tiyin, foiz — bazis punkt), shuning uchun TZ namunalari (262 000, 235 828, 58 936) bir xil chiqadi.
 * Faqat mock ishlatadi — frontend hisoblamaydi (FE-13: «Hisob faqat serverda»).
 */
export interface PricingParams {
  kSale70: number;
  kSale100: number;
  targetMargin: number;
  taxRate: number;
  paymentRate: number;
  callCenterFee: number;
  affiliateCoef: number;
  adCost: number;
  markupCapPercent: number;
  deliveryMode: DeliveryMode;
  visibleCenter: number;
  visibleAddress: number;
}

export interface ElchiTariff {
  centerBase: number;
  baseWeightGrams: number;
  perExtraKg: number;
  addressExtra: number;
}

const BP = 10_000n;
const T = 100n;
const bp = (rate: number) => BigInt(Math.round(rate * 10_000));
const tiyin = (value: number) => BigInt(Math.round(value * 100));
const big = (value: number) => BigInt(Math.round(value));
const ceilDiv = (a: bigint, b: bigint) => (a >= 0n ? (a + b - 1n) / b : -(-a / b));
const floorDiv = (a: bigint, b: bigint) => (a >= 0n ? a / b : -((-a + b - 1n) / b));
const num = (value: bigint) => Number(value);

interface Exact { net: bigint; at: bigint; pay: bigint; k70: bigint; k100: bigint; m: bigint }
const exact = (p: PricingParams): Exact => ({
  net: BP - bp(p.taxRate) - bp(p.paymentRate),
  at: BP - bp(p.taxRate),
  pay: bp(p.paymentRate),
  k70: tiyin(p.kSale70),
  k100: tiyin(p.kSale100),
  m: tiyin(p.targetMargin),
});

export function elchiTariffFor(tariff: ElchiTariff, weightGrams: number, address: boolean): number {
  const extraKg = Math.max(0, Math.ceil((weightGrams - tariff.baseWeightGrams) / 1000));
  return tariff.centerBase + extraKg * tariff.perExtraKg + (address ? tariff.addressExtra : 0);
}

export interface DeliveryView {
  tariffCenter: number;
  tariffAddress: number;
  visibleCenter: number;
  visibleAddress: number;
  hidden: number;
  hiddenPriceAdd: number;
}

export function deliveryView(p: PricingParams, tariff: ElchiTariff, weightGrams: number): DeliveryView {
  const tariffCenter = elchiTariffFor(tariff, weightGrams, false);
  const tariffAddress = elchiTariffFor(tariff, weightGrams, true);
  let visibleCenter: number;
  let visibleAddress: number;
  if (p.deliveryMode === 'SEPARATE') {
    visibleCenter = tariffCenter;
    visibleAddress = tariffAddress;
  } else if (p.deliveryMode === 'FREE') {
    visibleCenter = 0;
    visibleAddress = 0;
  } else {
    visibleCenter = Math.min(p.visibleCenter, tariffCenter);
    visibleAddress = tariffAddress - (tariffCenter - visibleCenter);
  }
  const hidden = tariffCenter - visibleCenter;
  const e = exact(p);
  return {
    tariffCenter, tariffAddress, visibleCenter, visibleAddress, hidden,
    hiddenPriceAdd: hidden > 0 ? num(ceilDiv(big(hidden) * BP, e.net * 1000n)) * 1000 : 0,
  };
}

function resultNumerator(e: Exact, price: number, basePrice: number, affiliateFee: number, hidden: number, k: bigint): bigint {
  return e.at * (big(price) - big(basePrice) - big(affiliateFee)) * T - e.pay * big(price) * T - BP * (k + big(hidden) * T);
}

function thresholdFraction(e: Exact, basePrice: number, affiliateFee: number, k: bigint, hidden: number, margin = 0n): [bigint, bigint] {
  return [e.at * (big(basePrice) + big(affiliateFee)) * T + BP * (k + margin + big(hidden) * T), e.net * T];
}

export interface PriceCalculation {
  basePrice: number;
  affiliateFee: number;
  recommendedBase: number;
  /** Taklif: tavsiya 1 000 ga yaxlitlanmasdan (formula izohidagi «= 250 120»). */
  recommendedBaseExact: number;
  breakevenBase: number;
  hardFloorBase: number;
  delivery: DeliveryView;
  recommended: number;
  yellowFrom: number;
  orangeFrom: number;
  platformSharePercent: number;
}

export function calculatePrice(p: PricingParams, tariff: ElchiTariff, input: { basePrice: number; affiliateFee: number; weightGrams: number }): PriceCalculation {
  const { basePrice, affiliateFee } = input;
  const e = exact(p);
  const delivery = deliveryView(p, tariff, input.weightGrams);
  const [rn, rd] = thresholdFraction(e, basePrice, affiliateFee, e.k70, 0, e.m);
  const recommendedBase = num(ceilDiv(rn, rd * 1000n)) * 1000;
  const [bn, bd] = thresholdFraction(e, basePrice, affiliateFee, e.k70, 0);
  const [fn, fd] = thresholdFraction(e, basePrice, affiliateFee, e.k100, 0);
  const [yn, yd] = thresholdFraction(e, basePrice, affiliateFee, e.k70, delivery.hidden);
  const [on, od] = thresholdFraction(e, basePrice, affiliateFee, e.k100, delivery.hidden);
  return {
    basePrice,
    affiliateFee,
    recommendedBase,
    recommendedBaseExact: num(floorDiv(rn, rd)),
    breakevenBase: num(ceilDiv(bn, bd)),
    hardFloorBase: num(floorDiv(fn, fd)),
    delivery,
    recommended: recommendedBase + delivery.hiddenPriceAdd,
    yellowFrom: num(ceilDiv(yn, yd)),
    orangeFrom: num(ceilDiv(on, od)),
    platformSharePercent: Math.round(((recommendedBase - basePrice - affiliateFee) / recommendedBase) * 1000) / 10,
  };
}

export interface PriceEvaluation {
  status: PriceStatus;
  price: number;
  split: { wholesaler: number; affiliate: number; callCenter: number; platformService: number; hiddenDelivery: number };
  platformResult70: number;
  platformResult100: number;
  affiliateResult: number;
  belowRecommended: number;
  safeAffiliateFee: number | null;
  /** Taklif: platforma natijasi (70%) nol bo'ladigan eng katta haq — reklama xarajatidan kam bo'lsa ham (qizil holat izohi). */
  maxAffiliateFee: number | null;
}

export function evaluatePrice(p: PricingParams, calc: PriceCalculation, price: number): PriceEvaluation {
  const e = exact(p);
  const { basePrice, affiliateFee } = calc;
  const hidden = calc.delivery.hidden;
  const r70 = resultNumerator(e, price, basePrice, affiliateFee, hidden, e.k70);
  const r100 = resultNumerator(e, price, basePrice, affiliateFee, hidden, e.k100);
  const affiliateResult = affiliateFee - p.adCost;
  let status: PriceStatus;
  if (r100 < 0n) status = 'RED';
  else if (affiliateResult < 0) status = 'ORANGE';
  else if (price >= calc.recommended) status = 'GREEN';
  else if (r70 >= 0n) status = 'YELLOW';
  else status = 'ORANGE';

  let safeAffiliateFee: number | null = null;
  let maxAffiliateFee: number | null = null;
  if (status === 'ORANGE' || status === 'RED') {
    const max = num(floorDiv(e.at * (big(price) - big(basePrice)) * T - e.pay * big(price) * T - BP * (e.k70 + big(hidden) * T), e.at * T));
    maxAffiliateFee = max;
    safeAffiliateFee = max >= p.adCost ? max : null;
  }
  const hiddenDelivery = calc.delivery.hiddenPriceAdd;
  return {
    status,
    price,
    split: {
      wholesaler: basePrice,
      affiliate: affiliateFee,
      callCenter: p.callCenterFee,
      platformService: price - basePrice - affiliateFee - p.callCenterFee - hiddenDelivery,
      hiddenDelivery,
    },
    platformResult70: num(floorDiv(r70, BP * T)),
    platformResult100: num(floorDiv(r100, BP * T)),
    affiliateResult,
    belowRecommended: Math.max(0, calc.recommended - price),
    safeAffiliateFee,
    maxAffiliateFee,
  };
}

export function maxSalePriceFor(p: PricingParams, approvedPrice: number, delivery: DeliveryView, marketTotal?: number | null): number {
  const goods = big(approvedPrice - delivery.hiddenPriceAdd);
  const capBp = bp(p.markupCapPercent / 100);
  let max = num(floorDiv(big(approvedPrice) * BP + goods * capBp, BP * 1000n) * 1000n);
  if (marketTotal != null) max = Math.min(max, marketTotal - delivery.visibleCenter);
  return Math.max(max, approvedPrice);
}

export interface MarketCheck {
  ourTotal: number;
  competitorTotal: number;
  verdict: 'MOS' | 'QIMMAT';
  maxBasePrice: number | null;
}

export function marketCheck(p: PricingParams, calc: PriceCalculation, competitorTotal: number): MarketCheck {
  const e = exact(p);
  const ourTotal = calc.recommended + calc.delivery.visibleCenter;
  const maxBase = num(floorDiv(
    e.net * big(competitorTotal - calc.delivery.visibleCenter) * T - BP * (e.k70 + e.m + big(calc.delivery.hidden) * T) - e.at * big(calc.affiliateFee) * T,
    e.at * T,
  ));
  return { ourTotal, competitorTotal, verdict: ourTotal <= competitorTotal ? 'MOS' : 'QIMMAT', maxBasePrice: maxBase >= 0 ? maxBase : null };
}

export const recommendedAffiliateFee = (p: PricingParams) => Math.round((p.adCost * p.affiliateCoef) / 1000) * 1000;

/** Taklif: uch rejim solishtiruvi (admin-narx «Rejim · mijoz ko'radi») — har rejimda tavsiya narx va natija. */
export function modesView(p: PricingParams, tariff: ElchiTariff, input: { basePrice: number; affiliateFee: number; weightGrams: number }) {
  return (['SEPARATE', 'PARTIAL', 'FREE'] as const).map((mode) => {
    const params = { ...p, deliveryMode: mode };
    const calc = calculatePrice(params, tariff, input);
    const evaluation = evaluatePrice(params, calc, calc.recommended);
    return {
      mode,
      goodsPrice: calc.recommended,
      delivery: calc.delivery.visibleCenter,
      customerTotal: calc.recommended + calc.delivery.visibleCenter,
      platformResult70: evaluation.platformResult70,
      platformResult100: evaluation.platformResult100,
    };
  });
}
