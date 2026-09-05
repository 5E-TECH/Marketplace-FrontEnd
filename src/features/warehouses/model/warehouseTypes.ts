export interface Warehouse {
  id: string;
  ownerId: string;
  name: string;
  regionId: string | null;
  districtId: string | null;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehousePayload {
  name: string;
  regionId?: string | null;
  districtId?: string | null;
  address?: string | null;
  isDefault?: boolean;
}
