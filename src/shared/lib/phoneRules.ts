import type { FormRule } from 'antd';
import type { TranslationKey } from '../i18n/translations';
import { isUzMobileNumber } from './phone';

type Translate = (key: TranslationKey) => string;

/**
 * Telefon maydoni qoidalari (komponentlar-E §19; content-spec 2.4): 9 raqam va O'zbekiston mobil
 * operatori. Maydondan chiqqanda va yuborishda tekshiriladi (`validateTrigger={['onBlur', 'onSubmit']}`).
 */
export function uzPhoneRules(t: Translate): FormRule[] {
  return [
    { required: true, message: t('phone.format') },
    { pattern: /^\d{9}$/, message: t('phone.format') },
    {
      validator: (_rule, value: unknown) =>
        typeof value !== 'string' || value.length !== 9 || isUzMobileNumber(value)
          ? Promise.resolve()
          : Promise.reject(new Error(t('phone.operator'))),
    },
  ];
}
