import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import { asRecord, readItems, readText } from '../../../shared/api/responseFields';
import type { AuditEntry } from '../model/staffTypes';
import type { MemberInput, SupervisorTeam, TeamMember } from '../model/teamTypes';
import { parseSoftphone } from './operatorsApi';
import { parseUserAccount } from './staffApi';

/**
 * Nazoratchi jamoasi (FE-15 «Jamoa»; 15-qaror — asosiy variant). Backendda nazoratchi uchun jamoa endpointlari yo'q —
 * hammasi taklif (docs/api-taklif/fe-15-admin-foydalanuvchilar.md §14).
 */
const date = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

function parseMember(value: unknown): TeamMember {
  const row = asRecord(value);
  const inactive = row.inactive ? asRecord(row.inactive) : null;
  const request = row.request ? asRecord(row.request) : null;
  const inactiveAt = inactive ? date(inactive.at) : null;
  const requestAt = request ? date(request.at) : null;
  const kind = request ? readText(request, 'kind').toUpperCase() : '';
  return {
    user: parseUserAccount(row),
    softphone: row.softphone ? parseSoftphone(row.softphone) : null,
    inactive: inactive && inactiveAt ? { at: inactiveAt, by: readText(inactive, 'by'), reason: readText(inactive, 'reason') } : null,
    request: request && requestAt && (kind === 'BLOCK' || kind === 'UNBLOCK') ? { kind, at: requestAt, by: readText(request, 'by'), reason: readText(request, 'reason') } : null,
  };
}

export async function getSupervisorTeam(signal?: AbortSignal): Promise<SupervisorTeam> {
  const { data } = await httpClient.get<unknown>('/supervisor/team', { signal });
  const value = asRecord(unwrapApiData(data));
  const team = value.team ? asRecord(value.team) : null;
  return {
    team: team && readText(team, 'id') ? { id: readText(team, 'id'), supervisorId: readText(team, 'supervisorId'), supervisorName: readText(team, 'supervisorName') } : null,
    members: (readItems(value, 'operators') ?? []).map(parseMember),
  };
}

export interface AddMemberResult {
  member: TeamMember;
  temporaryPassword: string | null;
  smsSent: boolean;
}

export async function addTeamMember(input: MemberInput): Promise<AddMemberResult> {
  const { data } = await httpClient.post<unknown>('/supervisor/team/operators', { ...input, firstName: input.firstName.trim(), lastName: input.lastName.trim() }, { timeout: REQUEST_TIMEOUT.action });
  const row = asRecord(unwrapApiData(data));
  return { member: parseMember(row), temporaryPassword: typeof row.temporaryPassword === 'string' && row.temporaryPassword ? row.temporaryPassword : null, smsSent: row.smsSent === true };
}

export async function updateTeamMember({ id, ...input }: MemberInput & { id: string }): Promise<TeamMember> {
  const { data } = await httpClient.patch<unknown>(`/supervisor/team/operators/${encodeURIComponent(id)}`, { ...input, firstName: input.firstName.trim(), lastName: input.lastName.trim() }, { timeout: REQUEST_TIMEOUT.action });
  return parseMember(unwrapApiData(data));
}

export async function deactivateMember({ id, reason }: { id: string; reason: string }): Promise<void> {
  await httpClient.post(`/supervisor/team/operators/${encodeURIComponent(id)}/deactivate`, { reason: reason.trim() }, { timeout: REQUEST_TIMEOUT.action });
}

export async function activateMember(id: string): Promise<void> {
  await httpClient.post(`/supervisor/team/operators/${encodeURIComponent(id)}/activate`, undefined, { timeout: REQUEST_TIMEOUT.action });
}

export async function requestMemberBlock({ id, reason, deactivate }: { id: string; reason: string; deactivate: boolean }): Promise<void> {
  await httpClient.post(`/supervisor/team/operators/${encodeURIComponent(id)}/block-request`, { reason: reason.trim(), deactivate }, { timeout: REQUEST_TIMEOUT.action });
}

export async function requestMemberUnblock({ id, reason }: { id: string; reason: string }): Promise<void> {
  await httpClient.post(`/supervisor/team/operators/${encodeURIComponent(id)}/unblock-request`, { reason: reason.trim() }, { timeout: REQUEST_TIMEOUT.action });
}

export async function resendMemberSms(id: string): Promise<void> {
  await httpClient.post(`/supervisor/team/operators/${encodeURIComponent(id)}/welcome-sms`, undefined, { timeout: REQUEST_TIMEOUT.action });
}

export async function getMemberHistory(id: string, signal?: AbortSignal): Promise<AuditEntry[]> {
  const { data } = await httpClient.get<unknown>(`/supervisor/team/operators/${encodeURIComponent(id)}/history`, { signal });
  return (readItems(unwrapApiData(data), 'items') ?? []).map((value) => {
    const row = asRecord(value);
    return {
      id: readText(row, 'id'), createdAt: readText(row, 'createdAt'), actorId: readText(row, 'actorId'), actorName: readText(row, 'actorName'),
      action: readText(row, 'action'), entityType: readText(row, 'entityType'), entityId: readText(row, 'entityId'), meta: asRecord(row.meta),
    };
  }).filter((entry) => entry.id && entry.action);
}
