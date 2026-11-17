import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { getApiErrorCode, getApiErrorMessage, getApiRequestId, getRetryAfterSeconds, isTimeoutError } from './apiError';

function httpError(status: number, data: unknown, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('xato', 'ERR_BAD_RESPONSE', config, null, {
    status, statusText: '', data, headers, config,
  });
}

describe('apiError', () => {
  it('lid-sotuv xato kodlari tanilib, o‘zbekcha matn beriladi', () => {
    const error = httpError(409, { statusCode: 409, errorCode: 'BOOKING_LIMIT_REACHED' });
    expect(getApiErrorCode(error)).toBe('BOOKING_LIMIT_REACHED');
    expect(getApiErrorMessage(error)).toBe('Bronlaringiz to‘la. Avval bron qilingan lidlarga natija kiriting.');
    expect(getApiErrorCode(httpError(404, { errorCode: 'LEAD_QUEUE_EMPTY' }))).toBe('LEAD_QUEUE_EMPTY');
    expect(getApiErrorCode(httpError(400, { errorCode: 'NOMALUM' }))).toBeNull();
  });

  it('server matni koddan ustun', () => {
    expect(getApiErrorMessage(httpError(400, { message: 'Manzil to‘liq emas', errorCode: 'ADDRESS_NOT_CONFIRMED' }))).toBe('Manzil to‘liq emas');
  });

  it('«Xato raqami» — requestId; xavfli qiymat qabul qilinmaydi', () => {
    expect(getApiRequestId(httpError(500, { requestId: 'req-7f3a.12' }))).toBe('req-7f3a.12');
    expect(getApiRequestId(httpError(500, { requestId: '<script>' }))).toBeNull();
  });

  it('429 Retry-After soniyalari', () => {
    expect(getRetryAfterSeconds(httpError(429, {}, { 'retry-after': '42' }))).toBe(42);
    expect(getRetryAfterSeconds(httpError(429, {}, {}))).toBeNull();
    expect(getRetryAfterSeconds(httpError(500, {}, { 'retry-after': '42' }))).toBeNull();
  });

  it('timeout — «Tizim javob bermadi»', () => {
    const timeout = new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED');
    expect(isTimeoutError(timeout)).toBe(true);
    expect(getApiErrorMessage(timeout)).toMatch(/^Tizim javob bermadi/);
  });
});
