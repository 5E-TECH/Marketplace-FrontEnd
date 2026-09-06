export interface StockItem {
  variantId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

export interface StockPage {
  items: StockItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StockListParams {
  search?: string;
  lowOnly?: boolean;
  warehouseId?: string;
  productId?: string;
  variantId?: string;
  page: number;
  limit: number;
}

export interface StockInboundPayload {
  variantId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
  idempotencyKey?: string;
}

export interface StockAdjustPayload {
  variantId: string;
  warehouseId: string;
  delta: number;
  reason: string;
  idempotencyKey?: string;
}
