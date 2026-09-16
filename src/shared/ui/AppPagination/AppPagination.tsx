import { Pagination, type PaginationProps } from 'antd';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './AppPagination.module.css';

interface AppPaginationProps extends Omit<PaginationProps, 'showSizeChanger' | 'showTotal'> {
  showTotal?: boolean;
}

export function AppPagination({ className = '', showTotal = true, ...props }: AppPaginationProps) {
  const { t } = useTranslation();
  return (
    <Pagination
      {...props}
      className={`${styles.pagination} ${className}`.trim()}
      showSizeChanger={false}
      showTotal={showTotal ? (total) => t('pagination.total', { total }) : undefined}
    />
  );
}
