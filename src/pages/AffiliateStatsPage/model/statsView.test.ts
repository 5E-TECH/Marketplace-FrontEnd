import { describe, expect, it } from 'vitest';
import { parseCut } from './statsView';

describe('statsView — kesim', () => {
  it('URL qiymati noto‘g‘ri bo‘lsa — kun bo‘yicha', () => {
    expect(parseCut('SUB1')).toBe('SUB1');
    expect(parseCut('SUB2')).toBe('DAY');
  });
});
