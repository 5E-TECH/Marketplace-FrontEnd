import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import { withReadableErrorBody } from '../../../shared/api/download';
import type { AgreementAcceptance, SelfEmployedInfo, SellerProfile } from '../model/sellerProfileTypes';

export type { AgreementAcceptance, SelfEmployedInfo, SelfEmployedStatus, SellerProfile } from '../model/sellerProfileTypes';

/**
 * Sotuvchi profili (FE-04: sotuvchi-profil, sotuvchi-jshshir, sotuvchi-oferta).
 *
 * DIQQAT: backendda hali yo'q (BE-05/BE-06; JShShIR — BE-23 da faqat `selfEmployed: boolean`
 * va admin tasdig'i). Shakl — taklif, `docs/api-taklif/fe-04-sotuvchi.md`; endpointlar
 * `contract/pending-endpoints.json` da, hozir mock bilan ishlaydi.
 */

export const sellerProfileKey = ['affiliate', 'profile'] as const;

export async function getSellerProfile(signal?: AbortSignal): Promise<SellerProfile> {
  const { data } = await httpClient.get<unknown>('/affiliate/profile', { signal });
  return readDto<SellerProfile>(data, ['id', 'firstName', 'lastName', 'phone', 'registeredAt', 'agreements', 'selfEmployed']);
}

export async function updateSellerName(input: { firstName: string; lastName: string }): Promise<SellerProfile> {
  const { data } = await httpClient.patch<unknown>('/affiliate/profile', input, { timeout: REQUEST_TIMEOUT.action });
  return readDto<SellerProfile>(data, ['id', 'firstName', 'lastName', 'selfEmployed']);
}

/** Yuklangan maqom ma'lumotnomasi — yopiq fayl, faqat sotuvchi va tekshiruvchi ko'radi. */
export interface UploadedDocument {
  documentId: string;
  name: string;
}

/**
 * Ma'lumotnomani oldindan yuklash (sotuvchi-jshshir 2-bo'lim: «hujjat yuklanmoqda — yuborish
 * yopiq»): foiz ko'rinadi, «Yuklashni to‘xtatish» — `signal` bilan bekor qilinadi.
 */
export async function uploadSelfEmployedDocument(
  file: File,
  options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedDocument> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await httpClient.post<unknown>('/affiliate/self-employed/document', form, {
    timeout: 120_000,
    signal: options.signal,
    onUploadProgress: ({ loaded, total }) => {
      if (total) options.onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
    },
  });
  return readDto<UploadedDocument>(data, ['documentId', 'name']);
}

/**
 * JShShIR (14 raqam) va yuklangan ma'lumotnoma — tekshiruvga (P-A5 navbati).
 * Ma'lumotnoma majburiymi — 23-qaror hali yo'q, shuning uchun ixtiyoriy.
 */
export async function submitSelfEmployed(input: { pinfl: string; documentId?: string }): Promise<SelfEmployedInfo> {
  const { data } = await httpClient.post<unknown>('/affiliate/self-employed', input, { timeout: REQUEST_TIMEOUT.action });
  return readDto<SelfEmployedInfo>(data, ['status']);
}

/** Yopiq faylni ochish: blob → yangi oynada (havola vaqtinchalik, boshqalar ko'ra olmaydi). */
export async function openSelfEmployedDocument(): Promise<void> {
  const target = window.open('', '_blank');
  try {
    const { data } = await httpClient.get<Blob>('/affiliate/self-employed/document', { responseType: 'blob', timeout: 60_000 });
    const url = URL.createObjectURL(data);
    if (target) target.location.href = url;
    else window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    target?.close();
    throw await withReadableErrorBody(error);
  }
}

/** Ofertaning yangi versiyasini qabul qilish (sotuvchi-oferta; to'liq oqim — umumiy-oferta-qayta). */
export async function acceptAgreement(input: { type: AgreementAcceptance['type']; version: string }): Promise<SellerProfile> {
  const { data } = await httpClient.post<unknown>('/affiliate/agreements', input, { timeout: REQUEST_TIMEOUT.action });
  return readDto<SellerProfile>(data, ['id', 'agreements']);
}

export function useSellerProfileQuery(enabled = true) {
  return useQuery({
    queryKey: sellerProfileKey,
    queryFn: ({ signal }) => getSellerProfile(signal),
    staleTime: 60_000,
    enabled,
  });
}

export function useUpdateSellerNameMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateSellerName,
    onSuccess: (profile) => {
      client.setQueryData(sellerProfileKey, profile);
      // Yuqori qatordagi ism (`/auth/me`) ham yangilansin.
      void client.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useSubmitSelfEmployedMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitSelfEmployed,
    onSuccess: (selfEmployed) => {
      client.setQueryData<SellerProfile>(sellerProfileKey, (profile) => (profile ? { ...profile, selfEmployed } : profile));
    },
  });
}

/** JShShIR: 14 raqam (O'zbekiston PINFL). */
export const isPinfl = (value: string) => /^\d{14}$/.test(value);

export function useAcceptAgreementMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: acceptAgreement,
    onSuccess: (profile) => client.setQueryData(sellerProfileKey, profile),
  });
}
