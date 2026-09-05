import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { currentUserLoaded } from '../model/authSlice';
import { updateProfile } from './authApi';

export function useUpdateProfileMutation() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      // Header'dagi ism ham darhol yangilanadi.
      dispatch(currentUserLoaded(user));
      queryClient.setQueryData(['auth', 'me'], user);
    },
  });
}
