import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { ORDER_GROUPS } from '../lib/orderStatus';
import type { OrderStatus } from '../model/orderTypes';
import styles from './OrderList.module.css';

export type OrderTab = OrderStatus | 'ALL';

interface OrderStatusTabsProps {
  value: OrderTab;
  counts: Partial<Record<OrderTab, number>> | null;
  onChange: (tab: OrderTab) => void;
  /** Guruhlar tartibi (operator-buyurtmalarim — «Bekor qilindi» Omborda'dan keyin). Sukut — admin tartibi. */
  groups?: typeof ORDER_GROUPS;
  /** «2-bosqich · Muammoli» (BUY-7) — M1 da yopiq. */
  showProblem?: boolean;
  /** «Omborda» guruhi yorlig'i: nazoratchi — «Omborda — bekor qilish mumkin», operator — «Omborda · bekor qilish mumkin». */
  warehouseLabel?: TranslationKey;
}

/**
 * Buyurtma holatlari tablari (admin-buyurtmalar, nazoratchi-buyurtmalar, operator-buyurtmalarim): «Hammasi», keyin
 * guruhlar — Omborda, Elchi'da, Yetkazilgan, Qaytish, «Bekor qilindi»; har tab yonida son. Planshet va telefonda
 * gorizontal aylantiriladi.
 */
export function OrderStatusTabs({ value, counts, onChange, groups = ORDER_GROUPS, showProblem = true, warehouseLabel }: OrderStatusTabsProps) {
  const { t } = useTranslation();
  const tab = (key: OrderTab) => (
    <button key={key} type="button" role="tab" className={styles.tab} aria-selected={value === key} onClick={() => onChange(key)}>
      {key === 'ALL' ? t('ord.tab.ALL') : t(`status.order.${key}`)}
      {counts ? <span className={styles.count}>{counts[key] ?? 0}</span> : null}
    </button>
  );
  return (
    <div className={styles.tabs} role="tablist" aria-label={t('ord.tabs')}>
      <div role="presentation" className={styles.group}>
        <span className={styles.groupLabel} aria-hidden />
        <div role="presentation" className={styles.groupTabs}>{tab('ALL')}</div>
      </div>
      {groups.map((group) => (
        <div key={group.key} role="presentation" className={styles.group}>
          {group.key === 'cancelled' ? <span className={styles.groupLabel} aria-hidden /> : <span className={styles.groupLabel}>{t(warehouseLabel && group.key === 'warehouse' ? warehouseLabel : `ord.group.${group.key}`)}</span>}
          <div role="presentation" className={styles.groupTabs}>{group.statuses.map(tab)}</div>
        </div>
      ))}
      {showProblem ? (
        <div role="presentation" className={styles.group}>
          <span className={styles.groupLabel}>{t('ord.stage2')}</span>
          <div role="presentation" className={styles.groupTabs}>
            <button type="button" role="tab" className={styles.tab} aria-selected={false} disabled title={t('ord.problemHint')}>{t('ord.problem')}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
