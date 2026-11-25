import { Dropdown, Tooltip } from 'antd';
import { Ban, Ellipsis, Eye, Headphones, Inbox, Printer, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { cancelBlock, orderNumber } from '../lib/orderView';
import type { OrderListItem } from '../model/orderTypes';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import styles from './OrderList.module.css';

export type OrderAction = 'open' | 'lead' | 'listen' | 'return' | 'label' | 'cancel';

interface OrderRowMenuProps {
  order: Pick<OrderListItem, 'id' | 'leadId' | 'status'>;
  /** Mavjud amallar: admin — hammasi; nazoratchi va operator — ochish va bekor qilish. */
  actions: readonly OrderAction[];
  onAction: (action: OrderAction) => void;
  /** Panel sarlavhasida — 32 px. */
  compact?: boolean;
}

/** Yorliq qadoqlanganda chop etiladi — undan keyingi har holatda qayta chop etsa bo'ladi (bekor qilinmagan). */
const NO_LABEL = new Set(['CONFIRMED', 'PICKING', 'CANCELLED']);

/**
 * Buyurtma qator menyusi (admin-buyurtmalar): ochish, lid, qaytarish so'rovini qayd etish («Yetkazildi»), yorliqni qayta
 * chop etish [taklif], bekor qilish (BUY-3: Elchi'ga topshirilgunga qadar; yopiq bo'lsa — sababi maslahatda).
 */
export function OrderRowMenu({ order, actions, onAction, compact = false }: OrderRowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t('ord.rowActions', { id: orderNumber(order) });
  const block = cancelBlock(order.status);
  const has = (action: OrderAction) => actions.includes(action);
  const items = [
    ...(has('open') ? [{ key: 'open', icon: <Eye aria-hidden />, label: t('ord.menu.open') }] : []),
    ...(has('lead') && order.leadId ? [{ key: 'lead', icon: <Inbox aria-hidden />, label: t('ord.menu.lead') }] : []),
    ...(has('listen') && order.leadId ? [{ key: 'listen', icon: <Headphones aria-hidden />, label: t('ord.menu.listen') }] : []),
    ...(has('return') && order.status === 'DELIVERED' ? [{ key: 'return', icon: <Undo2 aria-hidden />, label: t('ord.menu.return') }] : []),
    ...(has('label') && !NO_LABEL.has(order.status) ? [{ key: 'label', icon: <Printer aria-hidden />, label: t('ord.menu.label') }] : []),
    ...(has('cancel') ? [
      { type: 'divider' as const },
      {
        key: 'cancel',
        icon: <Ban aria-hidden />,
        danger: !block,
        disabled: Boolean(block),
        label: block ? <Tooltip title={t(block)} placement="left">{t('ord.menu.cancel')}</Tooltip> : t('ord.menu.cancel'),
      },
    ] : []),
  ];
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      rootClassName={rowMenu.root}
      open={open}
      onOpenChange={setOpen}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          setOpen(false);
          // Menyu yopilgach oyna ochiladi — aks holda birinchi Escape menyuga ketadi.
          window.setTimeout(() => onAction(key as OrderAction));
        },
      }}
    >
      <button type="button" className={compact ? styles.iconButtonSmall : styles.iconButton} aria-label={label} title={label} aria-expanded={open} onClick={(event) => event.stopPropagation()}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}
