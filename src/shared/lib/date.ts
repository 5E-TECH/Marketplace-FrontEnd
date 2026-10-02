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

/**
 * `DateRangeFilter` qiymatlari (YYYY-MM-DD, mahalliy kun) → backend kutadigan
 * ISO vaqt. Tugash sanasi kun OXIRIgacha: aks holda `<= dateTo` shu kunning
 * yarim tunida to'xtab, tanlangan kunning yozuvlari chiqmay qolardi.
 */
export function toApiDateRange(from: string, to: string): { dateFrom?: string; dateTo?: string } {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  return {
    ...(start && !Number.isNaN(start.getTime()) ? { dateFrom: start.toISOString() } : {}),
    ...(end && !Number.isNaN(end.getTime()) ? { dateTo: end.toISOString() } : {}),
  };
}
