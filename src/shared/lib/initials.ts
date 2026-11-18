/** «Jasur Toshmatov» → «JT» (avatar). Harf bilan boshlanmagan qism (telefon raqami) olinmaydi. */
export function initials(name: string): string {
  const letters = name.trim().split(/\s+/).filter((part) => /^\p{L}/u.test(part)).slice(0, 2).map((part) => part[0]);
  return letters.join('').toLocaleUpperCase() || '—';
}
