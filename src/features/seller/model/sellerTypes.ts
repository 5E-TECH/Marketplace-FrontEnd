import type { AppStatus } from '../../../shared/ui/StatusTag/StatusTag';

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  products: number;
  stock: number;
  status: Extract<AppStatus, 'ACTIVE' | 'INACTIVE'>;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  total: number;
  createdAt: string;
  status: Extract<
    AppStatus,
    'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  >;
}
