import type { TranslationKey } from '../../../shared/i18n/translations';
import type { LedgerEntryType, SellerPayoutStatus } from '../model/sellerFinanceTypes';

/** Sotuvchi va admin moliya sahifalari uchun umumiy yorliqlar (bir xil DTO). */
export const PAYOUT_STATUSES: SellerPayoutStatus[] = ['PENDING', 'APPROVED', 'HELD', 'PAID'];
export const PAYOUT_STATUS_LABELS: Record<SellerPayoutStatus, TranslationKey> = { PENDING: 'status.pending', APPROVED: 'status.approved', HELD: 'status.held', PAID: 'status.paid' };
export const ENTRY_LABELS: Record<LedgerEntryType, TranslationKey> = {
  SALE: 'sellerFinance.entry.SALE', COD_SALE: 'sellerFinance.entry.COD_SALE', COD_SETTLEMENT: 'sellerFinance.entry.COD_SETTLEMENT',
  COMMISSION: 'sellerFinance.entry.COMMISSION', PAYOUT: 'sellerFinance.entry.PAYOUT', REFUND: 'sellerFinance.entry.REFUND', ADJUST: 'sellerFinance.entry.ADJUST',
};
/** Backend yangi `referenceType` qo'shsa, xom qiymat ko'rsatiladi. */
export const REFERENCE_LABELS: Partial<Record<string, TranslationKey>> = {
  seller_order: 'sellerFinance.ref.seller_order', cod_seller_order: 'sellerFinance.ref.cod_seller_order',
  seller_order_refund: 'sellerFinance.ref.seller_order_refund', return_request: 'sellerFinance.ref.return_request', payout: 'sellerFinance.ref.payout',
};
