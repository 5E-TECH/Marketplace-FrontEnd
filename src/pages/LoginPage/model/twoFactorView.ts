import { formatRecoveryCode } from '../../../features/auth/api/twoFactorApi';
import { ROLE_LABEL_KEYS } from '../../../features/auth/lib/roleLabels';
import type { TwoFactorChallenge } from '../../../features/auth/model/authTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { formatUzPhone } from '../../../shared/lib/phone';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «Nodira K. · Admin» (blok taymeri ostida); ism kelmasa (taklif fe-27 §2) — telefon raqami. */
export function identityLine(challenge: TwoFactorChallenge, t: Translate): string {
  return challenge.user ? `${shortPersonName(challenge.user.name)} · ${t(ROLE_LABEL_KEYS[challenge.user.role])}` : formatUzPhone(challenge.phone);
}

/** Zaxira kod maydoni: katta harf, faqat harf va raqam, «K7QM2-XPA4D» ko'rinishida (backend: 10 belgi). */
export function formatRecoveryInput(value: unknown): string {
  const clean = (typeof value === 'string' ? value : '').replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 20);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
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
