import type { AppStatus } from '../../../shared/ui/StatusTag/StatusTag';

export type ProductStatus = Extract<AppStatus, 'ACTIVE' | 'INACTIVE' | 'LOW' | 'DRAFT' | 'ARCHIVED' | 'OUT_OF_STOCK'>;

export interface Product {
  id: string;
  shopId: string;
  ownerUserId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  sku: string;
  category: string;
  price: number;
  oldPrice: number | null;
  imageUrl: string | null;
  images: string[];
  attributes: Record<string, string>;
  hasVariants: boolean;
  stock: number;
  status: ProductStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}

export interface ProductVariant {
  id?: string;
  productId?: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price: number | null;
  oldPrice: number | null;
  barcode: string;
  imageUrl: string | null;
  isActive: boolean;
}

export type ProductVariantPayload = Pick<ProductVariant, 'sku' | 'name' | 'attributes' | 'price' | 'oldPrice' | 'barcode' | 'imageUrl' | 'isActive'>;

export interface ProductUpsertPayload {
  categoryId?: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  imageUrl?: string;
  images: string[];
  attributes: Record<string, string>;
}

export interface ProductListParams {
  search?: string;
  status?: Extract<ProductStatus, 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK'>;
  categoryId?: string;
  page: number;
  limit: number;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
