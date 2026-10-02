/** Kontrakt: ReturnRequestDto.status — SUBMITTED → IN_REVIEW → APPROVED | REJECTED → REFUNDED. */
export type ReturnStatus = 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
export type ReturnReason = 'DEFECTIVE' | 'DAMAGED' | 'INCOMPLETE' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED' | 'CHANGED_MIND' | 'OTHER';
type ReturnPaymentMethod = 'online' | 'cod';

export interface ReturnItem {
  id: string;
  orderItemId: string;
  productId: string;
  variantId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReturnRequest {
  id: string;
  /** sales_order ID */
  orderId: string;
  /** Posilka (sales_order_seller) ID */
  sellerOrderId: string;
  shopId: string;
  shopName: string | null;
  buyerName: string | null;
  status: ReturnStatus;
  reason: ReturnReason;
  comment: string | null;
  paymentMethod: ReturnPaymentMethod;
  requestedAmount: number;
  refundedAmount: number | null;
  restocked: boolean | null;
  /** Oxirgi qaror izohi: rad etish sababi yoki tasdiq izohi. */
  decisionComment: string | null;
  decidedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReturnItem[];
}

export interface ReturnHistoryEntry {
  fromStatus: ReturnStatus | null;
  toStatus: ReturnStatus;
  actorRole: string;
  comment: string | null;
  createdAt: string;
}

export interface ReturnRequestDetail extends ReturnRequest {
  history: ReturnHistoryEntry[];
}

export interface ReturnsPage {
  items: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SellerReturnListParams {
  page: number;
  limit: number;
  status?: ReturnStatus;
}

export interface AdminReturnListParams extends SellerReturnListParams {
  shopId?: string;
  orderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type ReturnScope = 'seller' | 'admin';

export interface ReturnCommentPayload { id: string; comment?: string }
export interface ReturnRejectPayload { id: string; reason: string }
export interface ReturnRefundPayload { id: string; amount: number; restock: boolean; comment?: string }
