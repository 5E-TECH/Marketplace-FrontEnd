import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { Product, ProductListParams, ProductPage, ProductStatus, ProductUpsertPayload, ProductVariant } from '../model/productTypes';

const productStatuses: ProductStatus[] = ['ACTIVE', 'LOW', 'INACTIVE', 'DRAFT', 'ARCHIVED', 'OUT_OF_STOCK'];

function toNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new Error(`Mahsulotning ${field} maydoni noto‘g‘ri formatda`);
  }
  return parsed;
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((image): image is string => typeof image === 'string')
    : [];
}

function parseAttributes(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function parseVariants(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  const items: unknown[] = value;
  return items.flatMap((item) => {
    if (typeof item !== 'object' || item === null || !('sku' in item) || typeof item.sku !== 'string') return [];
    return [{
      id: optionalString('id' in item ? item.id : '') || undefined,
      productId: optionalString('productId' in item ? item.productId : '') || undefined,
      name: optionalString('name' in item ? item.name : ''),
      sku: item.sku,
      attributes: parseAttributes('attributes' in item ? item.attributes : {}),
      price: 'price' in item && item.price !== null ? toNumber(item.price, 'variant narxi') : null,
      oldPrice: 'oldPrice' in item && item.oldPrice !== null ? toNumber(item.oldPrice, 'variant eski narxi') : null,
      barcode: optionalString('barcode' in item ? item.barcode : ''),
      imageUrl: optionalString('imageUrl' in item ? item.imageUrl : '') || null,
      isActive: !('isActive' in item) || item.isActive === true,
    }];
  });
}

export function parseProduct(value: unknown): Product {
  const candidate = unwrapApiData(value);
  if (typeof candidate !== 'object' || candidate === null) {
    throw new Error('Mahsulot serverdan noto‘g‘ri formatda keldi');
  }
  if (!('id' in candidate) || (typeof candidate.id !== 'string' && typeof candidate.id !== 'number') || !('name' in candidate) || typeof candidate.name !== 'string') {
    throw new Error('Mahsulotning majburiy maydonlari mavjud emas');
  }

  const categoryId = optionalString('categoryId' in candidate ? candidate.categoryId : '');
  const categoryValue = 'category' in candidate ? candidate.category : categoryId;
  const category = typeof categoryValue === 'string'
    ? categoryValue
    : typeof categoryValue === 'object' && categoryValue !== null && 'name' in categoryValue && typeof categoryValue.name === 'string'
      ? categoryValue.name
      : '';
  const stock = toNumber('stock' in candidate ? candidate.stock : 0, 'qoldiq');
  const rawStatus = 'status' in candidate ? String(candidate.status).toUpperCase() : '';
  const status = productStatuses.includes(rawStatus as ProductStatus)
    ? rawStatus as ProductStatus
    : 'DRAFT';
  const images = parseImages('images' in candidate ? candidate.images : []);
  const imageUrl = optionalString('imageUrl' in candidate ? candidate.imageUrl : '') || null;

  return {
    id: String(candidate.id),
    shopId: optionalString('shopId' in candidate ? candidate.shopId : ''),
    ownerUserId: optionalString('ownerUserId' in candidate ? candidate.ownerUserId : ''),
    categoryId,
    name: candidate.name,
    slug: optionalString('slug' in candidate ? candidate.slug : ''),
    description: optionalString('description' in candidate ? candidate.description : ''),
    sku: optionalString('sku' in candidate ? candidate.sku : '') || optionalString('slug' in candidate ? candidate.slug : ''),
    category,
    price: toNumber('price' in candidate ? candidate.price : 0, 'narx'),
    oldPrice:
      'oldPrice' in candidate && candidate.oldPrice !== null
        ? toNumber(candidate.oldPrice, 'eski narx')
        : null,
    imageUrl,
    images,
    attributes: parseAttributes('attributes' in candidate ? candidate.attributes : {}),
    hasVariants: 'hasVariants' in candidate && candidate.hasVariants === true,
    stock,
    status,
    isBlocked: 'isBlocked' in candidate && candidate.isBlocked === true,
    rating: toNumber('rating' in candidate ? candidate.rating : 0, 'reyting'),
    isDeleted: ('isDeleted' in candidate && candidate.isDeleted === true) || ('isBlocked' in candidate && candidate.isBlocked === true),
    createdAt: optionalString('createdAt' in candidate ? candidate.createdAt : ''),
    updatedAt: optionalString('updatedAt' in candidate ? candidate.updatedAt : ''),
    variants: parseVariants('variants' in candidate ? candidate.variants : []),
  };
}

export function parseProductPage(value: unknown, fallback: Pick<ProductListParams, 'page' | 'limit'>): ProductPage {
  const unwrapped = unwrapApiData(value);
  const list = Array.isArray(unwrapped)
    ? unwrapped
    : typeof unwrapped === 'object' && unwrapped !== null && 'items' in unwrapped && Array.isArray(unwrapped.items)
      ? unwrapped.items
      : typeof unwrapped === 'object' && unwrapped !== null && 'products' in unwrapped && Array.isArray(unwrapped.products)
        ? unwrapped.products
        : null;
  if (!list) throw new Error('Mahsulotlar ro‘yxati noto‘g‘ri formatda keldi');
  const record = typeof unwrapped === 'object' && unwrapped !== null ? unwrapped : {};
  const items = list.map(parseProduct);
  return {
    items,
    total: 'total' in record ? toNumber(record.total, 'jami') : items.length,
    page: 'page' in record ? toNumber(record.page, 'sahifa') : fallback.page,
    limit: 'limit' in record ? toNumber(record.limit, 'limit') : fallback.limit,
    totalPages: 'totalPages' in record ? toNumber(record.totalPages, 'jami sahifa') : Math.max(1, Math.ceil(items.length / fallback.limit)),
  };
}

export async function getMyProducts(params: ProductListParams, signal?: AbortSignal): Promise<ProductPage> {
  const { data } = await httpClient.get<unknown>('/products/my', {
    signal,
    params: {
      page: params.page,
      limit: params.limit,
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    },
  });
  return parseProductPage(data, params);
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const { data } = await httpClient.get<unknown>(`/products/${encodeURIComponent(id)}`, {
    signal,
  });
  const product = parseProduct(data);
  const raw = unwrapApiData(data);
  if (product.hasVariants && !(raw && typeof raw === 'object' && 'variants' in raw)) {
    const response = await httpClient.get<unknown>(`/products/${encodeURIComponent(id)}/variants`, { signal });
    const variants = unwrapApiData(response.data);
    if (!Array.isArray(variants)) throw new Error('Variantlar ro‘yxati noto‘g‘ri formatda');
    product.variants = parseVariants(variants);
  }
  return product;
}

export async function createProduct(payload: ProductUpsertPayload): Promise<Product> {
  const { data } = await httpClient.post<unknown>('/products', payload);
  return parseProduct(data);
}

export async function updateProduct(id: string, payload: ProductUpsertPayload): Promise<Product> {
  const { data } = await httpClient.patch<unknown>(`/products/${encodeURIComponent(id)}`, payload);
  return parseProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  await httpClient.delete(`/products/${encodeURIComponent(id)}`);
}
