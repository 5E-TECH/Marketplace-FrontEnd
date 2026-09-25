import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Category } from '../model/categoryTypes';
import { createCategory, deleteCategory, getAdminCategories, getPublicCategories, updateCategory } from './categoryApi';
export const categoryKey = ['admin', 'categories'] as const;
export const publicCategoryKey = ['categories', 'public'] as const;
// Kategoriya daraxti kamdan-kam o'zgaradi — har forma ochilganda qayta so'ramaymiz.
export const usePublicCategoriesQuery = () => useQuery({ queryKey: publicCategoryKey, queryFn: ({ signal }) => getPublicCategories(signal), staleTime: 5 * 60_000 });
const useCategoryMutation = <T,>(mutationFn: (value: T) => Promise<unknown>) => { const client = useQueryClient(); return useMutation({ mutationFn, onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: categoryKey }), client.invalidateQueries({ queryKey: publicCategoryKey })]) }); };
export const useAdminCategoriesQuery = () => useQuery({ queryKey: categoryKey, queryFn: ({ signal }) => getAdminCategories(signal) });
/** Kategoriya ID → nomi (ichki darajalar ham). Jadvallarda ID o'rniga nom chiqarish uchun. */
export function useAdminCategoryNames(): ReadonlyMap<string, string> {
  const { data } = useAdminCategoriesQuery();
  return useMemo(() => {
    const names = new Map<string, string>();
    const collect = (items: Category[]) => items.forEach((item) => { names.set(item.id, item.name); collect(item.children); });
    collect(data ?? []);
    return names;
  }, [data]);
}
export const useCreateCategoryMutation = () => useCategoryMutation(createCategory);
export const useUpdateCategoryMutation = () => useCategoryMutation(updateCategory);
export const useDeleteCategoryMutation = () => useCategoryMutation(deleteCategory);
