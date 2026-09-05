import { Button, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import styles from './IconActionButton.module.css';

interface IconActionButtonProps {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

export function IconActionButton({
  label,
  icon,
  danger = false,
  disabled = false,
  loading = false,
  onClick,
}: IconActionButtonProps) {
  return (
    <Tooltip title={label} placement="top">
      <Button
        className={styles.button}
        type="text"
        danger={danger}
        disabled={disabled}
        loading={loading}
        icon={icon}
        aria-label={label}
        onClick={onClick}
      />
    </Tooltip>
  );
}
