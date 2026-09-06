import { Input } from 'antd';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './ListToolbar.module.css';
import { useTranslation } from '../../i18n/useTranslation';

interface ListToolbarProps {
  value: string;
  placeholder?: string;
  actions?: ReactNode;
  onChange: (value: string) => void;
}

export function ListToolbar({
  value,
  placeholder,
  actions,
  onChange,
}: ListToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <Input
        className={styles.search}
        prefix={<Search aria-hidden />}
        placeholder={placeholder ?? t('common.search')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        allowClear
      />
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
