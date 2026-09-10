import { Ban, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../../shared/i18n/translations';

interface AdminUserBlockActionConfig {
  label: TranslationKey;
  Icon: LucideIcon;
  danger: boolean;
}

export const ADMIN_USER_BLOCK_ACTION_CONFIG: Record<
  'blocked' | 'active',
  AdminUserBlockActionConfig
> = {
  blocked: { label: 'admin.users.unblock', Icon: ShieldCheck, danger: false },
  active: { label: 'admin.users.block', Icon: Ban, danger: true },
};
