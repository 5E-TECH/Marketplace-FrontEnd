export type AdminUserRole = 'SELLER' | 'OPERATOR' | 'BUYER' | 'ADMIN' | 'SUPERADMIN';

export interface AdminUserListParams {
  role?: AdminUserRole;
  blocked?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: AdminUserRole;
  blocked: boolean;
  createdAt: string;
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
