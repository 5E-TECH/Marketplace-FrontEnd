import { useMutation } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { queryClient } from '../../../shared/api/queryClient';
import { authenticate } from './authApi';
import { authenticated, currentUserLoaded } from '../model/authSlice';

export function useLoginMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: authenticate,
    onSuccess: (authSession) => {
      dispatch(authenticated({ accessToken: authSession.accessToken }));
      dispatch(currentUserLoaded(authSession.user));
      queryClient.setQueryData(['auth', 'me'], authSession.user);
    },
  });
}
