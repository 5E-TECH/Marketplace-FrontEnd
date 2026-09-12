export type SellerOrderStatus = 'NEW' | 'CONFIRMED' | 'PENDING' | 'SHIPMENT_CREATED' | 'ON_THE_ROAD' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

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
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}
export interface AdminOrder {
  id: string;
  orderNumber: string;
  buyerName: string | null;
  totalAmount: number;
  paymentMethod: AdminPaymentMethod | null;
  status: AdminOrderStatus;
  shopId: string | null;
  createdAt: string;
}
export interface AdminOrdersPage { items: AdminOrder[]; total: number; page: number; limit: number; totalPages: number }
