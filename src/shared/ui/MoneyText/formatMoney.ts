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

/** Matn ichidagi summa qatorga bo'linmasin: «65 000» — bo'linmas bo'shliq bilan. */
export const formatMoneyNbsp = (value: number | bigint) => formatMoney(value).replace(/ /g, '\u00a0');
