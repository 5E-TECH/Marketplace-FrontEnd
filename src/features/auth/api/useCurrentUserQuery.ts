import { useQuery } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { currentUserLoaded, selectIsAuthenticated } from '../model/authSlice';
import { getCurrentUser } from './authApi';

export function useCurrentUserQuery() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }) => {
      const user = await getCurrentUser(undefined, signal);

      dispatch(currentUserLoaded(user));
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}
