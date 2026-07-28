import { useMutation } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { queryClient } from '../../../shared/api/queryClient';
import { loggedOut } from '../model/authSlice';
import { logout } from './authApi';
import { isAuthPreviewEnabled } from '../lib/authPreview';

export function useLogoutMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: isAuthPreviewEnabled ? async () => Promise.resolve() : logout,
    onSettled: () => {
      dispatch(loggedOut());
      queryClient.clear();
    },
  });
}
