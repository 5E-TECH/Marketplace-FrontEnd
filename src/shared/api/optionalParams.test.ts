import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { getApiUnknownFields } from './apiError';
import { withOptionalBody } from './optionalParams';

function badRequest(details: unknown[]) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('xato', 'ERR_BAD_REQUEST', config, null, {
    status: 400, statusText: '', data: { statusCode: 400, errorCode: 'VALIDATION_ERROR', message: 'xato', details }, headers: {}, config,
  });
}

describe('withOptionalBody (taklif maydonlari)', () => {
  it('backend maydonni tanimasa (forbidNonWhitelisted) — ularsiz qayta yuboriladi', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(badRequest([{ field: 'slug', error: 'property slug should not exist' }]))
      .mockResolvedValueOnce('ok');
    const result = await withOptionalBody(request, { name: 'Kolonka', slug: 'kolonka' }, ['slug']);
    expect(result).toEqual({ data: 'ok', dropped: ['slug'] });
    expect(request).toHaveBeenLastCalledWith({ name: 'Kolonka' });
  });

  it('maydon qiymati noto‘g‘ri bo‘lsa (backend uni biladi) — xato qaytadi, jimgina tashlanmaydi', async () => {
    const error = badRequest([{ field: 'slug', error: 'slug faqat lotin kichik harf, raqam va chiziqcha' }]);
    const request = vi.fn().mockRejectedValue(error);
    await expect(withOptionalBody(request, { name: 'Kolonka', slug: 'Kolonka!' }, ['slug'])).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('boshqa (majburiy) maydon ham rad etilgan bo‘lsa — qayta yuborilmaydi', async () => {
    const error = badRequest([{ field: 'slug', error: 'property slug should not exist' }, { field: 'name', error: 'name should not be empty' }]);
    const request = vi.fn().mockRejectedValue(error);
    await expect(withOptionalBody(request, { name: '', slug: 'kolonka' }, ['slug'])).rejects.toBe(error);
    expect(getApiUnknownFields(error)).toEqual(['slug']);
  });
});
