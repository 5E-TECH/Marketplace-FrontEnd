import { httpClient } from '../../../shared/api/httpClient';
import type { Product, ProductStatus, ProductUpsertPayload } from '../model/productTypes';

const productStatuses: ProductStatus[] = ['ACTIVE', 'LOW', 'INACTIVE'];

function unwrap(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'data' in value ? value.data : value;
}

function toNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new Error(`Mahsulotning ${field} maydoni noto‘g‘ri formatda`);
  }
  return parsed;
}

function parseProduct(value: unknown): Product {
  const candidate = unwrap(value);
  if (typeof candidate !== 'object' || candidate === null) {
    throw new Error('Mahsulot serverdan noto‘g‘ri formatda keldi');
  }
  if (!('id' in candidate) || typeof candidate.id !== 'string' || !('name' in candidate) || typeof candidate.name !== 'string') {
    throw new Error('Mahsulotning majburiy maydonlari mavjud emas');
  }

  const categoryValue = 'category' in candidate ? candidate.category : '';
  const category = typeof categoryValue === 'string'
    ? categoryValue
    : typeof categoryValue === 'object' && categoryValue !== null && 'name' in categoryValue && typeof categoryValue.name === 'string'
      ? categoryValue.name
      : '';
  const stock = toNumber('stock' in candidate ? candidate.stock : 0, 'qoldiq');
  const rawStatus = 'status' in candidate ? String(candidate.status).toUpperCase() : '';
  const status = productStatuses.includes(rawStatus as ProductStatus)
    ? rawStatus as ProductStatus
    : stock === 0 ? 'INACTIVE' : stock <= 5 ? 'LOW' : 'ACTIVE';

  return {
    id: candidate.id,
    name: candidate.name,
    sku: 'sku' in candidate && typeof candidate.sku === 'string' ? candidate.sku : '',
    category,
    price: toNumber('price' in candidate ? candidate.price : 0, 'narx'),
    stock,
    status,
    variants: [],
  };
}

function parseProductList(value: unknown): Product[] {
  const unwrapped = unwrap(value);
  const list = Array.isArray(unwrapped)
    ? unwrapped
    : typeof unwrapped === 'object' && unwrapped !== null && 'items' in unwrapped && Array.isArray(unwrapped.items)
      ? unwrapped.items
      : typeof unwrapped === 'object' && unwrapped !== null && 'products' in unwrapped && Array.isArray(unwrapped.products)
        ? unwrapped.products
        : null;
  if (!list) throw new Error('Mahsulotlar ro‘yxati noto‘g‘ri formatda keldi');
  return list.map(parseProduct);
}

export async function getMyProducts(): Promise<Product[]> {
  const { data } = await httpClient.get<unknown>('/products/my');
  return parseProductList(data);
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await httpClient.get<unknown>(`/products/${encodeURIComponent(id)}`);
  return parseProduct(data);
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
