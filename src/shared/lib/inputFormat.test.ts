import { describe, expect, it } from 'vitest';
import { STATUS_FAMILIES, statusKey } from '../ui/StatusBadge/statusConfig';
import { dotsToIso, isoToDots, maskDateInput, monthGrid, timeSlots } from '../ui/DateInput/dateInput';
import { statusTranslations } from '../i18n/statusTranslations';
import { caretAfterDigits, digitsBeforeCaret } from './caret';
import { groupMoneyDigits, parseMoneyInput } from './money';
import { formatLocalPhone, getUzLocalPhone, isUzMobileNumber } from './phone';

describe('telefon (komponentlar-E §19, FE-03 TC1)', () => {
  it('prefiksni tashlaydi va 2-3-2-2 guruhlaydi', () => {
    expect(getUzLocalPhone('+998 (90) 123-45-67')).toBe('901234567');
    expect(getUzLocalPhone('8 90 123 45 67')).toBe('901234567');
    expect(formatLocalPhone('9012345')).toBe('90 123 45');
    expect(formatLocalPhone('901234567')).toBe('90 123 45 67');
  });

  it('O‘zbekiston mobil operatori kodini tekshiradi', () => {
    expect(isUzMobileNumber('901234567')).toBe(true);
    expect(isUzMobileNumber('131234567')).toBe(false);
    expect(isUzMobileNumber('90123456')).toBe(false);
  });
});

describe('pul (§21, FE-03 TC3)', () => {
  it('250000 → «250 000» (bo‘linmas bo‘shliq)', () => {
    expect(groupMoneyDigits('250000')).toBe('250 000');
    expect(groupMoneyDigits('1250000')).toBe('1 250 000');
  });

  it('yozilgan matndan butun so‘m', () => {
    expect(parseMoneyInput('250 000 so‘m')).toBe(250000);
    expect(parseMoneyInput('007')).toBe(7);
    expect(parseMoneyInput('')).toBeNull();
  });

  it('qayta guruhlashda kursor o‘sha raqam yonida qoladi', () => {
    expect(digitsBeforeCaret('250 000', 5)).toBe(4);
    expect(caretAfterDigits('2 500 000', 4)).toBe(5);
    expect(caretAfterDigits('90 123', 0)).toBe(0);
  });
});

describe('sana va vaqt (§21)', () => {
  it('niqob va ISO o‘tkazish, mavjud bo‘lmagan sana — null', () => {
    expect(maskDateInput('15012027')).toBe('15.01.2027');
    expect(dotsToIso('15.01.2027')).toBe('2027-01-15');
    expect(dotsToIso('31.02.2027')).toBeNull();
    expect(isoToDots('2027-01-15')).toBe('15.01.2027');
  });

  it('oy jadvali dushanbadan, vaqtlar qadam bilan', () => {
    const grid = monthGrid(2027, 0);
    expect(grid.length % 7).toBe(0);
    expect(grid.indexOf('2027-01-01')).toBe(4); // 01.01.2027 — juma
    expect(timeSlots(15, '09:00', '10:00')).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00']);
  });
});

describe('holat belgilari (§1, §2, §33)', () => {
  it('har holatning uch tilda nomi bor', () => {
    for (const [family, codes] of Object.entries(STATUS_FAMILIES)) {
      for (const code of Object.keys(codes)) {
        const key = statusKey(family as keyof typeof STATUS_FAMILIES, code as never);
        for (const language of ['uz', 'ru', 'en'] as const) {
          expect(statusTranslations[language][key as keyof (typeof statusTranslations)['uz']], `${language} ${key}`).toBeTruthy();
        }
      }
    }
  });
});
