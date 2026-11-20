import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../../generated/api-types';
import { downloadFile } from '../../../shared/api/download';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto } from '../../../shared/api/readDto';
import type { AffiliateOffer, AffiliateOfferDetail, AffiliateStream, OfferSort } from '../model/offerTypes';

type Schemas = components['schemas'];

export type { AffiliateOffer, AffiliateOfferDetail, AffiliateStream, OfferSort } from '../model/offerTypes';

/** Offerlar (BE-25 `GET /affiliate/offers`): filtr va saralash serverda. */
export interface OffersFilter {
  search: string;
  categoryId?: string;
  /** «Tasdiq ≥ 50%» (FE-05 TC5). */
  minApproveRate?: number;
  sort: OfferSort;
}

/** Bir sahifada eng ko'pi 100 offer — MVP katalogi shundan kichik; ko'payganda sahifalash qo'shiladi. */
const OFFERS_LIMIT = 100;

export async function getAffiliateOffers(filter: OffersFilter, signal?: AbortSignal): Promise<{ items: AffiliateOffer[]; total: number }> {
  const params = {
    page: 1,
    limit: OFFERS_LIMIT,
    sort: filter.sort,
    ...(filter.search.trim() ? { search: filter.search.trim() } : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.minApproveRate !== undefined ? { minApproveRate: filter.minApproveRate } : {}),
  };
  const { data } = await httpClient.get<unknown>('/affiliate/offers', { params, signal });
  return readDto<Schemas['AffiliateOffersPageDto'] & { items: AffiliateOffer[] }>(data, ['items', 'total']);
}

/** Filtr o'zgarganda eski ro'yxat turadi (sakramaydi), yangisi kelguncha. */
export function useAffiliateOffersQuery(filter: OffersFilter) {
  return useQuery({
    queryKey: ['affiliate', 'offers', filter],
    queryFn: ({ signal }) => getAffiliateOffers(filter, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/**
 * Hamma offer (filtrsiz) — jami soni, sahifalar jadvalida haq va qoldiq uchun. Saralash «Offerlar»
 * sukutidagidek (EPC): filtrsiz ochilganda ikkala so'rov bitta kalit — bitta so'rov.
 */
export const useAllAffiliateOffersQuery = () => useAffiliateOffersQuery({ search: '', sort: 'EPC' });

/** DIQQAT: backendda hali yo'q — taklif (`contract/pending-endpoints.json`, docs/api-taklif/fe-05-sotuvchi-offer.md). */
export async function getAffiliateOffer(productId: string, signal?: AbortSignal): Promise<AffiliateOfferDetail> {
  const { data } = await httpClient.get<unknown>(`/affiliate/offers/${encodeURIComponent(productId)}`, { signal });
  return readDto<AffiliateOfferDetail>(data, ['productId', 'name', 'approvedPrice', 'maxSalePrice', 'affiliateFee', 'state', 'creatives']);
}

export function useAffiliateOfferQuery(productId: string | undefined) {
  return useQuery({
    queryKey: ['affiliate', 'offer', productId],
    queryFn: ({ signal }) => getAffiliateOffer(productId ?? '', signal),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
}

/** Kreativlar bitta ZIP da (taklif). */
export const downloadOfferCreatives = (productId: string, fallbackName: string) =>
  downloadFile(`/affiliate/offers/${encodeURIComponent(productId)}/creatives/archive`, fallbackName);

const streamsKey = ['affiliate', 'streams'] as const;

/**
 * «Sahifa yaratish» (SOT-3): faqat offer ID — shablon, narx va kod serverda (FE-05 TC1).
 * Yangi sahifa ro'yxat boshiga darhol qo'shiladi, keyin ro'yxat serverdan yangilanadi.
 */
export function useCreateStreamMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data } = await httpClient.post<unknown>('/affiliate/streams', { productId } satisfies Schemas['CreateAffiliateStreamDto']);
      return readDto<AffiliateStream>(data, ['id', 'code', 'link', 'productId']);
    },
    onSuccess: (stream) => {
      client.setQueriesData<Schemas['AffiliateStreamsPageDto']>({ queryKey: streamsKey }, (page) =>
        page && !page.items.some((item) => item.id === stream.id) ? { ...page, items: [stream, ...page.items], total: page.total + 1 } : page,
      );
      return client.invalidateQueries({ queryKey: streamsKey });
    },
  });
}

export type StreamPatch = Pick<Schemas['UpdateAffiliateStreamDto'], 'template' | 'salePrice' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5' | 'metaPixelId' | 'tiktokPixelId'>;

/** «Sahifani sozlash»: shablon, narx, sub1–sub5, piksellar. Postback va CAPI — FE-28. */
export function useUpdateStreamMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: StreamPatch }) => {
      const { data } = await httpClient.patch<unknown>(`/affiliate/streams/${encodeURIComponent(id)}`, patch);
      return readDto<AffiliateStream>(data, ['id', 'code', 'salePrice', 'template']);
    },
    onSuccess: (stream) => {
      client.setQueriesData<Schemas['AffiliateStreamsPageDto']>({ queryKey: streamsKey }, (page) =>
        page ? { ...page, items: page.items.map((item) => (item.id === stream.id ? stream : item)) } : page,
      );
      return client.invalidateQueries({ queryKey: streamsKey });
    },
  });
}
