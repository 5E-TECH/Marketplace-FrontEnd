import { useMutation } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { login } from './authApi';
import { authenticated } from '../model/authSlice';

export function useLoginMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: login,
    onSuccess: (authSession) => {
      dispatch(authenticated(authSession));
    },
  });
}
