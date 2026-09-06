import { Flex, Input, Table } from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import type { ReactNode } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyState } from '../EmptyState/EmptyState';
import styles from './DataTable.module.css';
import { createTablePagination } from './tablePagination';
import { useTranslation } from '../../i18n/useTranslation';

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
  pagination?: false | TablePaginationConfig;
  emptyState?: ReactNode;
}

const defaultPagination = createTablePagination();

export function DataTable<RecordType extends object>({
  dataSource,
  search,
  toolbarExtra,
  pagination = defaultPagination,
  emptyState,
  onChange,
  className,
  ...tableProps
}: DataTableProps<RecordType>) {
  const { language, t } = useTranslation();
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

  const effectiveCurrentPage =
    pagination === false
      ? 1
      : Math.min(
          currentPage,
          Math.max(1, Math.ceil(filteredData.length / (pagination.pageSize ?? 10))),
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
            <Input.Search
              allowClear
              className={styles.search}
              placeholder={search.placeholder ?? t('common.search')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
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
                ...pagination,
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
