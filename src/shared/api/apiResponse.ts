/** API javobining `{ data: ... }` envelope va bevosita payload formatlarini qo‘llaydi. */
export function unwrapApiData(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'data' in value
    ? value.data
    : value;
}
