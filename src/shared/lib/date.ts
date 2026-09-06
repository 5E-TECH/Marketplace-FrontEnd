export function formatDate(value: string, locale = 'uz-UZ'): string {
  return new Date(value).toLocaleDateString(locale);
}

export function formatDateTime(value: string, locale = 'uz-UZ'): string {
  return new Date(value).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatShortDate(value: string, locale = 'uz-UZ'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(value));
}
