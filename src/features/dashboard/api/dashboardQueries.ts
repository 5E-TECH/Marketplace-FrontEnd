import { useQuery } from '@tanstack/react-query';
import { getAdminDashboard, getSellerDashboard } from './dashboardApi';

export const dashboardKey = ['seller', 'dashboard'] as const;

export function useSellerDashboardQuery() {
  return useQuery({
    queryKey: dashboardKey,
    queryFn: ({ signal }) => getSellerDashboard(signal),
  });
}
export const useAdminDashboardQuery = () => useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ({ signal }) => getAdminDashboard(signal), staleTime: 60_000 });
