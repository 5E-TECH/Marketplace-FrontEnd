import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBanner, deleteBanner, getBanners, reorderBanners, updateBanner, uploadBannerImage } from './bannerApi';

const bannerKey = ['admin', 'content', 'banners'] as const;

/**
 * Xatoda ham ro'yxat qayta olinadi: parallel o'chirish yoki tahrirdan keyin
 * eskirgan ro'yxat qolsa, keyingi tartiblash so'rovi "topilmadi" bilan
 * qayta-qayta yiqilardi.
 */
const useBannerMutation = <T,>(mutationFn: (value: T) => Promise<unknown>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: bannerKey }) });
};

export const useBannersQuery = () => useQuery({ queryKey: bannerKey, queryFn: ({ signal }) => getBanners(signal) });
export const useCreateBannerMutation = () => useBannerMutation(createBanner);
export const useUpdateBannerMutation = () => useBannerMutation(updateBanner);
export const useReorderBannersMutation = () => useBannerMutation(reorderBanners);
export const useDeleteBannerMutation = () => useBannerMutation(deleteBanner);
/** Faqat faylni yuklaydi — banner ro'yxati o'zgarmaydi, shuning uchun invalidatsiya yo'q. */
export const useUploadBannerImageMutation = () =>
  useMutation({ mutationFn: ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) => uploadBannerImage(file, onProgress) });
