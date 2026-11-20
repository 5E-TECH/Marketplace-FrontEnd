import type { FormRule as Rule } from 'antd';
import type { TranslationKey } from '../../../shared/i18n/translations';

type Translate = (key: TranslationKey) => string;

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
