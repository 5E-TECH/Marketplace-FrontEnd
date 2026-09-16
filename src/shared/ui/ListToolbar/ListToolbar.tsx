import type { ReactNode } from 'react';
import styles from './ListToolbar.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { SearchInput } from '../SearchInput/SearchInput';

interface ListToolbarProps {
  className?: string;
  value: string;
  placeholder?: string;
  actions?: ReactNode;
  onChange: (value: string) => void;
}

export function ListToolbar({
  className,
  value,
  placeholder,
  actions,
  onChange,
}: ListToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.toolbar} ${className ?? ''}`.trim()}>
      <SearchInput
        className={styles.search}
        placeholder={placeholder ?? t('common.search')}
        value={value}
        onValueChange={onChange}
      />
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
