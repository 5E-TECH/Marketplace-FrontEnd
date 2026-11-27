import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import { asRecord, readItems, readNumber, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import { addDays, tashkentDate } from '../../../shared/lib/tashkentTime';
import {
  SOFTPHONE_STATUSES, WORKSPACES, type ActivityKind, type OperatorLive, type OperatorStatsRow, type Softphone, type SoftphoneStatus,
  type StatsPeriod, type Workspace, type WorkState,
} from '../model/operatorTypes';
import type { Team } from '../model/staffTypes';
import { unlessMissing } from './staffApi';

/**
 * «Operatorlar jamoasi» (FE-15). Backend: `GET /operator/queue-summary` (BE-13/BE-25: holat, bronlar, rejalashtirilgan
 * qo'ng'iroqlar, telefoniya bosqichi). Taklif (§13): holat qachondan, softfon hisoblari, operator ko'rsatkichlari,
 * jamoaga biriktirish, jamoa yaratish va nazoratchini almashtirish — backendda yo'q bo'lsa (404) ekran ishlayveradi.
 */
const STATES: readonly WorkState[] = ['ONLINE', 'BREAK', 'OFFLINE'];
const ACTIVITIES: readonly ActivityKind[] = ['CONNECTING', 'RINGING', 'IN_CALL', 'WRAP_UP', 'IDLE'];
const date = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);
const pick = <T extends string>(values: readonly T[], value: unknown, fallback: T): T => (values.includes(value as T) ? value as T : fallback);
const list = (value: unknown, key: string): unknown[] => readItems(value, key) ?? (Array.isArray(value) ? (value as unknown[]) : []);

function parseLive(value: unknown): OperatorLive | null {
  const row = asRecord(value);
  const operatorId = readText(row, 'operatorId');
  if (!operatorId) return null;
  const activity = row.activity ? asRecord(row.activity) : null;
  return {
    operatorId,
    state: pick(STATES, row.state, 'OFFLINE'),
    since: date(row.since),
    activeBookings: readNumber(row, ['activeBookings']),
    maxBookings: readNumber(row, ['maxBookings'], 5),
    scheduledCalls: readNumber(row, ['scheduledCalls']),
    activity: activity ? { kind: pick(ACTIVITIES, activity.kind, 'IDLE'), leadId: readText(activity, 'leadId') || null, since: date(activity.since) } : null,
  };
}

/** Jonli holat: `queue-summary` operatorlari (ADMIN va SUPERADMIN ham oladi). Ro'yxatda yo'q operator — oflayn. */
export async function getOperatorsLive(signal?: AbortSignal): Promise<OperatorLive[]> {
  const { data } = await httpClient.get<unknown>('/operator/queue-summary', { signal });
  return list(asRecord(unwrapApiData(data)).operators, 'operators').map(parseLive).filter((item): item is OperatorLive => item !== null);
}

export function parseSoftphone(value: unknown): Softphone | null {
  const row: UnknownRecord = asRecord(value);
  const operatorId = readText(row, 'operatorId');
  if (!operatorId) return null;
  return {
    operatorId,
    account: readText(row, 'account'),
    status: pick<SoftphoneStatus>(SOFTPHONE_STATUSES, row.status, 'UNREGISTERED'),
    since: date(row.since),
    workspace: pick<Workspace>(WORKSPACES, row.workspace, 'BROWSER'),
    neverConnected: row.neverConnected === true,
    pendingWorkspace: row.pendingWorkspace ? pick<Workspace>(WORKSPACES, row.pendingWorkspace, 'BROWSER') : null,
  };
}

/** Taklif: hamma operator softfon hisoblari; backendda yo'q — `null` («Softfon hisobi» ustunida «—»). */
export function getSoftphones(signal?: AbortSignal): Promise<Softphone[] | null> {
  return unlessMissing(async () => {
    const { data } = await httpClient.get<unknown>('/admin/operators/softphones', { signal });
    return list(unwrapApiData(data), 'items').map(parseSoftphone).filter((item): item is Softphone => item !== null);
  });
}

/** Taklif: ish joyini almashtirish; operator suhbatda bo'lsa — suhbat tugagach kuchga kiradi (`pendingWorkspace`). */
export async function updateSoftphone({ id, workspace }: { id: string; workspace: Workspace }): Promise<Softphone | null> {
  const { data } = await httpClient.patch<unknown>(`/admin/operators/${encodeURIComponent(id)}/softphone`, { workspace }, { timeout: REQUEST_TIMEOUT.action });
  return parseSoftphone(unwrapApiData(data));
}

/** Ko'rsatkichlar davri (Toshkent sanasi): bugun yoki oxirgi 7 kun (bugun bilan). */
export function statsRange(period: StatsPeriod, now = Date.now()): { from: string; to: string } {
  const to = tashkentDate(now);
  return { from: period === 'week' ? addDays(to, -6) : to, to };
}

/** Taklif: har operator ko'rsatkichlari (BE-13 `lead.stats.operator` admin uchun ro'yxat bo'lib). */
export function getOperatorsStats(period: StatsPeriod, signal?: AbortSignal): Promise<OperatorStatsRow[] | null> {
  return unlessMissing(async () => {
    const { data } = await httpClient.get<unknown>('/admin/operators/stats', { params: statsRange(period), signal });
    return list(unwrapApiData(data), 'items').map((value) => {
      const row = asRecord(value);
      const rate = row.approveRate;
      const median = row.firstCallMedianMinutes;
      return {
        operatorId: readText(row, 'operatorId'),
        attempts: readNumber(row, ['attempts']),
        confirmed: readNumber(row, ['confirmed']),
        valid: readNumber(row, ['valid']),
        approveRate: typeof rate === 'number' ? rate : null,
        firstCallMedianMinutes: typeof median === 'number' ? median : null,
      };
    }).filter((row) => row.operatorId);
  });
}

/** Taklif: operatorni jamoaga biriktirish yoki jamoadan chiqarish (`teamId: null`). */
export async function assignTeam({ id, teamId }: { id: string; teamId: string | null }): Promise<void> {
  await httpClient.patch(`/admin/users/${encodeURIComponent(id)}/team`, { teamId }, { timeout: REQUEST_TIMEOUT.action });
}

const parseTeam = (value: unknown): Team => {
  const row = asRecord(value);
  const supervisor = asRecord(row.supervisor);
  return {
    id: readText(row, 'id'),
    supervisor: { id: readText(supervisor, 'id'), name: readText(supervisor, 'name') },
    operatorCount: readNumber(row, ['operatorCount']),
    createdAt: readText(row, 'createdAt'),
  };
};

/** Taklif: yangi jamoa — nazoratchi (SUPERVISOR roli, hali jamoasi yo'q). */
export async function createTeam(supervisorId: string): Promise<Team> {
  const { data } = await httpClient.post<unknown>('/admin/teams', { supervisorId }, { timeout: REQUEST_TIMEOUT.action });
  return parseTeam(unwrapApiData(data));
}

/** Taklif: jamoa nazoratchisini almashtirish (operatorlar jamoada qoladi). */
export async function changeTeamSupervisor({ teamId, supervisorId }: { teamId: string; supervisorId: string }): Promise<Team> {
  const { data } = await httpClient.patch<unknown>(`/admin/teams/${encodeURIComponent(teamId)}`, { supervisorId }, { timeout: REQUEST_TIMEOUT.action });
  return parseTeam(unwrapApiData(data));
}
