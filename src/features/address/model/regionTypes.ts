import type { components } from '../../../generated/api-types';

/** `doorDelivery: false` — Elchi bu tumanda eshikkacha olib bormaydi, faqat markazgacha (taklif, FE-09; ro'yxat — 40-savol). */
export type DistrictOption = components['schemas']['LeadDistrictOptionDto'] & { doorDelivery?: boolean };
export type RegionGroup = Omit<components['schemas']['LeadRegionGroupDto'], 'districts'> & { districts: DistrictOption[] };
