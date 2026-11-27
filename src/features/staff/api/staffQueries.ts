import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import type { StatsPeriod } from '../model/operatorTypes';
import type { AccountsPageParams, StaffListFilter, UserAccount } from '../model/staffTypes';
import { assignTeam, changeTeamSupervisor, createTeam, getOperatorsLive, getOperatorsStats, getSoftphones, updateSoftphone } from './operatorsApi';
import {
  activateMember, addTeamMember, deactivateMember, getMemberHistory, getSupervisorTeam, requestMemberBlock, requestMemberUnblock, resendMemberSms,
  updateTeamMember,
} from './supervisorTeamApi';
import {
  blockUser,
  changeUserRole,
  createStaff,
  endAllUserSessions,
  endUserSession,
  getAccountsPage,
  getAuditEntries,
  getStaff,
  getTeams,
  getUserAccount,
  getUserLogins,
  getUserSessions,
  resendWelcomeSms,
  resetUserPassword,
  resetUserTwoFactor,
  unblockUser,
} from './staffApi';

export const staffKeys = {
  all: ['staff'] as const,
  list: (filter: StaffListFilter & { includeUnknown?: boolean }) => [...staffKeys.all, 'list', filter] as const,
  accounts: (params: AccountsPageParams) => [...staffKeys.all, 'accounts', params] as const,
  user: (id: string) => [...staffKeys.all, 'user', id] as const,
  sessions: (id: string) => [...staffKeys.all, 'sessions', id] as const,
  logins: (id: string) => [...staffKeys.all, 'logins', id] as const,
  actions: (id: string) => [...staffKeys.all, 'actions', id] as const,
  history: (id: string) => [...staffKeys.all, 'history', id] as const,
  teams: () => [...staffKeys.all, 'teams'] as const,
  live: () => [...staffKeys.all, 'operators-live'] as const,
  softphones: () => [...staffKeys.all, 'softphones'] as const,
  stats: (period: StatsPeriod) => [...staffKeys.all, 'operator-stats', period] as const,
  supervisorTeam: () => [...staffKeys.all, 'supervisor-team'] as const,
  memberHistory: (id: string) => [...staffKeys.all, 'member-history', id] as const,
};

export const useStaffQuery = (filter: StaffListFilter & { includeUnknown?: boolean }) => useQuery({
  queryKey: staffKeys.list(filter),
  queryFn: ({ signal }) => getStaff(filter, signal),
  placeholderData: keepPreviousData,
});

export const useAccountsQuery = (params: AccountsPageParams) => useQuery({
  queryKey: staffKeys.accounts(params),
  queryFn: ({ signal }) => getAccountsPage(params, signal),
  placeholderData: keepPreviousData,
});

/** Xodim kartasi; ro'yxatdagi qator — darhol ko'rsatiladigan dastlabki qiymat (keyin backenddan yangilanadi). */
export const useUserAccountQuery = (id: string | undefined, placeholder?: UserAccount) => useQuery({
  queryKey: staffKeys.user(id ?? ''),
  queryFn: ({ signal }) => getUserAccount(id ?? '', signal),
  enabled: Boolean(id),
  placeholderData: placeholder,
  retry: (count, error) => !(axios.isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) && count < 2,
});

export const useUserSessionsQuery = (id: string, enabled = true) => useQuery({
  queryKey: staffKeys.sessions(id),
  queryFn: ({ signal }) => getUserSessions(id, signal),
  enabled,
});

export const useUserLoginsQuery = (id: string, enabled = true) => useQuery({
  queryKey: staffKeys.logins(id),
  queryFn: ({ signal }) => getUserLogins(id, 5, signal),
  enabled,
});

/** Xodim kartasidagi «Oxirgi amallari» — audit jurnalidan, xodim qilgan oxirgi 5 ta. */
export const useUserActionsQuery = (id: string, enabled = true) => useQuery({
  queryKey: staffKeys.actions(id),
  queryFn: ({ signal }) => getAuditEntries({ actorId: id, limit: 5 }, signal),
  enabled,
});

