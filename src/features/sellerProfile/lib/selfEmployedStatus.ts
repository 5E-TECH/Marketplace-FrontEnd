import type { TranslationKey } from '../../../shared/i18n/translations';
import type { SelfEmployedStatus } from '../model/sellerProfileTypes';

/** «Tasdiqlangan», «Tekshirilmoqda»… — Profil va JShShIR sahifasida bir xil. */
export const selfEmployedStatusKey = (status: SelfEmployedStatus) => `sellerProfile.status.${status}` as TranslationKey;

export const selfEmployedStatusColor: Record<SelfEmployedStatus, string> = {
  NOT_SUBMITTED: 'default',
  PENDING: 'processing',
  VERIFIED: 'success',
  REJECTED: 'error',
  REVOKED: 'warning',
};
