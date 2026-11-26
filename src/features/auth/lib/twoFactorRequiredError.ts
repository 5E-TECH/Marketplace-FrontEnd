import type { TwoFactorChallenge } from '../model/authTypes';

/**
 * Parol to'g'ri, lekin sessiya o'rniga 2FA bosqichi keldi (BE-26). Sessiya beradigan joylarda (masalan, «Sessiya
 * tugadi» oynasi) ikkinchi qadamni ko'rsatish uchun.
 */
export class TwoFactorRequiredError extends Error {
  readonly challenge: TwoFactorChallenge;

  constructor(challenge: TwoFactorChallenge) {
    super('Ilovadagi kod kerak');
    this.name = 'TwoFactorRequiredError';
    this.challenge = challenge;
  }
}
