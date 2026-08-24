import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { currentUserLoaded } from '../model/authSlice';
import { updateAuthProfile } from './authApi';

export function useUpdateAuthProfileMutation() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAuthProfile,
    onSuccess: (user) => {
      dispatch(currentUserLoaded(user));
      queryClient.setQueryData(['auth', 'me'], user);
    },
  });
}
