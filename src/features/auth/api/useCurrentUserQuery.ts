import { useQuery } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  currentUserLoaded,
  loggedOut,
  selectAccessToken,
} from '../model/authSlice';
import { canAccessSellerCabinet } from '../lib/sellerAccess';
import { getCurrentUser } from './authApi';

export function useCurrentUserQuery() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(selectAccessToken);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }) => {
      const user = await getCurrentUser(undefined, signal);

      if (!canAccessSellerCabinet(user)) {
        dispatch(loggedOut());
        throw new Error('Bu akkaunt orqali seller kabinetiga kirish mumkin emas');
      }

      dispatch(currentUserLoaded(user));
      return user;
    },
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
