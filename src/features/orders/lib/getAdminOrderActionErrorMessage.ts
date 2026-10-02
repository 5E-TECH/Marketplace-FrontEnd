import axios from 'axios';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';

/**
 * Admin refund/cancel xatolari. 401/403 va 404 da aniq matn, qolganida
 * (masalan 400 — COD yoki yaroqsiz holat) backend yuborgan `message`.
 */
export function getAdminOrderActionErrorMessage(error: unknown, t: (key: TranslationKey) => string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) return t('adminOrders.actionForbidden');
    if (status === 404) return t('adminOrders.actionNotFound');
  }
  return getApiErrorMessage(error);
}
