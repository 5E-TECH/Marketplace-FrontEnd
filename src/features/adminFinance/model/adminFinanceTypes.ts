import type { FinancePage, SellerPayout, SellerPayoutStatus } from '../../sellerFinance/model/sellerFinanceTypes';

/** Admin va sotuvchi bir xil DTO'ni oladi (`FinancePayoutDto`); admin barcha do'konlarni ko'radi. */
export type PayoutStatus = SellerPayoutStatus;
export type PayoutAction = 'approve' | 'hold' | 'release';
export interface PayoutListParams { shopId?: string; status?: PayoutStatus; page: number; limit: number }
export interface ReportParams { shopId?: string; dateFrom?: string; dateTo?: string }
export interface LedgerListParams extends ReportParams { page: number; limit: number }
export type AdminPayout = SellerPayout;
export type AdminPayoutsPage = FinancePage<SellerPayout>;
