import { useQuery } from '@tanstack/react-query';
import { getRegionTree } from './regionsApi';

export const regionKeys = { tree: ['regions', 'tree'] as const };

/** Ro'yxat deyarli o'zgarmaydi — sessiya davomida bir marta olinadi. */
export function useRegionTree() {
  return useQuery({ queryKey: regionKeys.tree, queryFn: ({ signal }) => getRegionTree(signal), staleTime: Infinity, gcTime: Infinity });
}
