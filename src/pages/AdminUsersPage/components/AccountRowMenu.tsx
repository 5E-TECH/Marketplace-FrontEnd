import { Dropdown } from 'antd';
import { Ban, Ellipsis, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import styles from './StaffTab.module.css';

export type AccountAction = 'card' | 'impersonate' | 'block' | 'unblock';

interface AccountRowMenuProps {
  label: string;
  cardLabel: string;
  /** Superadmin va hisob faol — «Nomidan kirish». */
  canImpersonate: boolean;
  /** Bloklash/blokdan chiqarish — sotuvchida; optovikda biznes holati «Optoviklar» bo'limida. */
  block?: 'block' | 'unblock' | null;
  onAction: (action: AccountAction) => void;
}

/**
 * «Sotuvchilar» va «Optoviklar» yorliqlari qator menyusi (admin-foydalanuvchilar «Tablar»): karta, «Nomidan kirish»
 * (superadmin), bloklash — xavfli amal oxirida.
 */
export function AccountRowMenu({ label, cardLabel, canImpersonate, block = null, onAction }: AccountRowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const items = [
    { key: 'card', icon: <UserRound aria-hidden />, label: cardLabel },
    ...(canImpersonate ? [{ key: 'impersonate', icon: <LogIn aria-hidden />, label: t('staff.menu.impersonate') }] : []),
    ...(block ? [
      { type: 'divider' as const },
      block === 'block'
        ? { key: 'block', icon: <Ban aria-hidden />, label: t('staff.menu.block'), danger: true }
        : { key: 'unblock', icon: <ShieldCheck aria-hidden />, label: t('staff.menu.unblock') },
    ] : []),
  ];
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      rootClassName={`${rowMenu.root} ${styles.menu}`}
      open={open}
      onOpenChange={setOpen}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          setOpen(false);
          window.setTimeout(() => onAction(key as AccountAction));
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-expanded={open} onClick={(event) => event.stopPropagation()}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}
