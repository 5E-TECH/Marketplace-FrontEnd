import { useQuery } from '@tanstack/react-query';
import { getSystemHealth, getSystemReadiness } from './systemHealthApi';

const systemHealthKeys = {
  health: ['system-health', 'health'] as const,
  readiness: ['system-health', 'readiness'] as const,
};

const healthQueryOptions = { refetchInterval: 30_000, retry: 1 } as const;

export const useSystemHealthQuery = () => useQuery({
  queryKey: systemHealthKeys.health,
  queryFn: ({ signal }) => getSystemHealth(signal),
  ...healthQueryOptions,
});

export const useSystemReadinessQuery = () => useQuery({
  queryKey: systemHealthKeys.readiness,
  queryFn: ({ signal }) => getSystemReadiness(signal),
  ...healthQueryOptions,
});
