import { describe, expect, it } from 'vitest';
import { coefficients, markerAlign, percentLabel, priceScale, rateLabel, shareLabel, signedMoney } from './pricingView';

// TZ 2.3 namunasi (admin-narx): optovik 140 000, haq 65 000, 0.3 kg, qisman rejim.
const calc = { orangeFrom: 235_828, yellowFrom: 251_183, recommended: 262_000 };

describe('narx ekrani: yozuvlar', () => {
  it('koeffitsientlar va ulushlar — ortiqcha nollarsiz', () => {
    expect(coefficients({ taxRate: 0.04, paymentRate: 0.0185 })).toEqual({ at: '0.96', net: '0.9415', tax: '0.04', pay: '0.0185', taxPct: '4', payPct: '1.85' });
    expect([rateLabel(1.29), percentLabel(0.1)]).toEqual(['1.29', '10']);
    expect([shareLabel(140_000, 251_000), shareLabel(12_000, 251_000), shareLabel(1, 0)]).toEqual(['55.8%', '4.8%', '—']);
    expect([signedMoney(-5_821), signedMoney(10_185)]).toEqual(['−5 821', '10 185']);
  });
});

describe('narx shkalasi (dizayn: 16 / 39.895 / 28.105 / 16)', () => {
  it('bo‘laklar, chegaralar va yaxlit chiziqlar', () => {
    const scale = priceScale(calc, 262_000);
    expect(scale.red).toBe(16);
    expect(scale.green).toBe(16);
    expect(scale.orange).toBeCloseTo(39.895, 2);
    expect(scale.yellow).toBeCloseTo(28.105, 2);
    expect(scale.yellowAt).toBeCloseTo(55.895, 2);
    expect(scale.marker).toBeCloseTo(84, 3);
    // 240 000 … 260 000, har 5 000.
    expect(scale.ticks.map((tick) => Number(tick.toFixed(3)))).toEqual([26.84, 39.831, 52.822, 65.813, 78.804]);
  });

  it('belgi narx o‘rnida, chetdan chiqmaydi (TC1–TC3 narxlari)', () => {
    expect(priceScale(calc, 245_000).marker).toBeCloseTo(39.831, 2);
    expect(priceScale(calc, 255_000).marker).toBeCloseTo(65.813, 2);
    expect(priceScale(calc, 230_000).marker).toBeCloseTo(0.858, 2);
    expect(priceScale(calc, 100_000).marker).toBe(0);
    expect(priceScale(calc, 900_000).marker).toBe(100);
    expect([markerAlign(1), markerAlign(50), markerAlign(99)]).toEqual(['start', 'center', 'end']);
  });
});
