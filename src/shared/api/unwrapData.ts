/**
 * Backend har muvaffaqiyatli javobni `{statusCode, message, data}` qobig'iga
 * o'raydi (API_CONTRACT.md §1.3). Ba'zi endpointlar esa qobiqsiz javob beradi,
 * shuning uchun qobiq bo'lmasa qiymatning o'zi qaytariladi.
 */
export function unwrapData(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'data' in value
    ? value.data
    : value;
}
