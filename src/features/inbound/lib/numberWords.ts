/**
 * Son so'z bilan (o'zbekcha) — hujjatdagi «Yuz dona e’lon qilingan, to‘qson sakkiz dona qabul qilingan» qatori
 * (hujjat-qabul-akti). 0 … 999 999 999; 100 — «yuz», 1 000 — «ming» (bir so'zisiz, hujjat namunasidagidek).
 */
const ONES = ['', 'bir', 'ikki', 'uch', 'to‘rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to‘qqiz'];
const TENS = ['', 'o‘n', 'yigirma', 'o‘ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', 'to‘qson'];

function belowThousand(value: number): string[] {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const words: string[] = [];
  if (hundreds) words.push(...(hundreds === 1 ? [] : [ONES[hundreds]]), 'yuz');
  if (rest >= 10) words.push(TENS[Math.floor(rest / 10)]);
  if (rest % 10) words.push(ONES[rest % 10]);
  return words;
}

export function uzNumberWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'nol';
  const millions = Math.floor(n / 1_000_000) % 1000;
  const thousands = Math.floor(n / 1000) % 1000;
  const rest = n % 1000;
  const words: string[] = [];
  if (millions) words.push(...belowThousand(millions), 'million');
  if (thousands) words.push(...(thousands === 1 ? [] : belowThousand(thousands)), 'ming');
  words.push(...belowThousand(rest));
  return words.join(' ');
}

export const capitalize = (text: string) => (text ? text[0].toLocaleUpperCase('uz') + text.slice(1) : text);
