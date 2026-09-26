export const UZ_PHONE_PREFIX = '+998';
export const UZ_LOCAL_PHONE_PATTERN = /^\d{9}$/;
export const UZ_PHONE_PATTERN = /^\+998\d{9}$/;

export function normalizeUzPhone(value: string): string {
  if (value.startsWith(UZ_PHONE_PREFIX)) return `${UZ_PHONE_PREFIX}${value.slice(UZ_PHONE_PREFIX.length).replace(/\D/g, '').slice(0, 9)}`;
  return `${UZ_PHONE_PREFIX}${value.replace(/\D/g, '').slice(0, 9)}`;
}

/**
 * Mahalliy 9 xonali qism. To'liq raqam joylansa yoki avtomatik to'ldirilsa
 * ("+998 90 123 45 67", "998901234567") `998` prefiksi tashlanadi — aks holda
 * birinchi 9 raqam "998901234" bo'lib qolardi.
 */
export function getUzLocalPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return (digits.length > 9 && digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
}
