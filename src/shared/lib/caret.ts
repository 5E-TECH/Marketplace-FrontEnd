/**
 * Formatlangan matnda n-raqamdan keyingi joy: maydon qiymati qayta guruhlanganda (telefon 2-3-2-2,
 * pul 3 xonadan) kursor foydalanuvchi turgan raqam yonida qoladi.
 */
export function caretAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(text[index])) {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }
  return text.length;
}

/** Kursordan oldingi raqamlar soni (`selectionStart` gacha). */
export function digitsBeforeCaret(text: string, caret: number | null): number {
  return text.slice(0, caret ?? text.length).replace(/\D/g, '').length;
}
