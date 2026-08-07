import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { authenticate } from './authApi';
import { authenticated, currentUserLoaded } from '../model/authSlice';

export function useLoginMutation() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authenticate,
    onSuccess: (authSession) => {
      dispatch(authenticated({ accessToken: authSession.accessToken }));
      dispatch(currentUserLoaded(authSession.user));
      queryClient.setQueryData(['auth', 'me'], authSession.user);
    },
  });
}
