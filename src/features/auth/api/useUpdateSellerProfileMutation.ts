import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { currentUserLoaded } from '../model/authSlice';
import { updateSellerProfile, type UpdateSellerProfilePayload } from './authApi';

export function useUpdateSellerProfileMutation() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSellerProfilePayload) => updateSellerProfile(payload),
    onSuccess: (user) => {
      dispatch(currentUserLoaded(user));
      queryClient.setQueryData(['auth', 'me'], user);
    },
  });
}
