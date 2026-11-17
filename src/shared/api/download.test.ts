import { describe, expect, it, vi } from 'vitest';
import { fileNameFromDisposition, saveCsv } from './download';

describe('fileNameFromDisposition', () => {
  it('RFC 5987 (filename*=UTF-8) ustun, o‘zbek harflari saqlanadi', () => {
    expect(fileNameFromDisposition(`attachment; filename="x.csv"; filename*=UTF-8''hisob_o%E2%80%98tkazma.csv`, 'f.csv')).toBe('hisob_o‘tkazma.csv');
  });
  it('oddiy filename', () => {
    expect(fileNameFromDisposition('attachment; filename="lidlar_08.01-14.01.2027.csv"', 'f.csv')).toBe('lidlar_08.01-14.01.2027.csv');
  });
  it('yo‘l belgilari tozalanadi, bo‘sh bo‘lsa zaxira nom', () => {
    expect(fileNameFromDisposition('attachment; filename="../../etc/passwd"', 'f.csv')).toBe('passwd');
    expect(fileNameFromDisposition(undefined, 'zaxira.csv')).toBe('zaxira.csv');
    expect(fileNameFromDisposition('inline', 'zaxira.csv')).toBe('zaxira.csv');
  });
});

describe('saveCsv', () => {
  it('BOM bilan text/csv blob yaratadi va berilgan nom bilan yuklaydi', async () => {
    const createObjectURL = vi.fn((blob: Blob) => { void blob; return 'blob:test'; });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveCsv('﻿Sana;Lidlar\r\n', 'statistika_14.01.2027.csv');

    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('statistika_14.01.2027.csv');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
