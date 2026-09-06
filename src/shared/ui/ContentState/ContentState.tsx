import { Inbox as InboxOutlined, RotateCw as ReloadOutlined } from 'lucide-react';
import { Button, Result, Skeleton } from 'antd';
import { useTranslation } from '../../i18n/useTranslation';

interface ContentStateProps {
  state: 'loading' | 'empty' | 'error' | 'forbidden';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ContentState({
  state,
  title,
  description,
  actionLabel,
  onAction,
}: ContentStateProps) {
  const { t } = useTranslation();
  if (state === 'loading') {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  const defaults = {
    empty: {
      status: 'info' as const,
      icon: <InboxOutlined />,
      title: t('state.empty.title'),
      description: t('state.empty.description'),
    },
    error: {
      status: 'error' as const,
      icon: undefined,
      title: t('state.error.title'),
      description: t('state.error.description'),
    },
    forbidden: {
      status: '403' as const,
      icon: undefined,
      title: t('state.forbidden.title'),
      description: t('state.forbidden.description'),
    },
  }[state];

  return (
    <Result
      status={defaults.status}
      icon={defaults.icon}
      title={title ?? defaults.title}
      subTitle={description ?? defaults.description}
      extra={
        onAction ? (
          <Button
            type={state === 'error' ? 'default' : 'primary'}
            icon={state === 'error' ? <ReloadOutlined /> : undefined}
            onClick={onAction}
          >
            {actionLabel ?? (state === 'error' ? t('common.retry') : t('common.add'))}
          </Button>
        ) : null
      }
    />
  );
}
