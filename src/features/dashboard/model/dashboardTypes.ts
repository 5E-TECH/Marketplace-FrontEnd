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
