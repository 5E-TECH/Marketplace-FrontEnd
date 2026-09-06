import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';

export async function getSystemHealth(signal?: AbortSignal): Promise<unknown> {
  const { data } = await httpClient.get<unknown>('/health', { signal });
  return unwrapApiData(data);
}

export async function getSystemReadiness(signal?: AbortSignal): Promise<unknown> {
  const { data } = await httpClient.get<unknown>('/health/readiness', { signal });
  return unwrapApiData(data);
}
