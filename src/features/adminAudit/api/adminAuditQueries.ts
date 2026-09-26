import { useQuery } from '@tanstack/react-query';
import { getAdminAuditLogs } from './adminAuditApi';
import type { AdminAuditListParams } from '../model/adminAuditTypes';

const adminAuditKeys = {
  all: ['admin-audit'] as const,
  list: (params: AdminAuditListParams) => [...adminAuditKeys.all, 'list', params] as const,
};

export const useAdminAuditLogsQuery = (params: AdminAuditListParams) => useQuery({
  queryKey: adminAuditKeys.list(params),
  queryFn: ({ signal }) => getAdminAuditLogs(params, signal),
  placeholderData: (previous) => previous,
});
