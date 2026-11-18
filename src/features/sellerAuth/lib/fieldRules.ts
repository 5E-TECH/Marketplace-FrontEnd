import type { FormRule as Rule } from 'antd';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { isUzMobileNumber } from '../../../shared/lib/phone';

type Translate = (key: TranslationKey) => string;

/** Sotuvchi raqami: 9 raqam va O'zbekiston mobil operatori (komponentlar-E §19). */
export function sellerPhoneRules(t: Translate): Rule[] {
  return [
    { required: true, message: t('otp.phoneFormat') },
    { pattern: /^\d{9}$/, message: t('otp.phoneFormat') },
    {
      validator: (_rule, value: unknown) =>
        typeof value !== 'string' || value.length !== 9 || isUzMobileNumber(value)
          ? Promise.resolve()
          : Promise.reject(new Error(t('otp.phoneOperator'))),
    },
  ];
}

/** «305 918» — 6 raqam, o'rtada bo'sh joy (sotuvchi-royxat §2). SMS dan joylansa ham ishlaydi. */
export function normalizeOtpCode(value: unknown): string {
  const digits = (typeof value === 'string' ? value : '').replace(/\D/g, '').slice(0, 6);
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
}

export const otpCodeDigits = (value: string | undefined) => (value ?? '').replace(/\D/g, '');

export function otpCodeRules(t: Translate): Rule[] {
  return [
    { required: true, message: t('otp.codeRequired') },
    {
      validator: (_rule, value: unknown) =>
        typeof value !== 'string' || !value || otpCodeDigits(value).length === 6
          ? Promise.resolve()
          : Promise.reject(new Error(t('otp.codeFormat'))),
    },
  ];
}

/**
 * Tugma spinneri: javob 150 ms dan tez kelsa umuman chiqmaydi (miltillamaydi). Shuningdek antd
 * spinneri juda qisqa yoqilib-o'chganda «loading» yorlig'i tugma nomida qolib ketishining oldini oladi.
 */
export const pendingLoading = (pending: boolean) => (pending ? { delay: 150 } : false);
