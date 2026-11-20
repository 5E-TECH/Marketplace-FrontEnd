import { describe, expect, it } from 'vitest';
import { chartTicks } from './chartScale';

describe('chartTicks', () => {
  it('ustunli grafikda maksimum eng katta qiymatdan bir qadam yuqori', () => {
    expect(chartTicks(10)).toEqual([0, 4, 8, 12]);
    expect(chartTicks(12)).toEqual([0, 4, 8, 12, 16]);
    expect(chartTicks(281_250)).toEqual([0, 100_000, 200_000, 300_000]);
  });

  it('chiziqli grafikda yuqoriga yaxlitlanadi', () => {
    expect(chartTicks(120, false)).toEqual([0, 40, 80, 120]);
  });

  it('kichik va bo‘sh qiymatlarda qadam butun', () => {
    expect(chartTicks(0)).toEqual([0, 1]);
    expect(chartTicks(2)).toEqual([0, 1, 2, 3]);
    expect(chartTicks(5)).toEqual([0, 2, 4, 6]);
  });
});
