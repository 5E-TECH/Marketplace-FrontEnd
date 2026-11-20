import { describe, expect, it } from 'vitest';
import { creativeCounts, feeAt, markupLimitPercent, percentOf, priceIssue } from './offerMath';

const offer = { approvedPrice: 262_000, maxSalePrice: 287_000, affiliateFee: 65_000 };

describe('offerMath', () => {
  it('haq: sotuvchi haqi + ustamaning 85% i, pastga yaxlitlab (sotuvchi-sahifa-sozlash)', () => {
    expect(feeAt(offer, 262_000)).toBe(65_000);
    expect(feeAt(offer, 287_000)).toBe(86_250);
    expect(feeAt(offer, 275_000)).toBe(76_050);
    expect(feeAt(offer, 262_001)).toBe(65_000);
  });

  it('narx chegarasi: tasdiqlangandan past va maxSalePrice dan yuqori — xato (FE-05 TC4)', () => {
    expect(priceIssue(offer, 255_000)).toBe('below');
    expect(priceIssue(offer, 262_000)).toBeNull();
    expect(priceIssue(offer, 287_000)).toBeNull();
    expect(priceIssue(offer, 290_000)).toBe('above');
    expect(priceIssue({ approvedPrice: 251_000, maxSalePrice: 276_000 }, 277_000)).toBe('above');
    expect(priceIssue(offer, Number.NaN)).toBe('below');
  });

  it('ustama chegarasi foizda', () => {
    expect(markupLimitPercent(offer)).toBe(10);
    expect(markupLimitPercent({ approvedPrice: 251_000, maxSalePrice: 276_000 })).toBe(10);
  });

  it('kreativlar soni va foiz', () => {
    expect(creativeCounts([{ type: 'VIDEO' }, { type: 'IMAGE' }, { type: 'IMAGE' }])).toEqual({ videos: 1, images: 2 });
    expect(percentOf(102, 204)).toBe(50);
    expect(percentOf(1, 0)).toBeNull();
  });
});
