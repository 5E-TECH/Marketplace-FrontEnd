import { Plus as PlusOutlined } from 'lucide-react';
import { Button, Empty } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  image?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  image,
  compact = false,
}: EmptyStateProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('state.empty.title');
  const resolvedDescription = description ?? t('state.empty.description');
  const resolvedActionLabel = actionLabel ?? t('common.add');
  return (
    <Empty
      image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}
      imageStyle={compact ? { height: 44 } : undefined}
      description={
        <span>
          <strong>{resolvedTitle}</strong>
          {resolvedDescription ? (
            <>
              <br />
              <span>{resolvedDescription}</span>
            </>
          ) : null}
        </span>
      }
    >
      {onAction ? (
        <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
          {resolvedActionLabel}
        </Button>
      ) : null}
    </Empty>
  );
}
