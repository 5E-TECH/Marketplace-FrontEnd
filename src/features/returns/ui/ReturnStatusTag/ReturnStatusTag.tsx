import { Tag } from 'antd';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import type { ReturnStatus } from '../../model/returnTypes';
import styles from './ReturnStatusTag.module.css';

const colors: Record<ReturnStatus, string> = {
  SUBMITTED: 'processing',
  IN_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  REFUNDED: 'cyan',
};

/** Qaytarish so'rovi holati. Buyurtmaning REFUNDED'idan farqli — "Pul qaytarildi". */
export function ReturnStatusTag({ status }: { status: ReturnStatus }) {
  const { t } = useTranslation();
  return <Tag className={styles.tag} color={colors[status]} variant="filled">{t(`returns.status.${status}`)}</Tag>;
}
