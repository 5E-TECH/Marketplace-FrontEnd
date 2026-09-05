import { useQuery } from '@tanstack/react-query';
import { getSellerDashboard } from './dashboardApi';

export const dashboardKey = ['seller', 'dashboard'] as const;

export function useSellerDashboardQuery() {
  return useQuery({
    queryKey: dashboardKey,
    queryFn: ({ signal }) => getSellerDashboard(signal),
  });
}
