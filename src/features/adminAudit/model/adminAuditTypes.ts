export interface AdminAuditListParams {
  actorId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export interface AdminAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  objectType: string;
  objectId: string;
  createdAt: string;
}

export interface AdminAuditPage {
  items: AdminAuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
