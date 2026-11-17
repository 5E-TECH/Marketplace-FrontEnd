import { describe, expect, it } from 'vitest';
import { createIdempotencyKey, idempotencyHeaders } from './requestOptions';

describe('idempotency', () => {
  it('har chaqiruvda yangi, tarmoqda xavfsiz kalit', () => {
    const keys = new Set(Array.from({ length: 50 }, createIdempotencyKey));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f-]{32,36}$/);
  });
  it('sarlavha nomi backend kutgan «Idempotency-Key»', () => {
    expect(idempotencyHeaders('abc')).toEqual({ 'Idempotency-Key': 'abc' });
  });
});
