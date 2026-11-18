const UZ_PHONE_PREFIX = '+998';

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

/**
 * O'zbekiston mobil operatorlari kodlari (komponentlar-E §19: «Bu raqam O‘zbekiston mobil
 * operatoriga tegishli emas»). TZ'da rasmiy ro'yxat yo'q [taklif]; server ham tekshiradi
 * (BE-12: `LEAD_PHONE_OPERATOR_CODES`). Yangi kod chiqsa — shu yerga qo'shiladi.
 */
export const UZ_MOBILE_OPERATOR_CODES: readonly string[] = ['20', '33', '50', '55', '77', '88', '90', '91', '93', '94', '95', '97', '98', '99'];

/** 9 xonali mahalliy raqam O'zbekiston mobil operatoriga tegishlimi. */
export function isUzMobileNumber(local: string): boolean {
  return /^\d{9}$/.test(local) && UZ_MOBILE_OPERATOR_CODES.includes(local.slice(0, 2));
}

/** «+998 97 315 22 86» — ekranda ko'rsatish uchun. */
export function formatUzPhone(value: string): string {
  const local = getUzLocalPhone(value);
  if (local.length !== 9) return value;
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}
