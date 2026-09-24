import { Button, type ButtonProps } from 'antd';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

type ResetFiltersButtonProps = Omit<ButtonProps, 'icon'>;

/** Filtr panellaridagi "Tozalash" tugmasi — belgisi va matni hamma joyda bir xil. */
export function ResetFiltersButton({ children, ...props }: ResetFiltersButtonProps) {
  const { t } = useTranslation();
  return (
    <Button {...props} icon={<RotateCcw size={16} aria-hidden />}>
      {children ?? t('common.clear')}
    </Button>
  );
}
