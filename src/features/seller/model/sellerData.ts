import type { Order, Product, Warehouse } from './sellerTypes';

export const initialProducts: Product[] = [
  { id: '1', name: 'Simsiz quloqchin Pro', sku: 'AUD-001', category: 'Elektronika', price: 349000, stock: 24, status: 'ACTIVE', variants: [] },
  { id: '2', name: 'Smart Watch S8', sku: 'WTC-008', category: 'Elektronika', price: 589000, stock: 4, status: 'LOW', variants: [] },
  { id: '3', name: 'Charm ryukzak', sku: 'BAG-014', category: 'Aksessuarlar', price: 279000, stock: 0, status: 'INACTIVE', variants: [] },
];

export const warehouses: Warehouse[] = [
  { id: '1', name: 'Toshkent markaziy ombori', address: 'Chilonzor tumani, Bunyodkor 12', products: 38, stock: 412, status: 'ACTIVE' },
  { id: '2', name: 'Samarqand filiali', address: 'Samarqand shahri, Beruniy 8', products: 21, stock: 186, status: 'ACTIVE' },
];

export const orders: Order[] = [
  { id: 'EL-1048', customer: 'Aziza Karimova', phone: '+998 90 123 45 67', total: 728000, createdAt: '27-iyul, 11:42', status: 'NEW' },
  { id: 'EL-1047', customer: 'Bekzod Aliyev', phone: '+998 93 555 21 10', total: 349000, createdAt: '27-iyul, 10:18', status: 'PROCESSING' },
  { id: 'EL-1046', customer: 'Madina Saidova', phone: '+998 99 741 08 12', total: 1178000, createdAt: '26-iyul, 18:05', status: 'SHIPPED' },
  { id: 'EL-1045', customer: 'Jasur Umarov', phone: '+998 97 337 44 22', total: 279000, createdAt: '26-iyul, 15:26', status: 'DELIVERED' },
];

export const formatPrice = (value: number) =>
  `${new Intl.NumberFormat('uz-UZ').format(value)} so‘m`;
