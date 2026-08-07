import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { loggedOut } from '../model/authSlice';
import { logout } from './authApi';

export function useLogoutMutation() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      dispatch(loggedOut());
      queryClient.clear();
    },
  });
}
