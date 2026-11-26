import { describe, expect, it } from 'vitest';
import { formatRecoveryInput, otpauthAccount, recoveryCodesText, secretGroups } from './twoFactorView';

describe('2FA ko‘rinish yordamchilari (FE-27)', () => {
  it('kalit to‘rtlik guruhlarda: backend 32 belgili siri 8 guruh', () => {
    expect(secretGroups('MZXW6YTBOI4DQNBR7KPAJBSWY3DPEHPK')).toEqual(['MZXW', '6YTB', 'OI4D', 'QNBR', '7KPA', 'JBSW', 'Y3DP', 'EHPK']);
    expect(secretGroups('ABCDE')).toEqual(['ABCD', 'E']);
  });

  it('ilovadagi hisob nomi otpauth yorlig‘idan: «Issuer · telefon»', () => {
    expect(otpauthAccount('otpauth://totp/Elchi%20Marketplace%3A%2B998900000006?secret=X&issuer=Elchi%20Marketplace')).toBe('Elchi Marketplace · +998 90 000 00 06');
    expect(otpauthAccount('otpauth://totp/alice?secret=X')).toBe('alice');
    expect(otpauthAccount('https://example.com')).toBe('');
  });

  it('zaxira kodlar fayli: sarlavha, hisob, sana, qoida va raqamlangan 5-5 kodlar', () => {
    const text = recoveryCodesText({ codes: ['Q2HZ7MXKD4', 'W6PN3RTYA5'], title: 'T', account: 'A', date: 'D', rule: 'R' });
    expect(text).toBe('T\nA\nD\nR\n\n1. Q2HZ7-MXKD4\n2. W6PN3-RTYA5\n');
  });

  it('zaxira kod maydoni: katta harf, ajratgichsiz, 5-5', () => {
    expect(formatRecoveryInput('k7qm 2xpa-4d')).toBe('K7QM2-XPA4D');
    expect(formatRecoveryInput(undefined)).toBe('');
  });
});
