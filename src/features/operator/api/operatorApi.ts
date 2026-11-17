import type { components } from '../../../generated/api-types';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto, readDtoList } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';

/** Operator navbati API (BE-13, BE-25 shartnomasi). Tiplar — generatsiya qilingan DTO'lar. */
type Schemas = components['schemas'];
export type OperatorState = Schemas['OperatorStateDto']['state'];
export type OperatorStateInfo = Schemas['OperatorStateDto'];
export type OperatorLead = Schemas['OperatorLeadListItemDto'];
export type OperatorStats = Schemas['OperatorStatsDto'];

export async function updateOperatorState(state: OperatorState): Promise<OperatorStateInfo> {
  const { data } = await httpClient.put<unknown>('/operator/state', { state }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<OperatorStateInfo>(data, ['state', 'activeBookings', 'maxBookings']);
}

/** Mening bronlarim va rejalashtirilgan qo'ng'iroqlarim. */
export async function getOperatorLeads(signal?: AbortSignal): Promise<OperatorLead[]> {
  const { data } = await httpClient.get<unknown>('/operator/leads', { signal });
  return readDtoList<OperatorLead>(data, ['id', 'status', 'customerName', 'productName']);
}

export async function getOperatorStats(from: string, to: string, signal?: AbortSignal): Promise<OperatorStats> {
  const { data } = await httpClient.get<unknown>('/operator/stats', { params: { from, to }, signal });
  return readDto<OperatorStats>(data, ['attempts', 'confirmed']);
}
