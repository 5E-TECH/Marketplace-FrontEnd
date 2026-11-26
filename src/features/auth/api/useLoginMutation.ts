import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { openSession, signIn } from './authApi';
import { authenticated, currentUserLoaded } from '../model/authSlice';
import type { AuthSession, LoginResponse } from '../model/authTypes';

/** Sessiya ochildi: token → store va `['auth', 'me']` keshi (kirish usulidan qat'i nazar). */
function useStartSession() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  return (authSession: AuthSession) => {
    dispatch(authenticated({ accessToken: authSession.accessToken }));
    if (!authSession.user) return;
    dispatch(currentUserLoaded(authSession.user));
    queryClient.setQueryData(['auth', 'me'], authSession.user);
  };
}

/**
 * Kirish usulidan qat'i nazar (parol, SMS kod, ro'yxat — FE-04, 2FA — FE-27) sessiyani bir xil ochadi:
 * token → `/auth/me` → store va `['auth', 'me']` keshi.
 */
export function useSignInMutation<TVariables>(signInWith: (variables: TVariables) => Promise<AuthSession>) {
  const startSession = useStartSession();
  return useMutation({ mutationFn: signInWith, onSuccess: startSession });
}

/**
 * Xodim: telefon va parol. Admin, superadmin va moliya uchun (BE-26) sessiya o'rniga 2FA bosqichi qaytishi mumkin —
 * u holda sessiya ochilmaydi, sahifa ikkinchi qadamni ko'rsatadi.
 */
export function useLoginMutation() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: signIn,
    onSuccess: (result) => {
      if (result.kind === 'session') startSession(result.session);
    },
  });
}

/** Token beradigan har qanday so'rovdan keyin sessiyani ochish (SMS kod, ro'yxat, 2FA kodi). */
export function useTokenSignInMutation<TVariables>(request: (variables: TVariables) => Promise<LoginResponse>) {
  return useSignInMutation<TVariables>(async (variables) => openSession(await request(variables)));
}
