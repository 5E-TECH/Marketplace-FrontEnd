import { Typography } from 'antd';
import type { ComponentProps } from 'react';
import { formatMoney } from './formatMoney';

interface MoneyTextProps
  extends Omit<ComponentProps<typeof Typography.Text>, 'children'> {
  value: number | bigint;
  currency?: string;
}

export function MoneyText({
  value,
  currency = 'so‘m',
  ...textProps
}: MoneyTextProps) {
  return (
    <Typography.Text {...textProps}>
      {formatMoney(value)}
      {currency ? ` ${currency}` : null}
    </Typography.Text>
  );
}
