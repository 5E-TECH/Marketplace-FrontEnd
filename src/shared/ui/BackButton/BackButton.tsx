import { ArrowLeft } from 'lucide-react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';

interface BackButtonProps {
  fallback: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function BackButton({ fallback, label, disabled, className }: BackButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goBack = () => {
    const historyState: unknown = window.history.state as unknown;
    const historyIndex =
      typeof historyState === 'object' && historyState !== null && 'idx' in historyState
        ? historyState.idx
        : undefined;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      void navigate(-1);
      return;
    }
    void navigate(fallback, { replace: true });
  };

  return (
    <Button
      className={className}
      type="text"
      icon={<ArrowLeft size={18} />}
      disabled={disabled}
      onClick={goBack}
    >
      {label ?? t('common.back')}
    </Button>
  );
}
