import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, getAdminCategories, updateCategory } from './categoryApi';
export const categoryKey = ['admin', 'categories'] as const;
export const useAdminCategoriesQuery = () => useQuery({ queryKey: categoryKey, queryFn: ({ signal }) => getAdminCategories(signal) });
const useCategoryMutation = <T,>(mutationFn: (value: T) => Promise<unknown>) => { const client = useQueryClient(); return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: categoryKey }) }); };
export const useCreateCategoryMutation = () => useCategoryMutation(createCategory);
export const useUpdateCategoryMutation = () => useCategoryMutation(updateCategory);
export const useDeleteCategoryMutation = () => useCategoryMutation(deleteCategory);
