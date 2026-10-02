import type { PaginationProps } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './AppPagination.module.css';

/**
 * Jadval (DataTable) va alohida AppPagination uchun umumiy sozlama —
 * ko'rinish va "1–10 / 57" matni hamma joyda bir xil bo'lsin.
 */
export function usePaginationProps() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      ({
        className: styles.pagination,
        showSizeChanger: false,
        showQuickJumper: false,
        showLessItems: true,
        hideOnSinglePage: true,
        responsive: true,
        showTotal: (total, [from, to]) => t('pagination.range', { from, to, total }),
      }) satisfies PaginationProps,
    [t],
  );
}
