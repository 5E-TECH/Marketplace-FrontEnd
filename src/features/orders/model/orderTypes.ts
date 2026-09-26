export type SellerOrderStatus = 'NEW' | 'CONFIRMED' | 'PENDING' | 'SHIPMENT_CREATED' | 'RECEIVED' | 'ON_THE_ROAD' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export interface SellerOrder {
  id: string;
  salesOrderId: string;
  buyerName: string | null;
  subtotal: number;
  codAmount: number;
  status: SellerOrderStatus;
  elchiShipmentId: string | null;
  trackingUrl: string | null;
  itemsCount: number;
  createdAt: string;
}

export interface SellerOrdersPage {
  items: SellerOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SellerOrderListParams {
  status?: SellerOrderStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface UpdateSellerOrderStatusPayload {
  id: string;
  status: SellerOrderStatus;
}

export interface CreateShipmentPayload { id: string; customerPhone: string }
export interface SellerOrderHistory { id: string; status: SellerOrderStatus; createdAt: string }
export interface SellerOrderItem { id: string; name: string; quantity: number; price: number }

export type PaymentMethod = 'COD' | 'PAYME' | 'CLICK';
export type AdminOrderStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'CONFIRMED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
export type AdminPaymentMethod = 'online' | 'cod';
export interface AdminOrderListParams {
  status?: AdminOrderStatus;
  paymentMethod?: AdminPaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}
export interface AdminOrder {
  id: string;
  orderNumber: string;
  buyerName: string | null;
  buyerPhone: string | null;
  totalAmount: number;
  paymentMethod: AdminPaymentMethod | null;
  status: AdminOrderStatus;
  shopId: string | null;
  shopName: string | null;
  sellersCount: number;
  createdAt: string;
}
export interface AdminOrdersPage { items: AdminOrder[]; total: number; page: number; limit: number; totalPages: number }
export interface AdminOrderActionPayload { id: string; reason: string }
/** `idempotent: true` — buyurtma allaqachon shu holatda edi, yangi yon ta’sir bo‘lmadi. */
export interface AdminOrderActionResult { idempotent: boolean }

export interface AdminSubOrder {
  id: string;
  shopId: string | null;
  shopName: string | null;
  status: string;
  amount: number | null;
  createdAt: string | null;
}

export interface AdminOrderItemDetail {
  id: string;
  name: string;
  sku: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface AdminOrderShipmentDetail {
  id: string;
  provider: string | null;
  status: string | null;
  trackingUrl: string | null;
  createdAt: string | null;
}

export interface AdminOrderHistoryEntry {
  id: string;
  status: string;
  note: string | null;
  actorName: string | null;
  createdAt: string | null;
}

export interface AdminOrderPaymentDetail {
  method: string | null;
  status: string | null;
  amount: number | null;
  transactionId: string | null;
}

export interface AdminOrderDetail {
  summary: AdminOrder | null;
  deliveryAddress: string | null;
  sellerOrders: AdminSubOrder[];
  items: AdminOrderItemDetail[];
  shipments: AdminOrderShipmentDetail[];
  history: AdminOrderHistoryEntry[];
  payment: AdminOrderPaymentDetail | null;
}
