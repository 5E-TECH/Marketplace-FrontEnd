import { describe, expect, it } from 'vitest';
import { categorySlug, SLUG_PATTERN } from './categorySlug';

describe('categorySlug', () => {
  it('backend toSlug kabi: tutuq belgisi, o‘/g‘ va bo‘sh joy', () => {
    expect(categorySlug('Uy-ro‘zg‘or')).toBe('uy-rozgor');
    expect(categorySlug('Go‘zallik va salomatlik')).toBe('gozallik-va-salomatlik');
    expect(categorySlug('Biologik faol qo‘shimchalar')).toBe('biologik-faol-qoshimchalar');
    expect(categorySlug("  Oziq-ovqat  ")).toBe('oziq-ovqat');
    expect(categorySlug('Ta’lim')).toBe('ta-lim');
  });

  it('slug qolipi: lotin harf, raqam va bitta chiziqcha', () => {
    expect(SLUG_PATTERN.test('uy-rozgor')).toBe(true);
    expect(SLUG_PATTERN.test('Uy-rozgor')).toBe(false);
    expect(SLUG_PATTERN.test('uy--rozgor')).toBe(false);
    expect(SLUG_PATTERN.test('-uy')).toBe(false);
  });
});
