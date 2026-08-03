import { useMutation } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { queryClient } from '../../../shared/api/queryClient';
import { loggedOut } from '../model/authSlice';
import { logout } from './authApi';

export function useLogoutMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      dispatch(loggedOut());
      queryClient.clear();
    },
  });
}
