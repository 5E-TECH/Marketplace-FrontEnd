import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthSessions, revokeAuthSession } from './authApi';
export const authSessionKey = ['auth', 'sessions'] as const;
export const useAuthSessionsQuery = () => useQuery({ queryKey: authSessionKey, queryFn: ({ signal }) => getAuthSessions(signal) });
export const useRevokeAuthSessionMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: revokeAuthSession, onSuccess: () => client.invalidateQueries({ queryKey: authSessionKey }) }); };
