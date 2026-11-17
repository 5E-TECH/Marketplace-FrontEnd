import { createContext, useContext, useLayoutEffect } from 'react';

/**
 * Panel karkasi sahifa nomini yuqori qatorda ko'rsatadi (karkas-E 0: «sahifa nomi
 * yuqori qatorda, `main` ichida ikkinchi sarlavha takrorlanmaydi»). Sahifa o'z
 * nomini shu context orqali beradi; bermasa — marshrut nomi.
 */
export const PageTitleContext = createContext<((title: string | null) => void) | null>(null);

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
