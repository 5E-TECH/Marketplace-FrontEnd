import { httpClient } from '../../../shared/api/httpClient';
import { readDtoList } from '../../../shared/api/readDto';
import type { RegionGroup } from '../model/regionTypes';

export type { DistrictOption, RegionGroup } from '../model/regionTypes';

/**
 * Viloyatlar va ularning tumanlari bitta ro'yxatda (BE-38, kalit — SOATO, EQ-06). Lid manzilini
 * backend shu kesh bo'yicha tekshiradi; Elchi bormaydigan tuman ro'yxatda yo'q.
 */
export async function getRegionTree(signal?: AbortSignal): Promise<RegionGroup[]> {
  const { data } = await httpClient.get<unknown>('/regions/tree', { signal });
  return readDtoList<RegionGroup>(data, ['satoCode', 'name', 'districts']);
}
