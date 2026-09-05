export type AdminUserRole = 'SELLER' | 'OPERATOR' | 'BUYER' | 'ADMIN' | 'SUPERADMIN';

export interface AdminUserListParams {
  role?: AdminUserRole;
  blocked?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateAdminUserPayload {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: AdminUserRole;
}

export interface UpdateAdminUserPayload {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: AdminUserRole;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  role: AdminUserRole;
  isActive: boolean;
  isBlocked: boolean;
  isDeleted: boolean;
  shopId: string | null;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
