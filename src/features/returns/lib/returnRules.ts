import type { UserRole } from '../../auth/model/authTypes';
import type { ReturnReason, ReturnStatus } from '../model/returnTypes';

export const RETURN_STATUSES: readonly ReturnStatus[] = ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REFUNDED'];
export const RETURN_REASONS: readonly ReturnReason[] = ['DEFECTIVE', 'DAMAGED', 'INCOMPLETE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'];

/** Sifat muammosi: tovar omborga qaytmaydi. Backend `restock` default'i bilan bir xil. */
const QUALITY_REASONS: ReadonlySet<ReturnReason> = new Set(['DEFECTIVE', 'DAMAGED', 'INCOMPLETE', 'WRONG_ITEM']);
export const defaultRestock = (reason: ReturnReason): boolean => !QUALITY_REASONS.has(reason);

/** Sotuvchi qarorni bir marta beradi: approve/reject'dan keyin tugmalar yo'q, qarorni faqat admin o'zgartiradi. */
export function getSellerReturnActions(status: ReturnStatus) {
  const pending = status === 'SUBMITTED' || status === 'IN_REVIEW';
  return { review: status === 'SUBMITTED', approve: pending, reject: pending };
}

/**
 * Admin: REJECTED'ni ham tasdiqlay oladi (nizo), APPROVED'ni pul qaytarilgunicha rad eta oladi.
 * Pulni faqat SUPERADMIN qaytaradi — ADMIN tugmani ko'rmaydi.
 */
export function getAdminReturnActions(status: ReturnStatus, role: UserRole | undefined) {
  return {
    approve: status === 'SUBMITTED' || status === 'IN_REVIEW' || status === 'REJECTED',
    reject: status === 'SUBMITTED' || status === 'IN_REVIEW' || status === 'APPROVED',
    refund: status === 'APPROVED' && role === 'SUPERADMIN',
  };
}
