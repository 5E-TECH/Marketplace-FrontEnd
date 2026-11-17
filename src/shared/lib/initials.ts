/** «Jasur Toshmatov» → «JT» (avatar). */
export function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '');
  return letters.join('').toLocaleUpperCase() || '—';
}
