/**
 * Kategoriya slugi — backend `category.service.ts` `toSlug` bilan bir xil: o‘ → o, g‘ → g, lotin harf, raqam
 * va chiziqcha. Forma slugni oldindan ko‘rsatadi; nomdan hosil bo‘lgandan farq qilsagina yuboriladi (taklif).
 */
export function categorySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ʻʼ’‘`]/g, "'")
    .replace(/o'/g, 'o')
    .replace(/g'/g, 'g')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
