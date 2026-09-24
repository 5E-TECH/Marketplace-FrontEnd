import { Pagination, type PaginationProps } from 'antd';
import { usePaginationProps } from './usePaginationProps';

interface AppPaginationProps extends Omit<PaginationProps, 'showSizeChanger' | 'showTotal'> {
  showTotal?: boolean;
}

export function AppPagination({ className = '', showTotal = true, ...props }: AppPaginationProps) {
  const defaults = usePaginationProps();
  return (
    <Pagination
      {...defaults}
      {...props}
      className={`${defaults.className} ${className}`.trim()}
      showTotal={showTotal ? defaults.showTotal : undefined}
    />
  );
}
