export function formatDate(value: string, locale = 'uz-UZ'): string {
  return new Date(value).toLocaleDateString(locale);
}

const pad = (value: number) => String(value).padStart(2, '0');

export function formatDateTime(value: string, locale = 'uz-UZ'): string {
  const date = new Date(value);
  // Chrome'ning ICU ma'lumotida o'zbekcha oy nomlari yo'q va `dateStyle` "2026 M09 25"
  // kabi tushunarsiz matn beradi — uz uchun raqamli formatni o'zimiz yig'amiz.
  if (locale.startsWith('uz')) {
    if (Number.isNaN(date.getTime())) return '—';
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatShortDate(value: string, locale = 'uz-UZ'): string {
  if (locale.startsWith('uz')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(value));
}
