import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBanner, deleteBanner, getBanners, reorderBanners, updateBanner } from './bannerApi';

export const bannerKey = ['admin', 'content', 'banners'] as const;

const useBannerMutation = <T,>(mutationFn: (value: T) => Promise<unknown>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: bannerKey }) });
};

export const useBannersQuery = () => useQuery({ queryKey: bannerKey, queryFn: ({ signal }) => getBanners(signal) });
export const useCreateBannerMutation = () => useBannerMutation(createBanner);
export const useUpdateBannerMutation = () => useBannerMutation(updateBanner);
export const useReorderBannersMutation = () => useBannerMutation(reorderBanners);
export const useDeleteBannerMutation = () => useBannerMutation(deleteBanner);
