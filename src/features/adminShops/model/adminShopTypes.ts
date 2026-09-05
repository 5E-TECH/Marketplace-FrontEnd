export type AdminShopStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface AdminShop {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: AdminShopStatus;
  phone: string;
  regionId: string | null;
  districtId: string | null;
  address: string | null;
  rating: number;
  ordersCount: number;
  elchiMarketId: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminShopListParams {
  page: number;
  limit: number;
  search?: string;
  status?: AdminShopStatus;
}

export interface AdminShopPage {
  items: AdminShop[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminShopDetail {
  id: string;
  ownerUserId: string;
  name: string;
  status: AdminShopStatus;
  stats: { products: number; orders: number; warehouses: number };
}
