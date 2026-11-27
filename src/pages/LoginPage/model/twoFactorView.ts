import { formatRecoveryCode } from '../../../features/auth/api/twoFactorApi';
import { ROLE_LABEL_KEYS } from '../../../features/auth/lib/roleLabels';
import type { TwoFactorChallenge } from '../../../features/auth/model/authTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { formatUzPhone } from '../../../shared/lib/phone';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «Sessiya tugadi» oynasidan kelgan 2FA bosqichi (2FA tiklangan — ilovani qayta ulash), `location.state.challenge`. */
export function challengeFromState(state: unknown): TwoFactorChallenge | null {
  const value = typeof state === 'object' && state !== null && 'challenge' in state ? state.challenge : null;
  if (typeof value !== 'object' || value === null) return null;
  const challenge = value as Partial<TwoFactorChallenge>;
  return typeof challenge.token === 'string' && challenge.token && typeof challenge.phone === 'string' && typeof challenge.setupRequired === 'boolean'
    ? { token: challenge.token, phone: challenge.phone, setupRequired: challenge.setupRequired, user: challenge.user ?? null, reset: challenge.reset ?? null }
    : null;
}

/** «Nodira K. · Admin» (blok taymeri ostida); ism kelmasa (taklif fe-27 §2) — telefon raqami. */
export function identityLine(challenge: TwoFactorChallenge, t: Translate): string {
  return challenge.user ? `${shortPersonName(challenge.user.name)} · ${t(ROLE_LABEL_KEYS[challenge.user.role])}` : formatUzPhone(challenge.phone);
}

/** Kalit to'rtlik guruhlarda — «MZXW 6YTB OI4D …» (umumiy-2fa-ulash); telefonda guruhlar orasida qatorga bo'linadi. */
export function secretGroups(secret: string): string[] {
  return secret.replace(/\s+/g, '').match(/.{1,4}/g) ?? [];
}

/**
 * Ilovada hisob qanday ko'rinadi — `otpauth://totp/Issuer:account` dan (BE-26: «Elchi Marketplace» va telefon).
 * Dizayndagi «[brend] · Ozoda B.» o'rniga backend bergan yorliq — ilovada aynan shu chiqadi.
 */
export function otpauthAccount(url: string): string {
  const match = /^otpauth:\/\/totp\/([^?]+)/i.exec(url);
  if (!match?.[1]) return '';
  let label = match[1];
  try {
    label = decodeURIComponent(label);
  } catch {
    // Buzuq kodlash — yorliq qanday kelgan bo'lsa shunday.
  }
  const [issuer, account] = label.includes(':') ? [label.slice(0, label.indexOf(':')), label.slice(label.indexOf(':') + 1)] : ['', label];
  const shown = /^\+?998\d{9}$/.test(account.trim()) ? formatUzPhone(account.trim()) : account.trim();
  return issuer.trim() ? `${issuer.trim()} · ${shown}` : shown;
}

/** Zaxira kodlar fayli (.txt) va chop etish matni: sarlavha, hisob, sana, qoida, raqamlangan kodlar. */
export function recoveryCodesText({ codes, title, account, date, rule }: { codes: readonly string[]; title: string; account: string; date: string; rule: string }): string {
  const width = String(codes.length).length;
  return [title, account, date, rule, '', ...codes.map((code, index) => `${String(index + 1).padStart(width, ' ')}. ${formatRecoveryCode(code)}`), ''].join('\n');
}

/** 2FA bosqichidan parolga qaytish sababi: «Boshqa hisob»/«Chiqish», muddat tugadi, 2FA boshqa joyda ulangan. */
export type TwoFactorLeave = 'signOut' | 'expired' | 'alreadyEnabled';
