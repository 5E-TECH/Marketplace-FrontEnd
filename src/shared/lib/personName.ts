/**
 * Yuqori qator va holat sahifalarida qisqa ism (karkas-E 1.6, umumiy-403/404): «Jasur Toshmatov» → «Jasur T.».
 * Bitta so'z yoki harf bilan boshlanmagan qiymat (telefon raqami) o'zgarmaydi.
 */
export function shortPersonName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !/^\p{L}/u.test(parts[0]) || !/^\p{L}/u.test(parts[1])) return name.trim();
  return `${parts[0]} ${parts[1][0].toLocaleUpperCase()}.`;
}
