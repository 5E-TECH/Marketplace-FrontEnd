import { useMutation } from '@tanstack/react-query';
import { useAppDispatch } from '../../../app/store/hooks';
import { login } from './authApi';
import { authenticated, currentUserLoaded } from '../model/authSlice';
import {
  isAuthPreviewEnabled,
  previewSession,
  previewUser,
} from '../lib/authPreview';

export function useLoginMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: isAuthPreviewEnabled
      ? async () => Promise.resolve(previewSession)
      : login,
    onSuccess: (authSession) => {
      dispatch(authenticated(authSession));
      if (isAuthPreviewEnabled) {
        dispatch(currentUserLoaded(previewUser));
      }
    },
  });
}
