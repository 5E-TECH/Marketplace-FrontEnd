import type { AppStatus } from '../../../shared/ui/StatusTag/StatusTag';

export type ProductStatus = Extract<AppStatus, 'ACTIVE' | 'INACTIVE' | 'LOW'>;

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  status: ProductStatus;
  variants: ProductVariant[];
}

export interface ProductVariant {
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export interface ProductUpsertPayload {
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
}
