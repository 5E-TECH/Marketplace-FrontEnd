export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

export function readText(record: UnknownRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}

export function readNumber(record: UnknownRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
}

export function readItems(value: unknown, ...keys: string[]): unknown[] | null {
  if (Array.isArray(value)) return value as unknown[];
  const record = asRecord(value);
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
  return null;
}

export function readPagination(record: UnknownRecord, defaults: { page: number; limit: number; itemCount: number }) {
  const total = readNumber(record, ['total'], defaults.itemCount);
  return {
    total,
    page: readNumber(record, ['page'], defaults.page),
    limit: readNumber(record, ['limit'], defaults.limit),
    totalPages: readNumber(record, ['totalPages'], Math.max(1, Math.ceil(total / defaults.limit))),
  };
}
