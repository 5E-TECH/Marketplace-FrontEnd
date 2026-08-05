import { Plus as PlusOutlined } from 'lucide-react';
import { Button, Empty } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  image?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title = 'Hozircha ma’lumot yo‘q',
  description = 'Birinchi yozuvni qo‘shib ishni boshlang.',
  actionLabel = 'Qo‘shish',
  onAction,
  image,
  compact = false,
}: EmptyStateProps) {
  return (
    <Empty
      image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}
      imageStyle={compact ? { height: 44 } : undefined}
      description={
        <span>
          <strong>{title}</strong>
          {description ? (
            <>
              <br />
              <span>{description}</span>
            </>
          ) : null}
        </span>
      }
    >
      {onAction ? (
        <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Empty>
  );
}
