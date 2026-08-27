export const managedUserRoles = ['OPERATOR'] as const;
export type ManagedUserRole = (typeof managedUserRoles)[number];

export interface ManagedUser {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  role: ManagedUserRole;
  isActive: boolean;
  isBlocked: boolean;
  shopId: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export interface UserPage { items: ManagedUser[]; total: number; page: number; limit: number; totalPages: number }
export interface UserUpsertPayload { name: string; phone: string; password: string }
export interface UpdateUserPayload { id: string; name: string; phone: string; password?: string }
