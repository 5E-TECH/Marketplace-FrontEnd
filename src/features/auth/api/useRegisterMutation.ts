import { useMutation } from '@tanstack/react-query';
import { register } from './authApi';

export function useRegisterMutation() {
  return useMutation({ mutationFn: register });
}
