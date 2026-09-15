import type { Product, ProductPage } from '../../products/model/productTypes';
import type { SellerShop } from '../../shop/api/sellerShopApi';

export type StorefrontSort =
  | 'createdAt:asc'
  | 'createdAt:desc'
  | 'price:asc'
  | 'price:desc'
  | 'name:asc'
  | 'name:desc';

export interface StorefrontShopParams {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: StorefrontSort;
  page: number;
  limit: number;
}

export interface StorefrontShopPage {
  shop: SellerShop;
  products: ProductPage;
}

export interface StorefrontProductDetail {
  product: Product;
  shop: SellerShop;
}
