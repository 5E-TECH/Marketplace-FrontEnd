import { Ban, ShieldCheck, type LucideIcon } from 'lucide-react';

interface AdminUserBlockActionConfig {
  label: string;
  Icon: LucideIcon;
  danger: boolean;
}

export const ADMIN_USER_BLOCK_ACTION_CONFIG: Record<
  'blocked' | 'active',
  AdminUserBlockActionConfig
> = {
  blocked: { label: 'Blokdan chiqarish', Icon: ShieldCheck, danger: false },
  active: { label: 'Bloklash', Icon: Ban, danger: true },
};

export const ADMIN_USER_WRITE_ACTION_UNAVAILABLE =
  'Backend kontraktida foydalanuvchini tahrirlash va o‘chirish endpointlari mavjud emas';
