/** Sahifalash: qator soni variantlari va sahifa raqamlari ro'yxati (Pager). */
export const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Sahifa raqamlari: birinchi, joriy atrofi (chetda — 3 ta), oxirgi; orasida «…» (admin-lidlar: 1 2 3 … 24). */
export function pageItems(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const start = page <= 2 ? 1 : page >= pages - 1 ? pages - 2 : page - 1;
  const around = [start, start + 1, start + 2];
  const numbers = [...new Set([1, ...around, pages])].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  numbers.forEach((value, index) => {
    if (index && value - numbers[index - 1] > 1) items.push('gap');
    items.push(value);
  });
  return items;
}
