import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { impersonationEnded, loggedOut, selectImpersonation } from '../model/authSlice';
import { logout } from './authApi';

export function useLogoutMutation() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  // "Nomidan kirish" paytida chiqish — faqat impersonatsiyadan chiqish:
  // `/auth/logout` impersonatsiya token'i bilan chaqirilmaydi.
  const impersonating = Boolean(useAppSelector(selectImpersonation));

  return useMutation({
    mutationFn: async () => {
      if (!impersonating) await logout();
    },
    onSettled: () => {
      if (impersonating) {
        dispatch(impersonationEnded('exited'));
        return;
      }
      dispatch(loggedOut());
      queryClient.clear();
    },
  });
}
