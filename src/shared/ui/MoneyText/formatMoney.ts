const moneyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | bigint): string {
  return moneyFormatter
    .formatToParts(value)
    .map((part) => {
      if (part.type === 'group') return ' ';
      if (part.type === 'decimal') return ',';
      return part.value;
    })
    .join('');
}
