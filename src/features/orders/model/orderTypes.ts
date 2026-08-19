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
