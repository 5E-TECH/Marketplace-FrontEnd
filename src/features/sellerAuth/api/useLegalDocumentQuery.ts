import { useQuery } from '@tanstack/react-query';
import { getLegalDocument, type LegalDocument } from './sellerAuthApi';

/** Oferta va rozilik matni (EQ-10): versiya kamdan-kam o'zgaradi — 30 daqiqa kesh. */
export function useLegalDocumentQuery(type: LegalDocument['type']) {
  return useQuery({
    queryKey: ['legal', 'documents', type],
    queryFn: ({ signal }) => getLegalDocument(type, signal),
    staleTime: 30 * 60_000,
  });
}
