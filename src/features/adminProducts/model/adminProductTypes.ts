import type { Product, ProductStatus } from '../../products/model/productTypes';

export type AdminProduct = Product;

export interface AdminProductListParams {
  page: number;
  limit: number;
  search?: string;
  status?: Extract<ProductStatus, 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK'>;
  blocked?: boolean;
  shopId?: string;
}

export interface AdminProductPage {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
