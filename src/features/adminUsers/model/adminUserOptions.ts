import type { AdminUserRole } from './adminUserTypes';

export const ADMIN_USER_ROLE_OPTIONS: ReadonlyArray<{
  value: AdminUserRole;
  label: string;
  description: string;
}> = [
  { value: 'BUYER', label: 'Xaridor', description: 'Marketplace orqali xarid qiladi' },
  { value: 'SELLER', label: 'Sotuvchi', description: 'Do‘kon va mahsulotlarni boshqaradi' },
  { value: 'OPERATOR', label: 'Operator', description: 'Buyurtmalar bilan ishlaydi' },
  { value: 'ADMIN', label: 'Administrator', description: 'Platformani boshqaradi' },
  { value: 'SUPERADMIN', label: 'Bosh administrator', description: 'Barcha admin ruxsatlariga ega' },
];
