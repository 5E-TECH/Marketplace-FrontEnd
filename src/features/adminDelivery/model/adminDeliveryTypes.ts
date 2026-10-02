/**
 * `created` — Elchi posilkasi bor; `missing` — Elchi’ga topshirilmay qotib
 * qolgan (tasdiqlangan/to‘langan, lekin posilka yaratilmagan); `all` — hammasi.
 */
export type AdminShipmentState = 'all' | 'created' | 'missing';

export type SellerOrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPMENT_CREATED' | 'RECEIVED' | 'ON_THE_ROAD' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export const sellerOrderStatuses: SellerOrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPMENT_CREATED', 'RECEIVED', 'ON_THE_ROAD', 'DELIVERED', 'CANCELLED', 'RETURNED'];

export interface AdminShipmentListParams {
  page: number;
  limit: number;
  shipmentState?: AdminShipmentState;
  status?: SellerOrderStatus;
  shopId?: string;
  shipmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminShipment {
  /** seller-order (sales_order_seller) id. */
  id: string;
  salesOrderId: string;
  shopId: string;
  shipmentId: string | null;
  trackingUrl: string | null;
  status: string;
  orderStatus: string | null;
  paymentMethod: string | null;
  codAmount: number;
  buyerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWebhookListParams {
  page: number;
  limit: number;
  eventId?: string;
  shipmentId?: string;
  sellerOrderId?: string;
  status?: SellerOrderStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminWebhookEvent {
  eventId: string;
  shipmentId: string | null;
  sellerOrderId: string | null;
  status: string;
  occurredAt: string | null;
  processedAt: string | null;
  payload: unknown;
}

export interface AdminDeliveryPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReprovisionResult {
  shopId: string;
  elchiMarketId: string | null;
  status: string;
  reprovisioned: boolean;
  error: string | null;
}
