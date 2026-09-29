import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';

export const returnMoney = (value: number): string => `${formatMoney(value)} UZS`;