/** Foydalanuvchi ustidagi yozuvlar (rol berilgan, bloklangan): rol panelidagi «Rol … da berilgan — auditda bor». */
export const useUserHistoryQuery = (id: string, enabled = true) => useQuery({
  queryKey: staffKeys.history(id),
  queryFn: ({ signal }) => getAuditEntries({ entityType: 'User', entityId: id, limit: 20 }, signal),
  enabled,
});

export const useTeamsQuery = (enabled = true) => useQuery({
  queryKey: staffKeys.teams(),
  queryFn: ({ signal }) => getTeams(signal),
  staleTime: 60_000,
  enabled,
});

/** Har amal xodimlar ro'yxati, kartasi va audit yozuvlarini yangilaydi. */
function useStaffMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
      ]);
    },
  });
}

/** Operatorlar jonli holati (`queue-summary`): har 15 soniyada yangilanadi. */
export const useOperatorsLiveQuery = (enabled = true) => useLiveQuery({
  queryKey: staffKeys.live(),
  queryFn: ({ signal }) => getOperatorsLive(signal),
  enabled,
  intervalMs: 15_000,
});

export const useSoftphonesQuery = (enabled = true) => useLiveQuery({
  queryKey: staffKeys.softphones(),
  queryFn: ({ signal }) => getSoftphones(signal),
  enabled,
  intervalMs: 30_000,
});

export const useOperatorsStatsQuery = (period: StatsPeriod, enabled = true) => useQuery({
  queryKey: staffKeys.stats(period),
  queryFn: ({ signal }) => getOperatorsStats(period, signal),
  enabled,
  placeholderData: keepPreviousData,
});

/** Nazoratchi jamoasi (taklif §14): har 30 soniyada yangilanadi (holat «Bloklash so‘ralgan» → «Bloklangan»). */
export const useSupervisorTeamQuery = () => useLiveQuery({ queryKey: staffKeys.supervisorTeam(), queryFn: ({ signal }) => getSupervisorTeam(signal) });

export const useMemberHistoryQuery = (id: string) => useQuery({ queryKey: staffKeys.memberHistory(id), queryFn: ({ signal }) => getMemberHistory(id, signal) });

export const useAddMemberMutation = () => useStaffMutation(addTeamMember);
export const useUpdateMemberMutation = () => useStaffMutation(updateTeamMember);
export const useDeactivateMemberMutation = () => useStaffMutation(deactivateMember);
export const useActivateMemberMutation = () => useStaffMutation(activateMember);
export const useRequestBlockMutation = () => useStaffMutation(requestMemberBlock);
export const useRequestUnblockMutation = () => useStaffMutation(requestMemberUnblock);
export const useResendMemberSmsMutation = () => useStaffMutation(resendMemberSms);

export const useCreateStaffMutation = () => useStaffMutation(createStaff);
export const useUpdateSoftphoneMutation = () => useStaffMutation(updateSoftphone);
export const useAssignTeamMutation = () => useStaffMutation(assignTeam);
export const useCreateTeamMutation = () => useStaffMutation(createTeam);
export const useChangeSupervisorMutation = () => useStaffMutation(changeTeamSupervisor);
export const useChangeRoleMutation = () => useStaffMutation(changeUserRole);
export const useBlockUserMutation = () => useStaffMutation(blockUser);
export const useUnblockUserMutation = () => useStaffMutation(unblockUser);
export const useResetTwoFactorMutation = () => useStaffMutation(resetUserTwoFactor);
export const useResetPasswordMutation = () => useStaffMutation(resetUserPassword);
export const useResendWelcomeSmsMutation = () => useStaffMutation(resendWelcomeSms);
export const useEndSessionMutation = () => useStaffMutation(endUserSession);
export const useEndAllSessionsMutation = () => useStaffMutation(endAllUserSessions);
