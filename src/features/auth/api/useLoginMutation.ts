import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { authenticate, openSession } from './authApi';
import { authenticated, currentUserLoaded } from '../model/authSlice';
import type { AuthSession, LoginCredentials, LoginResponse } from '../model/authTypes';

/**
 * Kirish usulidan qat'i nazar (parol, SMS kod, ro'yxat — FE-04) sessiyani bir xil ochadi:
 * token → `/auth/me` → store va `['auth', 'me']` keshi.
 */
export function useSignInMutation<TVariables>(signIn: (variables: TVariables) => Promise<AuthSession>) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signIn,
    onSuccess: (authSession) => {
      dispatch(authenticated({ accessToken: authSession.accessToken }));
      if (!authSession.user) return;
      dispatch(currentUserLoaded(authSession.user));
      queryClient.setQueryData(['auth', 'me'], authSession.user);
    },
  });
}

export function useLoginMutation() {
  return useSignInMutation<LoginCredentials>(authenticate);
}

/** Token beradigan har qanday so'rovdan keyin sessiyani ochish (SMS kod, ro'yxat). */
export function useTokenSignInMutation<TVariables>(request: (variables: TVariables) => Promise<LoginResponse>) {
  return useSignInMutation<TVariables>(async (variables) => openSession(await request(variables)));
}
