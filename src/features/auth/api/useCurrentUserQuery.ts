import { useQuery } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  currentUserLoaded,
  selectAccessToken,
} from '../model/authSlice';
import { getCurrentUser } from './authApi';

export function useCurrentUserQuery() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(selectAccessToken);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await getCurrentUser();
      dispatch(currentUserLoaded(user));
      return user;
    },
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
