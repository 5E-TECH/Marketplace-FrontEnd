import { Input } from 'antd';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './ListToolbar.module.css';

interface ListToolbarProps {
  value: string;
  placeholder?: string;
  actions?: ReactNode;
  onChange: (value: string) => void;
}

export function ListToolbar({
  value,
  placeholder = 'Qidirish...',
  actions,
  onChange,
}: ListToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <Input
        className={styles.search}
        prefix={<Search aria-hidden />}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        allowClear
      />
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
