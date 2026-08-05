export interface ShopProfile {
  name: string;
  slug: string;
  description: string;
  phone: string;
  regionId: string;
  districtId: string;
  address: string;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export type ShopProfileFormValues = Omit<
  ShopProfile,
  'logoUrl' | 'bannerUrl'
>;

export const initialShopProfile: ShopProfile = {
  name: 'MarketHub Store',
  slug: 'markethub-store',
  description:
    'Original va sifatli mahsulotlarni tezkor yetkazib beruvchi ishonchli do‘kon.',
  phone: '+998 90 000 00 00',
  regionId: '',
  districtId: '',
  address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor ko‘chasi 12',
  logoUrl: null,
  bannerUrl: null,
};

export function toShopProfile(shop: {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  phone: string | null;
  regionId: string | null;
  districtId: string | null;
  address: string | null;
}): ShopProfile {
  return {
    ...initialShopProfile,
    name: shop.name,
    slug: shop.slug,
    description: shop.description ?? '',
    logoUrl: shop.logoUrl,
    bannerUrl: shop.bannerUrl,
    phone: shop.phone ?? '',
    regionId: shop.regionId ?? '',
    districtId: shop.districtId ?? '',
    address: shop.address ?? '',
  };
}
