import type { TablePaginationConfig } from 'antd';

export function createTablePagination(
  pageSize = 20,
  formatTotal: (total: number) => string = (total) => `Jami ${total} ta`,
): TablePaginationConfig {
  return {
    pageSize,
    showSizeChanger: false,
    showTotal: formatTotal,
  };
}
