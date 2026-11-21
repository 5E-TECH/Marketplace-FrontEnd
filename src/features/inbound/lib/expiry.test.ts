import { describe, expect, it } from 'vitest';
import { daysLeft, isSellableExpiry, saleCutoff, saleUntil } from './expiry';

describe('yaroqlilik muddati (OMB-3)', () => {
  const today = '2027-01-14';

  it('bugungi chegara — bugun + 60 kun', () => {
    expect(saleCutoff(today)).toBe('2027-03-15');
  });

  it('50 kun qolgan partiya sotuvga chiqmaydi, 60 kun — chiqadi (TC4)', () => {
    expect(daysLeft('2027-03-05', today)).toBe(50);
    expect(isSellableExpiry('2027-03-05', today)).toBe(false);
    expect(isSellableExpiry('2027-03-15', today)).toBe(true);
    expect(daysLeft('2027-09-30', today)).toBe(259);
  });

  it('sotuvdan chiqish kuni — muddat − 60 kun', () => {
    expect(saleUntil('2027-09-30')).toBe('2027-08-01');
    expect(saleUntil('2027-03-05')).toBe('2027-01-04');
  });
});
