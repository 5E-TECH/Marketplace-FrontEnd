/** Pul guruhlash: 3 xonadan U+00A0 (no-break space) — «250 000» satr bo'ylab bo'linmaydi (komponentlar-E §21). */
export const MONEY_GROUP = ' ';

export function groupMoneyDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, MONEY_GROUP);
}

/**
 * Maydonga yozilgan matndan butun so'm: «250000», «250 000», «250.000» → 250000. Minus yozilmaydi
 * (manfiy natija faqat ko'rsatishda), bosh nollar tashlanadi; bo'sh — `null`.
 */
export function parseMoneyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
  return digits ? Number(digits) : null;
}
