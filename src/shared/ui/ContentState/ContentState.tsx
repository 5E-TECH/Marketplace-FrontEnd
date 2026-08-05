import { Inbox as InboxOutlined, RotateCw as ReloadOutlined } from 'lucide-react';
import { Button, Result, Skeleton } from 'antd';

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
  if (state === 'loading') {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  const defaults = {
    empty: {
      status: 'info' as const,
      icon: <InboxOutlined />,
      title: 'Hozircha ma’lumot yo‘q',
      description: 'Birinchi yozuvni qo‘shib ishni boshlang.',
    },
    error: {
      status: 'error' as const,
      icon: undefined,
      title: 'Ma’lumotni yuklab bo‘lmadi',
      description: 'Internet aloqasini tekshirib, qayta urinib ko‘ring.',
    },
    forbidden: {
      status: '403' as const,
      icon: undefined,
      title: 'Bu bo‘lim hozircha yopiq',
      description: 'Do‘kon tasdiqlangandan keyin bu bo‘lim ochiladi.',
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
            {actionLabel ?? (state === 'error' ? 'Qayta urinish' : 'Qo‘shish')}
          </Button>
        ) : null
      }
    />
  );
}
