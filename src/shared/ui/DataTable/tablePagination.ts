import type { TablePaginationConfig } from 'antd';

export function createTablePagination(
  pageSize = 20,
): TablePaginationConfig {
  return {
    pageSize,
    showSizeChanger: false,
    showTotal: (total) => `Jami ${total} ta`,
  };
}
