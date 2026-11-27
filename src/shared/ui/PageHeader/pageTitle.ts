import { createContext, useContext, useLayoutEffect } from 'react';

/**
 * Panel karkasi sahifa nomini yuqori qatorda ko'rsatadi (karkas-E 0: «sahifa nomi
 * yuqori qatorda, `main` ichida ikkinchi sarlavha takrorlanmaydi»). Sahifa o'z
 * nomini shu context orqali beradi; bermasa — marshrut nomi.
 */
export const PageTitleContext = createContext<((title: string | null) => void) | null>(null);

/** Yuqori qatordagi «orqaga»: odatda bo'lim manzili (marshrut `section`); sahifa aniqrog'ini bera oladi. */
export interface PageBack {
  path: string;
  label: string;
}

export const PageBackContext = createContext<((back: PageBack | 'none' | null) => void) | null>(null);

/**
 * Sahifa «orqaga» manzilini beradi (masalan, `/admin/moderation?tab=prices` — «Narx navbati»): bo'lim manzili
 * boshqa yorliqni ochadigan bo'lsa. `null` — bo'lim manzili; `'none'` — havola yo'q (ichki sahifa ro'yxat yonida
 * panelda ochilgan: admin-foydalanuvchi-karta desktop va planshetda).
 */
export function usePageBack(back: PageBack | 'none' | null): void {
  const setBack = useContext(PageBackContext);
  const none = back === 'none';
  const path = back && back !== 'none' ? back.path : null;
  const label = back && back !== 'none' ? back.label : null;
  useLayoutEffect(() => {
    if (!setBack) return;
    setBack(none ? 'none' : path && label ? { path, label } : null);
    return () => setBack(null);
  }, [setBack, none, path, label]);
}

/** Karkas ichidami — PageHeader o'z `h1` ini chizmasligi uchun. */
export function useInShell(): boolean {
  return useContext(PageTitleContext) !== null;
}

export function usePageTitle(title: string | null | undefined): void {
  const setTitle = useContext(PageTitleContext);
  useLayoutEffect(() => {
    if (!setTitle) return;
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [setTitle, title]);
}

/** Yuqori qatordagi sahifa holati: «Statistika har soatda yangilanadi · 14:00» (sotuvchi-bosh). */
export interface PageStatus {
  label: string;
  value: string;
}

export const PageStatusContext = createContext<((status: PageStatus | null) => void) | null>(null);

/** Sahifa holatini yuqori qatorga chiqaradi (telefonda — mazmun tepasida). */
export function usePageStatus(label: string | null, value: string | null): void {
  const setStatus = useContext(PageStatusContext);
  useLayoutEffect(() => {
    if (!setStatus) return;
    setStatus(label && value ? { label, value } : null);
    return () => setStatus(null);
  }, [setStatus, label, value]);
}

/**
 * Yuqori qatordagi sahifa boshqaruvi uchun joy (sotuvchi-statistika: `h1` yonida «Davr:» pilli).
 * Faqat desktopda beriladi; planshet va telefonda sahifa uni o'z asboblar qatorida chizadi.
 */
export const PageHeaderSlotContext = createContext<HTMLElement | null>(null);

export function usePageHeaderSlot(): HTMLElement | null {
  return useContext(PageHeaderSlotContext);
}
