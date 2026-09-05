export type PrimitiveEntry = [label: string, value: string | number | boolean];

export function flattenPrimitiveEntries(value: unknown, prefix = ''): PrimitiveEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, content]) => {
    const label = prefix ? `${prefix} · ${key}` : key;
    return typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean'
      ? [[label, content] as PrimitiveEntry]
      : flattenPrimitiveEntries(content, label);
  });
}
