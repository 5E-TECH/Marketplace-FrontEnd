import { Dropdown, Tooltip } from 'antd';
import { Ban, Ellipsis, KeyRound, LogOut, ShieldCheck, UserCog, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { displayName } from '../../../features/staff/lib/staffFormat';
import { staffPermissions, type StaffPermissions } from '../../../features/staff/model/staffRules';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import { denialKey } from '../model/staffLabels';
import styles from './StaffTab.module.css';

export type StaffAction = 'open' | 'role' | 'password' | 'sessions' | 'block' | 'unblock';

/**
 * Qator «⋯» menyusi (admin-foydalanuvchilar.holatlar «Qator menyusi»): amallar kartadagi bilan bir xil, xavfli amal
 * oxirida. Yopiq amal — sababi maslahatda. Roli noma'lum — «Rol berish»; bloklangan — faqat «Blokdan chiqarish».
 */
export function StaffRowMenu({ user, viewer, onAction }: { user: UserAccount; viewer: { id: string; role: UserRole }; onAction: (action: StaffAction) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const allowed = staffPermissions(viewer, user);
  const label = t('staff.rowActions', { name: displayName(user) });
  const item = (key: StaffAction, permission: keyof StaffPermissions | null, icon: ReactNode, text: string, danger = false) => {
    const denial = permission ? allowed[permission] : null;
    return {
      key,
      icon,
      danger,
      disabled: Boolean(denial),
      label: denial && permission ? <Tooltip title={t(denialKey(permission, denial))} placement="left">{text}</Tooltip> : text,
    };
  };
  const items = user.isBlocked
    ? [item('open', null, <UserRound aria-hidden />, t('staff.menu.open')), { type: 'divider' as const }, item('unblock', 'block', <ShieldCheck aria-hidden />, t('staff.menu.unblock'))]
    : [
      item('open', null, <UserRound aria-hidden />, t('staff.menu.open')),
      item('role', 'changeRole', <UserCog aria-hidden />, t(user.role === null ? 'staff.menu.giveRole' : 'staff.menu.role')),
      item('password', 'resetPassword', <KeyRound aria-hidden />, t('staff.menu.password')),
      item('sessions', 'endSessions', <LogOut aria-hidden />, t('staff.menu.sessions')),
      { type: 'divider' as const },
      item('block', 'block', <Ban aria-hidden />, t('staff.menu.block'), true),
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
          // Menyu yopilgach oyna ochiladi — aks holda birinchi Escape menyuga ketadi.
          window.setTimeout(() => onAction(key as StaffAction));
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-expanded={open} onClick={(event) => event.stopPropagation()}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}
