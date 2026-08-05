export function formatMoney(value: number | bigint): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  })
    .formatToParts(value)
    .map((part) => {
      if (part.type === 'group') return ' ';
      if (part.type === 'decimal') return ',';
      return part.value;
    })
    .join('');
}
