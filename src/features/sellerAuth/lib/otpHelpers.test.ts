import { describe, expect, it } from 'vitest';
import { formatUzPhone, isUzMobileNumber } from '../../../shared/lib/phone';
import { normalizeOtpCode, otpCodeDigits } from './fieldRules';
import { formatCountdown } from './useCountdown';

describe('SMS kod yordamchilari (FE-04)', () => {
  it('kod 6 raqam, «305 918» ko‘rinishida; harf va ortig‘i tashlanadi', () => {
    expect(normalizeOtpCode('305918')).toBe('305 918');
    expect(normalizeOtpCode('30 59-18 77')).toBe('305 918');
    expect(normalizeOtpCode('12a')).toBe('12');
    expect(normalizeOtpCode(undefined)).toBe('');
    expect(otpCodeDigits('305 918')).toBe('305918');
  });

  it('taymer «04:12», manfiy va kasr soniyalar to‘g‘ri', () => {
    expect(formatCountdown(252)).toBe('04:12');
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(0.4)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
  });

  it('O‘zbekiston mobil operatori va «+998 97 315 22 86» ko‘rinishi', () => {
    expect(isUzMobileNumber('973152286')).toBe(true);
    expect(isUzMobileNumber('333152286')).toBe(true);
    expect(isUzMobileNumber('803152286')).toBe(false);
    expect(isUzMobileNumber('97315228')).toBe(false);
    expect(formatUzPhone('+998973152286')).toBe('+998 97 315 22 86');
    expect(formatUzPhone('973152286')).toBe('+998 97 315 22 86');
  });
});
