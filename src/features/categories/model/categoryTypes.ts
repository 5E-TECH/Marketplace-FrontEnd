export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  children: Category[];
}

export interface CategoryPayload {
  name: string;
  parentId?: string | null;
  iconUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}
