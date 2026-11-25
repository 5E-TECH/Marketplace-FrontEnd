import axios from 'axios';
import { useCallback, useState } from 'react';
import { getApiErrorFields } from '../../../../shared/api/apiError';
import { FIELD_ORDER, isDirty, productErrorsFromApi, productSlug, validateProductForm, type ProductErrors, type ProductFormValues } from '../../model/productForm';

/** Birinchi xato maydonga fokus (ekrandagi tartibda) — xato maydon ostida yozilgan. */
function focusFirst(errors: ProductErrors) {
  const first = FIELD_ORDER.find((field) => errors[field]);
  if (!first) return;
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select, [data-field="${first}"] textarea`);
    target?.focus({ preventScroll: true });
    target?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

/**
 * Mahsulot formasi holati: qiymatlar, saqlangan asos (o'zgarish — undan farq), maydon xatolari va «Saqlanmadi» xulosasi.
 * Slug nomdan avtomatik — qo'lda yozilguncha (saqlangan slug nomdan boshqacha bo'lsa — qo'lda yozilgan deb olinadi).
 */
export function useProductForm(initial: ProductFormValues) {
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ProductErrors>({});
  const [failed, setFailed] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug) && initial.slug !== productSlug(initial.name));
  const [conflictName, setConflictName] = useState<string | null>(null);

  const change = useCallback((patch: Partial<ProductFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof ProductFormValues)[]) delete next[key];
      if (!Object.keys(next).length) setFailed(false);
      return next;
    });
  }, []);

  const show = (found: ProductErrors) => {
    setErrors(found);
    setFailed(Object.keys(found).length > 0);
    focusFirst(found);
  };

  /** `extra` — formadan tashqari tekshiruv (shartnomasiz optovik). Xato bo'lsa — saqlanmaydi. */
  const validate = (options: { isNew: boolean; requireCodes: boolean }, extra: ProductErrors = {}) => {
    const found = { ...validateProductForm(values, options), ...extra };
    show(found);
    return Object.keys(found).length === 0;
  };

  /** Server xatosi maydonga tushsa — o'sha maydon ostida; aks holda `false` (umumiy xabar). */
  const applyServerError = (error: unknown): boolean => {
    const status = axios.isAxiosError(error) ? error.response?.status ?? null : null;
    const found = productErrorsFromApi(status, getApiErrorFields(error));
    if (!Object.keys(found).length) return false;
    const data: unknown = axios.isAxiosError(error) ? error.response?.data : null;
    const conflict = typeof data === 'object' && data !== null && 'conflictWith' in data ? (data.conflictWith as { name?: unknown } | null) : null;
    setConflictName(typeof conflict?.name === 'string' ? conflict.name : null);
    show(found);
    return true;
  };

  const reset = () => {
    setValues(baseline);
    setErrors({});
    setFailed(false);
  };

  /** Saqlangandan keyin: yangi asos — server javobidan. */
  const commit = (next: ProductFormValues) => {
    setBaseline(next);
    setValues(next);
    setErrors({});
    setFailed(false);
  };

  return {
    values, baseline, errors, failed, change, validate, applyServerError, reset, commit, conflictName,
    dirty: isDirty(values, baseline),
    slugTouched,
    touchSlug: () => setSlugTouched(true),
  };
}

export type ProductFormState = ReturnType<typeof useProductForm>;
