import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface ActionMenuProps {
  items: readonly ActionMenuItem[];
  ariaLabel?: string;
}

export function ActionMenu({
  items,
  ariaLabel = 'Amallar menyusi',
}: ActionMenuProps) {
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    danger: item.danger,
    onClick: item.onClick,
  }));

  return (
    <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: menuItems }}>
      <Button
        type="text"
        icon={<MoreHorizontal />}
        aria-label={ariaLabel}
      />
    </Dropdown>
  );
}
