import { Flex, Table } from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import type { ReactNode } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyState } from '../EmptyState/EmptyState';
import styles from './DataTable.module.css';
import { TABLE_PAGE_SIZE } from '../../config/pagination';
import { useTranslation } from '../../i18n/useTranslation';
import { usePaginationProps } from '../AppPagination/usePaginationProps';
import { SearchInput } from '../SearchInput/SearchInput';

interface DataTableSearch<RecordType> {
  placeholder?: string;
  filter: (record: RecordType, normalizedQuery: string) => boolean;
}

interface DataTableProps<RecordType extends object>
  extends Omit<
    TableProps<RecordType>,
    'dataSource' | 'pagination' | 'locale'
  > {
  dataSource: readonly RecordType[];
  search?: DataTableSearch<RecordType>;
  toolbarExtra?: ReactNode;
  /**
   * Umumiy sozlamalar (10 ta qator, "1–10 / 57" matni, ko'rinish) ichkarida
   * qo'shiladi. Server pagination uchun yetarli:
   * `{ current: page, total, onChange: setPage }`.
   */
  pagination?: false | TablePaginationConfig;
  emptyState?: ReactNode;
}

export function DataTable<RecordType extends object>({
  dataSource,
  search,
  toolbarExtra,
  pagination = {},
  emptyState,
  onChange,
  className,
  ...tableProps
}: DataTableProps<RecordType>) {
  const { language, t } = useTranslation();
  const paginationDefaults = usePaginationProps();
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase(language));

  const filteredData = useMemo(
    () =>
      search && deferredQuery
        ? dataSource.filter((record) => search.filter(record, deferredQuery))
        : [...dataSource],
    [dataSource, deferredQuery, search],
  );

  const pageSize = (pagination !== false && pagination.pageSize) || TABLE_PAGE_SIZE;
  const effectiveCurrentPage = Math.min(
    currentPage,
    Math.max(1, Math.ceil(filteredData.length / pageSize)),
  );

  return (
    <>
      {search || toolbarExtra ? (
        <Flex
          className={styles.toolbar}
          gap={12}
          justify="space-between"
          align="center"
          wrap
        >
          {search ? (
            <SearchInput
              allowClear
              className={styles.search}
              placeholder={search.placeholder ?? t('common.search')}
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setCurrentPage(1);
              }}
            />
          ) : (
            <span />
          )}
          {toolbarExtra}
        </Flex>
      ) : null}
      <Table<RecordType>
        {...tableProps}
        className={`${styles.table} ${className ?? ''}`.trim()}
        dataSource={filteredData}
        pagination={
          pagination === false
            ? false
            : {
                ...paginationDefaults,
                placement: ['bottomEnd'],
                ...pagination,
                pageSize,
                className: `${paginationDefaults.className} ${pagination.className ?? ''}`.trim(),
                current: pagination.current ?? effectiveCurrentPage,
              }
        }
        onChange={(nextPagination, filters, sorter, extra) => {
          if (pagination !== false && pagination.current === undefined) {
            setCurrentPage(nextPagination.current ?? 1);
          }
          onChange?.(nextPagination, filters, sorter, extra);
        }}
        locale={{
          emptyText: emptyState ?? <EmptyState compact />,
        }}
      />
    </>
  );
}
