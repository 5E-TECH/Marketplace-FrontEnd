import { describe, expect, it } from 'vitest';
import { calculatePrice, evaluatePrice, marketCheck, maxSalePriceFor, modesView, recommendedAffiliateFee } from './pricingCalculator';

/** Mock kalkulyator backend BE-09 bilan bir xil sonlarni berishi kerak (TZ 2.1–2.6, admin-narx dizayni). */
const params = {
  kSale70: 29_688, kSale100: 15_232, targetMargin: 9_000, taxRate: 0.04, paymentRate: 0.0185, callCenterFee: 12_000, affiliateCoef: 1.29,
  adCost: 50_420, markupCapPercent: 10, deliveryMode: 'PARTIAL' as const, visibleCenter: 30_000, visibleAddress: 50_000,
};
const tariff = { centerBase: 40_000, baseWeightGrams: 3_000, perExtraKg: 4_000, addressExtra: 20_000 };
const input = { basePrice: 140_000, affiliateFee: 65_000, weightGrams: 300 };

describe('mock narx kalkulyatori (BE-09 nusxasi)', () => {
  it('tavsiya, zararsizlik, qat’iy chegara va holat chegaralari', () => {
    expect(recommendedAffiliateFee(params)).toBe(65_000);
    expect(calculatePrice(params, tariff, input)).toMatchObject({
      recommendedBase: 251_000, recommendedBaseExact: 250_120, breakevenBase: 240_561, hardFloorBase: 225_206,
      recommended: 262_000, yellowFrom: 251_183, orangeFrom: 235_828, platformSharePercent: 18.3,
      delivery: { tariffCenter: 40_000, tariffAddress: 60_000, visibleCenter: 30_000, visibleAddress: 50_000, hidden: 10_000, hiddenPriceAdd: 11_000 },
    });
  });

  it('TC1–TC3: qizil 230 000, to‘q sariq 245 000 (zararsiz haq 58 936), sariq 255 000, yashil 262 000', () => {
    const calc = calculatePrice(params, tariff, input);
    expect(evaluatePrice(params, calc, 230_000)).toMatchObject({ status: 'RED', platformResult70: -19_943, safeAffiliateFee: null, maxAffiliateFee: 44_226 });
    expect(evaluatePrice(params, calc, 245_000)).toMatchObject({ status: 'ORANGE', platformResult70: -5_821, safeAffiliateFee: 58_936 });
    expect(evaluatePrice(params, calc, 255_000)).toMatchObject({ status: 'YELLOW', platformResult70: 3_594, belowRecommended: 7_000 });
    expect(evaluatePrice(params, calc, 262_000)).toMatchObject({
      status: 'GREEN', platformResult70: 10_185, platformResult100: 24_641, affiliateResult: 14_580,
      split: { wholesaler: 140_000, affiliate: 65_000, callCenter: 12_000, platformService: 34_000, hiddenDelivery: 11_000 },
    });
    // Zararsiz haq bilan to'q sariq narx sariqqa o'tadi.
    expect(evaluatePrice(params, calculatePrice(params, tariff, { ...input, affiliateFee: 58_936 }), 245_000).status).toBe('YELLOW');
    expect(maxSalePriceFor(params, 262_000, calc.delivery)).toBe(287_000);
  });

  it('TC4 (NRX-5): bozor narxi 299 000 — mos, 285 000 — qimmat; uch rejim', () => {
    const calc = calculatePrice(params, tariff, input);
    expect(marketCheck(params, calc, 299_000)).toEqual({ ourTotal: 292_000, competitorTotal: 299_000, verdict: 'MOS', maxBasePrice: 148_099 });
    expect(marketCheck(params, calc, 285_000)).toEqual({ ourTotal: 292_000, competitorTotal: 285_000, verdict: 'QIMMAT', maxBasePrice: 134_369 });
    expect(modesView(params, tariff, input).map((row) => [row.mode, row.customerTotal, row.platformResult70])).toEqual([
      ['SEPARATE', 291_000, 9_828], ['PARTIAL', 292_000, 10_185], ['FREE', 294_000, 10_313],
    ]);
  });
});
