export interface DashboardTopProduct {
  productId: string;
  name: string;
  sold: number;
}

export interface DashboardSalesPoint {
  date: string;
  amount: number;
}

export interface SellerDashboard {
  ordersTotal: number;
  revenue: number;
  pendingShipments: number;
  delivered: number;
  lowStockCount: number;
  topProducts: DashboardTopProduct[];
  salesByDay: DashboardSalesPoint[];
}
export interface AdminDashboard {
  shops: { total: number; pending: number; active: number; suspended: number; rejected: number };
  users: { total: number; sellers: number; buyers: number; admins: number; operators: number };
  orders: { total: number; today: number };
  gmv: number;
  revenue: number;
}
