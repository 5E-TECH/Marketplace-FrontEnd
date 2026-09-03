import { httpClient } from '../../../shared/api/httpClient';
import { unwrapData } from '../../../shared/api/unwrapData';

export type SellerShopStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED';

export interface SellerShop {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  status: SellerShopStatus;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  phone: string | null;
  regionId: string | null;
  districtId: string | null;
  address: string | null;
  rating: number;
  ordersCount: number;
}

export interface UpdateSellerShopPayload {
  name?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  regionId?: string;
  districtId?: string;
  address?: string;
}

export interface CreateSellerShopPayload {
  name: string;
  phone: string;
  password: string;
  shopName: string;
  shopDescription?: string;
  address?: string;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseSellerShop(response: unknown): SellerShop {
  const candidate = unwrapData(response);

  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !('id' in candidate) ||
    typeof candidate.id !== 'string' ||
    !('ownerUserId' in candidate) ||
    typeof candidate.ownerUserId !== 'string' ||
    !('name' in candidate) ||
    typeof candidate.name !== 'string' ||
    !('slug' in candidate) ||
    typeof candidate.slug !== 'string' ||
    !('status' in candidate) ||
    !['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].includes(
      String(candidate.status),
    ) ||
    !('description' in candidate) ||
    !nullableString(candidate.description) ||
    !('logoUrl' in candidate) ||
    !nullableString(candidate.logoUrl) ||
    !('bannerUrl' in candidate) ||
    !nullableString(candidate.bannerUrl) ||
    !('phone' in candidate) ||
    !nullableString(candidate.phone) ||
    !('regionId' in candidate) ||
    !nullableString(candidate.regionId) ||
    !('districtId' in candidate) ||
    !nullableString(candidate.districtId) ||
    !('address' in candidate) ||
    !nullableString(candidate.address) ||
    !('rating' in candidate) ||
    typeof candidate.rating !== 'number' ||
    !('ordersCount' in candidate) ||
    typeof candidate.ordersCount !== 'number'
  ) {
    throw new Error('Do‘kon profili serverdan noto‘g‘ri formatda keldi');
  }

  return candidate as SellerShop;
}

export async function getSellerShop(signal?: AbortSignal): Promise<SellerShop> {
  const { data } = await httpClient.get<unknown>('/sellers/me', { signal });
  return parseSellerShop(data);
}

export async function updateSellerShop(
  payload: UpdateSellerShopPayload,
): Promise<SellerShop> {
  const { data } = await httpClient.patch<unknown>('/sellers/me', payload);
  return parseSellerShop(data);
}

export async function createSellerShop(
  payload: CreateSellerShopPayload,
): Promise<void> {
  const { name, phone, password, shopName, shopDescription, address } = payload;
  await httpClient.post('/sellers/register', {
    name,
    phone,
    password,
    shopName,
    ...(shopDescription ? { shopDescription } : {}),
    ...(address ? { address } : {}),
  });
}
