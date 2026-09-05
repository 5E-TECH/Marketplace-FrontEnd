import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type {
  DashboardSalesPoint,
  DashboardTopProduct,
  SellerDashboard,
  AdminDashboard,
} from '../model/dashboardTypes';

function finiteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Statistikaning ${key} maydoni noto‘g‘ri`);
  }
  return value;
}

function parseTopProduct(value: unknown): DashboardTopProduct {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Top mahsulot noto‘g‘ri formatda keldi');
  }
  const item = value as Record<string, unknown>;
  if (typeof item.productId !== 'string' || typeof item.name !== 'string') {
    throw new Error('Top mahsulotning majburiy maydonlari yo‘q');
  }
  return {
    productId: item.productId,
    name: item.name,
    sold: finiteNumber(item, 'sold'),
  };
}

function parseSalesPoint(value: unknown): DashboardSalesPoint {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Savdo grafigi noto‘g‘ri formatda keldi');
  }
  const item = value as Record<string, unknown>;
  if (typeof item.date !== 'string' || Number.isNaN(Date.parse(item.date))) {
    throw new Error('Savdo sanasi noto‘g‘ri');
  }
  return { date: item.date, amount: finiteNumber(item, 'amount') };
}

function parseDashboard(value: unknown): SellerDashboard {
  const data = unwrapApiData(value);
  if (typeof data !== 'object' || data === null) {
    throw new Error('Statistika serverdan noto‘g‘ri formatda keldi');
  }
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.topProducts) || !Array.isArray(record.salesByDay)) {
    throw new Error('Statistika ro‘yxatlari noto‘g‘ri formatda keldi');
  }
  return {
    ordersTotal: finiteNumber(record, 'ordersTotal'),
    revenue: finiteNumber(record, 'revenue'),
    pendingShipments: finiteNumber(record, 'pendingShipments'),
    delivered: finiteNumber(record, 'delivered'),
    lowStockCount: finiteNumber(record, 'lowStockCount'),
    topProducts: record.topProducts.map(parseTopProduct),
    salesByDay: record.salesByDay.map(parseSalesPoint),
  };
}

export async function getSellerDashboard(signal?: AbortSignal): Promise<SellerDashboard> {
  const { data } = await httpClient.get<unknown>('/seller/dashboard', { signal });
  return parseDashboard(data);
}

function numberGroup(value: unknown, keys: string[]): Record<string, number> {
  if (!value || typeof value !== 'object') throw new Error('Admin statistikasi noto‘g‘ri formatda');
  return Object.fromEntries(keys.map((key) => [key, finiteNumber(value as Record<string, unknown>, key)]));
}

export async function getAdminDashboard(signal?: AbortSignal): Promise<AdminDashboard> {
  const { data } = await httpClient.get<unknown>('/admin/dashboard', { signal });
  const value = unwrapApiData(data);
  if (!value || typeof value !== 'object') throw new Error('Admin statistikasi noto‘g‘ri formatda');
  const record = value as Record<string, unknown>;
  return {
    shops: numberGroup(record.shops, ['total', 'pending', 'active', 'suspended', 'rejected']) as AdminDashboard['shops'],
    users: numberGroup(record.users, ['total', 'sellers', 'buyers', 'admins', 'operators']) as AdminDashboard['users'],
    orders: numberGroup(record.orders, ['total', 'today']) as AdminDashboard['orders'],
    gmv: finiteNumber(record, 'gmv'), revenue: finiteNumber(record, 'revenue'),
  };
}
