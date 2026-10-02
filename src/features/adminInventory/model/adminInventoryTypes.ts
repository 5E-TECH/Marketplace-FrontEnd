export type StockMovementType = 'INBOUND' | 'OUTBOUND' | 'RESERVE' | 'RELEASE' | 'COMMIT' | 'ADJUST' | 'TRANSFER';
export const stockMovementTypes: StockMovementType[] = ['INBOUND', 'OUTBOUND', 'RESERVE', 'RELEASE', 'COMMIT', 'ADJUST', 'TRANSFER'];

export interface AdminStockListParams {
  page: number;
  limit: number;
  shopId?: string;
  search?: string;
  /** true — faqat faol, false — faqat o‘chirilgan omborlar; berilmasa hammasi. */
  warehouseActive?: boolean;
  lowOnly?: boolean;
}

export interface AdminMovementListParams {
  page: number;
  limit: number;
  shopId?: string;
  type?: StockMovementType;
  warehouseActive?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

/** Katalog ma’lumoti: katalog javob bermasa yoki variant o‘chirilgan bo‘lsa null. */
export interface AdminVariantInfo {
  variantId: string;
  productName: string | null;
  variantName: string | null;
  sku: string | null;
  catalogMissing: boolean;
}

export interface AdminStockItem extends AdminVariantInfo {
  shopId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseActive: boolean;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

export interface AdminStockMovement extends AdminVariantInfo {
  id: string;
  shopId: string;
  warehouseName: string;
  warehouseActive: boolean;
  type: string;
  quantity: number;
  onHandAfter: number;
  reservedAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminCatalogWarning {
  shopId: string;
  reason: string;
}

export interface AdminInventoryPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Katalogi javob bermagan do‘konlar — ularning qatorlari nomsiz. */
  warnings: AdminCatalogWarning[];
  searchTruncated: boolean;
}
