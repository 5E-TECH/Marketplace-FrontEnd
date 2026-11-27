import { useQuery } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { shouldRetry } from '../../../shared/api/queryClient';
import { UnknownRoleError } from '../lib/unknownRoleError';
import { currentUserLoaded, selectIsAuthenticated, unknownRoleSeen } from '../model/authSlice';
import { getCurrentUser } from './authApi';

export function useCurrentUserQuery() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }) => {
      const user = await getCurrentUser(undefined, signal).catch((error: unknown) => {
        // Keyin rol berilsa, qayta kirgach «Rolingiz o‘zgardi» — «Oldin: Noma’lum rol» (umumiy-sessiya 9).
        if (error instanceof UnknownRoleError) dispatch(unknownRoleSeen(error.userId));
        throw error;
      });

      dispatch(currentUserLoaded(user));
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    // Noma'lum rolni qayta so'rash javobni o'zgartirmaydi.
    retry: (failureCount, error) => !(error instanceof UnknownRoleError) && shouldRetry(failureCount, error),
    // Xato holatidagi profilni yangi kuzatuvchi (masalan, karkas) ulanganda qayta so'ramaydi:
    // aks holda ma'lumotsiz so'rov `pending` ga qaytib, ProtectedRoute karkasni yechadi va
    // u qayta ulanib yana so'raydi — cheksiz aylanish. Qayta urinish — faqat tugma bilan.
    retryOnMount: false,
  });
}
