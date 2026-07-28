import { useQuery } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  currentUserLoaded,
  selectAccessToken,
} from '../model/authSlice';
import { getCurrentUser } from './authApi';
import { isAuthPreviewEnabled } from '../lib/authPreview';

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
    enabled: Boolean(accessToken) && !isAuthPreviewEnabled,
    staleTime: 5 * 60_000,
  });
}
