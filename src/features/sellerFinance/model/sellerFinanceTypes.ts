/** Kontrakt: `/seller/finance/*` — shopId token'dan olinadi, so'rovda yuborilmaydi. */
export type PayoutFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type SellerPayoutStatus = 'PENDING' | 'APPROVED' | 'HELD' | 'PAID';
export type LedgerEntryType = 'SALE' | 'COD_SALE' | 'COD_SETTLEMENT' | 'COMMISSION' | 'PAYOUT' | 'REFUND' | 'ADJUST';

export interface SellerFinanceRange { dateFrom?: string; dateTo?: string }
export interface SellerLedgerParams extends SellerFinanceRange { page: number; limit: number }
export interface SellerPayoutParams { page: number; limit: number; status?: SellerPayoutStatus }

export interface FinancePage<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }

/** `amount`: musbat — sotuvchiga kirim, manfiy — yechim (komissiya, payout, refund). */
export interface LedgerEntry {
  id: string;
  shopId: string;
  entryType: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  /** seller_order | cod_seller_order | seller_order_refund | return_request | payout */
  referenceType: string;
  referenceId: string;
  createdAt: string;
}

export interface SellerPayout {
  id: string;
  shopId: string;
  amount: number;
  status: SellerPayoutStatus;
  method: string | null;
  /** Payout qaysi posilka (sales_order_seller) uchun ochilgan. */
  referenceId: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** COD reconciliation — `/admin/finance/reports` bilan bir xil shakl. */
export interface CodReconciliation {
  settlementsCount: number;
  expectedCodAmount: number;
  collectedCodAmount: number;
  difference: number;
  expectedCommission: number;
  nettedCommission: number;
  outstandingCommission: number;
}

/** `balance` va payout summalari — hozirgi holat; `paidPayoutAmount` va `cod` — tanlangan davr bo'yicha. */
export interface SellerFinanceSummary {
  shopId: string;
  balance: number;
  pendingPayoutAmount: number;
  heldPayoutAmount: number;
  paidPayoutAmount: number;
  cod: CodReconciliation;
  payoutSchedule: PayoutFrequency;
  /** YYYY-MM-DD (Asia/Tashkent). */
  nextPayoutDate: string;
}

export interface PayoutSchedule {
  frequency: PayoutFrequency;
  /** Do'kon hali tanlamagan — platforma standarti (WEEKLY). */
  isDefault: boolean;
  nextPayoutDate: string;
  updatedAt: string | null;
}
