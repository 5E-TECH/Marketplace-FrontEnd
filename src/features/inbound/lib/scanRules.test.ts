import { describe, expect, it } from 'vitest';
import { DUPLICATE_WINDOW_MS, isDuplicateRead, normalizeBarcode, shipmentTally } from './scanRules';

describe('skan qoidalari', () => {
  it('bir xil kod oraliq ichida — takror (TC3), oraliqdan keyin — yangi skan', () => {
    const first = { code: '4780012345677', at: 1_000 };
    expect(isDuplicateRead(null, first)).toBe(false);
    expect(isDuplicateRead(first, { code: '4780012345677', at: 1_000 + 120 })).toBe(true);
    expect(isDuplicateRead(first, { code: '4780012345677', at: 1_000 + DUPLICATE_WINDOW_MS })).toBe(false);
    expect(isDuplicateRead(first, { code: '4780012345684', at: 1_050 })).toBe(false);
  });

  it('kod bo‘sh joysiz', () => {
    expect(normalizeBarcode(' 4780012345677\n')).toBe('4780012345677');
  });

  it('sanoq: farq = qabul − e’lon; kam va ortiq', () => {
    expect(shipmentTally({ declared: 100, accepted: 98, defect: 2 })).toEqual({ counted: 100, diff: -2, shortage: 0, surplus: 0 });
    expect(shipmentTally({ declared: 100, accepted: 97, defect: 2 })).toEqual({ counted: 99, diff: -3, shortage: 1, surplus: 0 });
    expect(shipmentTally({ declared: 100, accepted: 99, defect: 2 })).toEqual({ counted: 101, diff: -1, shortage: 0, surplus: 1 });
  });
});
