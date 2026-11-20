/** Qadam ko'paytuvchilari: 3 bo'lakka eng yaqin «chiroyli» son (12 → 4, 120 → 40, 281 250 → 100 000). */
const STEP_FACTORS = [1, 2, 2.5, 4, 5, 10];

/**
 * O'q bo'laklari (komponentlar-E §23). `above` — maksimum eng katta qiymatdan kamida bir qadam
 * yuqori (ustun ustidagi son grafik tepasiga tegmasin); aks holda yuqoriga yaxlitlanadi va son
 * uchun joy grafik tepasida (`headroom`) qoldiriladi. Ko'rsatkichlar butun (dona, so'm) — qadam ham butun.
 */
export function chartTicks(max: number, above = true): number[] {
  const raw = (max > 0 ? max : 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = STEP_FACTORS.find((value) => value * magnitude >= raw && Number.isInteger(value * magnitude)) ?? 10;
  const step = Math.max(1, factor * magnitude);
  const parts = above ? Math.floor(max / step) + 1 : Math.max(1, Math.ceil(max / step));
  return Array.from({ length: parts + 1 }, (_, index) => index * step);
}
