export const UZ_PHONE_PREFIX = '+998';
export const UZ_LOCAL_PHONE_PATTERN = /^\d{9}$/;
export const UZ_PHONE_PATTERN = /^\+998\d{9}$/;

export function normalizeUzPhone(value: string): string {
  if (value.startsWith(UZ_PHONE_PREFIX)) return `${UZ_PHONE_PREFIX}${value.slice(UZ_PHONE_PREFIX.length).replace(/\D/g, '').slice(0, 9)}`;
  return `${UZ_PHONE_PREFIX}${value.replace(/\D/g, '').slice(0, 9)}`;
}

export function getUzLocalPhone(value: string): string {
  return value.replace(/^\+998/, '').replace(/\D/g, '').slice(0, 9);
}
