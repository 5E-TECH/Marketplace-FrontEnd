import { describe, expect, it } from 'vitest';
import { capitalize, uzNumberWords } from './numberWords';

describe('uzNumberWords — akt matni', () => {
  it('hujjat namunasidagi sonlar', () => {
    expect(capitalize(uzNumberWords(100))).toBe('Yuz');
    expect(uzNumberWords(98)).toBe('to‘qson sakkiz');
    expect(uzNumberWords(2)).toBe('ikki');
    expect(capitalize(uzNumberWords(20))).toBe('Yigirma');
  });

  it('yuzlik, minglik va nol', () => {
    expect(uzNumberWords(0)).toBe('nol');
    expect(uzNumberWords(210)).toBe('ikki yuz o‘n');
    expect(uzNumberWords(1000)).toBe('ming');
    expect(uzNumberWords(2_345)).toBe('ikki ming uch yuz qirq besh');
    expect(uzNumberWords(100_000)).toBe('yuz ming');
  });
});
