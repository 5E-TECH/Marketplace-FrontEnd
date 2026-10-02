import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { parseProduct, parseProductPage } from '../../products/api/productApi';
import type { SellerShop, SellerShopStatus } from '../../shop/api/sellerShopApi';
import type { StorefrontProductDetail, StorefrontShopPage, StorefrontShopParams } from '../model/storefrontTypes';

const SHOP_STATUSES: SellerShopStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'];

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseShop(value: unknown): SellerShop {
  if (!value || typeof value !== 'object') {
    throw new Error('Do‘kon ma’lumoti noto‘g‘ri formatda keldi');
  }
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : '';
  const ownerUserId = typeof row.ownerUserId === 'string' || typeof row.ownerUserId === 'number'
    ? String(row.ownerUserId)
    : '';
  const status = (typeof row.status === 'string' ? row.status : '') as SellerShopStatus;
  if (!id || !ownerUserId || typeof row.name !== 'string' || typeof row.slug !== 'string' || !SHOP_STATUSES.includes(status)) {
    throw new Error('Do‘konning majburiy maydonlari mavjud emas');
  }

  return {
    id,
    ownerUserId,
    name: row.name,
    slug: row.slug,
    status,
    description: optionalString(row.description),
    logoUrl: optionalString(row.logoUrl),
    bannerUrl: optionalString(row.bannerUrl),
    phone: optionalString(row.phone),
    regionId: optionalString(row.regionId),
    districtId: optionalString(row.districtId),
    address: optionalString(row.address),
    rating: typeof row.rating === 'number' && Number.isFinite(row.rating) ? row.rating : 0,
    ordersCount: typeof row.ordersCount === 'number' && Number.isFinite(row.ordersCount) ? row.ordersCount : 0,
  };
}

export async function getStorefrontProduct(id: string, signal?: AbortSignal): Promise<StorefrontProductDetail> {
  const { data } = await httpClient.get<unknown>(`/storefront/products/${encodeURIComponent(id)}`, { signal });
  const value = unwrapApiData(data);
  if (!value || typeof value !== 'object' || !('shop' in value)) {
    throw new Error('Mahsulot sahifasi noto‘g‘ri formatda keldi');
  }
  return { product: parseProduct(value), shop: parseShop(value.shop) };
}

export async function getStorefrontShop(
  slug: string,
  params: StorefrontShopParams,
  signal?: AbortSignal,
): Promise<StorefrontShopPage> {
  const { data } = await httpClient.get<unknown>(
    `/storefront/shops/${encodeURIComponent(slug)}`,
    {
      signal,
      params: {
        page: params.page,
        limit: params.limit,
        sort: params.sort,
        ...(params.search ? { search: params.search } : {}),
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.minPrice !== undefined ? { minPrice: params.minPrice } : {}),
        ...(params.maxPrice !== undefined ? { maxPrice: params.maxPrice } : {}),
      },
    },
  );
  const value = unwrapApiData(data);
  if (!value || typeof value !== 'object' || !('shop' in value) || !('products' in value)) {
    throw new Error('Do‘kon sahifasi noto‘g‘ri formatda keldi');
  }

  const shop = parseShop(value.shop);
  const products = parseProductPage(value.products, params);
  const items = products.items.filter((product) => product.shopId === shop.id);
  return {
    shop,
    products: {
      ...products,
      items,
      total: Math.max(0, products.total - (products.items.length - items.length)),
    },
  };
}
